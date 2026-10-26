from __future__ import annotations

import logging
import re
import time
from pathlib import Path

from ..mainframe.layout import serialize
from ..schemas.expenses import ExpenseStatus

log = logging.getLogger(__name__)


class ExpenseService:
    def __init__(self, settings, repo, adapter):
        self.settings, self.repo, self.adapter = settings, repo, adapter

    def submit(self, expense):
        item = self.repo.create(expense.model_dump(mode="json"))
        if item["status"] != ExpenseStatus.QUEUED.value:
            return item
        if not self.settings.zowe_enabled:
            return self.repo.update(item["request_id"], status=ExpenseStatus.UNAVAILABLE.value,
                                    error="Mainframe integration is not configured (ZOWE_ENABLED=false)")
        try:
            line = serialize(expense)
            self.settings.data_dir.mkdir(parents=True, exist_ok=True)
            path = self.settings.data_dir / f"{item['request_id']}.tran"
            path.write_text(line + "\n", encoding="ascii")
            transaction_dataset = self._transaction_dataset(item["request_id"])
            if transaction_dataset != self.settings.transaction_dataset:
                allocation_jcl = self._allocation_jcl(transaction_dataset, item["request_id"])
                allocation = self.adapter.submit_job(allocation_jcl)
                allocation_job_id = self._job_id(allocation)
                if not allocation_job_id:
                    raise RuntimeError("Transaction dataset allocation returned no job id")
                self._wait_for_job(allocation_job_id)
            self.adapter.upload_transaction_file(path, transaction_dataset)
            jcl_path = self._request_jcl(transaction_dataset, item["request_id"])
            submitted = self.adapter.submit_job(jcl_path)
            job_id = self._job_id(submitted)
            if not job_id: raise RuntimeError("Zowe accepted submission without a job id")
            return self.repo.update(item["request_id"], status=ExpenseStatus.RUNNING.value,
                                    mainframe_job_id=job_id)
        except Exception as exc:
            log.warning("mainframe submission failed request_id=%s reason=%s", item["request_id"], str(exc)[:200])
            detail = " ".join(str(exc).split())[:240]
            return self.repo.update(item["request_id"], status=ExpenseStatus.FAILED.value,
                                    error=f"Mainframe submission failed: {detail or 'Zowe operation failed'}")

    def _transaction_dataset(self, request_id: str) -> str:
        if self.settings.transaction_dataset_mode != "per-request":
            return self.settings.transaction_dataset
        suffix = re.sub(r"[^A-Z0-9]", "", request_id.upper())[-8:]
        # z/OS dataset qualifiers must begin with an alphabetic/national character.
        return f"{self.settings.transaction_dataset_prefix}.T{suffix[-7:]}"

    @staticmethod
    def _job_id(submitted: dict | str) -> str:
        if not isinstance(submitted, dict): return ""
        nested = submitted.get("data") if isinstance(submitted.get("data"), dict) else {}
        return str(submitted.get("jobid") or submitted.get("jobId") or
                   nested.get("jobid") or nested.get("jobId") or "")

    def _request_jcl(self, transaction_dataset: str, request_id: str) -> Path:
        """Materialize JCL with a request-owned TRANSIN DD; never edits the source member."""
        source = Path(self.settings.post_jcl).read_text(encoding="utf-8")
        replacement = f"// SET TRANDSN={transaction_dataset}"
        if re.search(r"^// SET TRANDSN=.*$", source, flags=re.MULTILINE):
            source = re.sub(r"^// SET TRANDSN=.*$", replacement, source, count=1, flags=re.MULTILINE)
        else:
            source = replacement + "\n" + source
        path = self.settings.data_dir / f"{request_id}.jcl"
        path.write_text(source, encoding="ascii")
        return path

    def _allocation_jcl(self, transaction_dataset: str, request_id: str) -> Path:
        """Use the known-working JCL allocation route instead of SMS dynamic allocation."""
        source = ("//TXALOC  JOB (ACCT),'EXPENSE TX ALLOC',CLASS=A,MSGCLASS=X\n"
                  "//ALLOC    EXEC PGM=IEFBR14\n"
                  f"//TRAN     DD DSN={transaction_dataset},\n"
                  "//            DISP=(NEW,CATLG,DELETE),\n"
                  "//            UNIT=SYSDA,SPACE=(TRK,(1,1),RLSE),\n"
                  "//            DCB=(RECFM=FB,LRECL=80,BLKSIZE=0)\n")
        path = self.settings.data_dir / f"{request_id}-alloc.jcl"
        path.write_text(source, encoding="ascii")
        return path

    def _wait_for_job(self, job_id: str) -> None:
        deadline = time.monotonic() + self.settings.allocation_timeout_seconds
        while time.monotonic() < deadline:
            status = self.adapter.get_job_status(job_id)
            retcode = str(status.get("retcode") or "").upper()
            phase = str(status.get("phase") or status.get("status") or "").upper()
            if retcode:
                if retcode == "CC 0000": return
                raise RuntimeError(f"Transaction dataset allocation job {job_id} ended {retcode}")
            if phase in {"OUTPUT", "COMPLETED"}:
                return
            time.sleep(2)
        raise RuntimeError(f"Transaction dataset allocation job {job_id} timed out")

    def refresh(self, request_id):
        item = self.repo.get(request_id)
        if not item: return None
        if item["status"] != ExpenseStatus.RUNNING.value: return item
        try:
            status = self.adapter.get_job_status(item["mainframe_job_id"])
            phase = str(status.get("retcode") or status.get("phase") or "").upper()
            if "CC 0000" not in phase and phase not in {"OUTPUT", "COMPLETED"}: return item
            result = self.adapter.read_output_dataset(self.settings.result_dataset)
            text = result if isinstance(result, str) else result.get("data", "")
            for line in str(text).splitlines():
                parts = [part.strip() for part in line.split("|")]
                if len(parts) >= 4 and parts[0] == item["expense_id"]:
                    status_value = ExpenseStatus.POSTED.value if parts[1] == "POSTED" else ExpenseStatus.REJECTED.value
                    reference = parts[3] or None
                    if status_value == ExpenseStatus.POSTED.value:
                        try:
                            report_job_id = self._refresh_report()
                            reference = f"{reference or 'OK'}; report {report_job_id}"
                        except Exception as report_error:
                            log.warning("report refresh failed request_id=%s reason=%s",
                                        request_id, str(report_error)[:200])
                    return self.repo.update(request_id, status=status_value,
                                            rejection_reason=parts[2] or None,
                                            processing_reference=reference)
            return self.repo.update(request_id, status=ExpenseStatus.FAILED.value,
                                    error="Mainframe completed without a matching result record")
        except Exception:
            return item

    def _refresh_report(self) -> str:
        submitted = self.adapter.submit_job(Path(self.settings.report_jcl))
        job_id = self._job_id(submitted)
        if not job_id:
            raise RuntimeError("Report submission returned no job id")
        self._wait_for_job(job_id)
        return job_id
