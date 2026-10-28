from __future__ import annotations

import logging
import re
import time
from pathlib import Path

from ..mainframe.layout import serialize
from ..mainframe.report import parse_monitor_output
from ..schemas.expenses import ExpenseStatus

log = logging.getLogger(__name__)


class ExpenseService:
    def __init__(self, settings, repo, adapter):
        self.settings, self.repo, self.adapter = settings, repo, adapter

    def submit(self, expense):
        """Compatibility wrapper for a one-item batch used by direct callers/tests."""
        item = self.repo.create(expense.model_dump(mode="json"))
        if item["status"] != ExpenseStatus.QUEUED.value:
            return item
        return self.submit_batch([expense], item["request_id"])[0]

    def submit_batch(self, expenses, batch_id: str):
        """Submit one FB80 input dataset and one EXPPOST job for a finance batch."""
        items = [self.repo.create(expense.model_dump(mode="json")) for expense in expenses]
        pending = [item for item in items if item["status"] == ExpenseStatus.QUEUED.value]
        if not pending:
            return items
        if not self.settings.zowe_enabled:
            return [self.repo.update(item["request_id"], status=ExpenseStatus.UNAVAILABLE.value,
                                     error="Mainframe integration is not configured (ZOWE_ENABLED=false)")
                    if item in pending else item for item in items]
        try:
            self.settings.data_dir.mkdir(parents=True, exist_ok=True)
            path = self.settings.data_dir / f"batch-{batch_id}.tran"
            path.write_text("\n".join(serialize(expense) for expense in expenses) + "\n", encoding="ascii")
            transaction_dataset = self._transaction_dataset(batch_id)
            result_dataset = self._result_dataset(batch_id)
            allocation = self.adapter.submit_job(self._allocation_jcl(transaction_dataset, batch_id))
            allocation_job_id = self._job_id(allocation)
            if not allocation_job_id:
                raise RuntimeError("Transaction dataset allocation returned no job id")
            self._wait_for_job(allocation_job_id)
            self.adapter.upload_transaction_file(path, transaction_dataset)
            submitted = self.adapter.submit_job(self._request_jcl(transaction_dataset, result_dataset, batch_id))
            job_id = self._job_id(submitted)
            if not job_id:
                raise RuntimeError("Zowe accepted submission without a job id")
            return [self.repo.update(item["request_id"], status=ExpenseStatus.RUNNING.value,
                                     mainframe_job_id=job_id, batch_id=batch_id,
                                     transaction_dataset=transaction_dataset,
                                     result_dataset=result_dataset)
                    if item in pending else item for item in items]
        except Exception as exc:
            log.warning("mainframe batch submission failed batch_id=%s reason=%s", batch_id, str(exc)[:200])
            detail = " ".join(str(exc).split())[:240]
            return [self.repo.update(item["request_id"], status=ExpenseStatus.FAILED.value,
                                     error=f"Mainframe submission failed: {detail or 'Zowe operation failed'}")
                    if item in pending else item for item in items]

    def _batch_suffix(self, batch_id: str) -> str:
        suffix = re.sub(r"[^A-Z0-9]", "", batch_id.upper())[-8:]
        return f"B{suffix[-7:]}"

    def _transaction_dataset(self, batch_id: str) -> str:
        if self.settings.transaction_dataset_mode == "shared":
            return self.settings.transaction_dataset
        return f"{self.settings.transaction_dataset_prefix}.{self._batch_suffix(batch_id)}"

    def _result_dataset(self, batch_id: str) -> str:
        prefix = getattr(self.settings, "result_dataset_prefix", "Z86073.EXPTRK.RES")
        return f"{prefix}.{self._batch_suffix(batch_id)}"

    @staticmethod
    def _job_id(submitted: dict | str) -> str:
        if not isinstance(submitted, dict):
            return ""
        nested = submitted.get("data") if isinstance(submitted.get("data"), dict) else {}
        return str(submitted.get("jobid") or submitted.get("jobId") or
                   nested.get("jobid") or nested.get("jobId") or "")

    def _request_jcl(self, transaction_dataset: str, result_dataset: str, batch_id: str) -> Path:
        source = Path(self.settings.post_jcl).read_text(encoding="utf-8")
        source = self._replace_set(source, "TRANDSN", transaction_dataset)
        source = self._replace_set(source, "RESULTDSN", result_dataset)
        path = self.settings.data_dir / f"batch-{batch_id}.jcl"
        path.write_text(source, encoding="ascii")
        return path

    @staticmethod
    def _replace_set(source: str, name: str, value: str) -> str:
        replacement = f"// SET {name}={value}"
        pattern = rf"^// SET {name}=.*$"
        if re.search(pattern, source, flags=re.MULTILINE):
            return re.sub(pattern, replacement, source, count=1, flags=re.MULTILINE)
        return replacement + "\n" + source

    def _allocation_jcl(self, transaction_dataset: str, batch_id: str) -> Path:
        source = ("//TXALOC  JOB (ACCT),'EXPENSE BATCH ALLOC',CLASS=A,MSGCLASS=X\n"
                  "//ALLOC    EXEC PGM=IEFBR14\n"
                  f"//TRAN     DD DSN={transaction_dataset},\n"
                  "//            DISP=(NEW,CATLG,DELETE),\n"
                  "//            UNIT=SYSDA,SPACE=(TRK,(1,1),RLSE),\n"
                  "//            DCB=(RECFM=FB,LRECL=80,BLKSIZE=0)\n")
        path = self.settings.data_dir / f"batch-{batch_id}-alloc.jcl"
        path.write_text(source, encoding="ascii")
        return path

    def _wait_for_job(self, job_id: str) -> None:
        deadline = time.monotonic() + self.settings.allocation_timeout_seconds
        while time.monotonic() < deadline:
            status = self.adapter.get_job_status(job_id)
            retcode = str(status.get("retcode") or "").upper()
            phase = str(status.get("phase") or status.get("status") or "").upper()
            if retcode:
                if retcode == "CC 0000":
                    return
                raise RuntimeError(f"Transaction dataset allocation job {job_id} ended {retcode}")
            if phase in {"OUTPUT", "COMPLETED"}:
                return
            time.sleep(2)
        raise RuntimeError(f"Transaction dataset allocation job {job_id} timed out")

    def refresh(self, request_id):
        item = self.repo.get(request_id)
        if not item:
            return None
        if item.get("batch_id"):
            self.refresh_batch(item["batch_id"])
            return self.repo.get(request_id)
        return item

    def refresh_batch(self, batch_id: str):
        items = [item for item in self.repo.all() if item.get("batch_id") == batch_id]
        running = [item for item in items if item["status"] == ExpenseStatus.RUNNING.value]
        if not running:
            return items
        try:
            status = self.adapter.get_job_status(running[0]["mainframe_job_id"])
            phase = str(status.get("retcode") or status.get("phase") or "").upper()
            if "CC 0000" not in phase and phase not in {"OUTPUT", "COMPLETED"}:
                return items
            result_dataset = running[0].get("result_dataset", self.settings.result_dataset)
            result = self.adapter.read_output_dataset(result_dataset)
            text = result if isinstance(result, str) else result.get("data", "")
            by_id = {item["expense_id"]: item for item in running}
            seen = set()
            for line in str(text).splitlines():
                parts = [part.strip() for part in line.split("|")]
                if len(parts) >= 4 and parts[0] in by_id:
                    item = by_id[parts[0]]
                    seen.add(parts[0])
                    status_value = (ExpenseStatus.POSTED.value if parts[1] == "POSTED"
                                    else ExpenseStatus.REJECTED.value)
                    self.repo.update(item["request_id"], status=status_value,
                                     rejection_reason=parts[2] or None,
                                     processing_reference=parts[3] or None)
            for item in running:
                if item["expense_id"] not in seen:
                    self.repo.update(item["request_id"], status=ExpenseStatus.FAILED.value,
                                     error="Mainframe completed without a matching result record")
            current = [self.repo.get(item["request_id"]) for item in running]
            if any(item["status"] == ExpenseStatus.POSTED.value for item in current):
                try:
                    report_job_id = self._refresh_report()
                    for item in current:
                        if item["status"] == ExpenseStatus.POSTED.value:
                            self.repo.update(item["request_id"],
                                             processing_reference=f"{item.get('processing_reference') or 'OK'}; report {report_job_id}")
                except Exception as report_error:
                    log.warning("report refresh failed batch_id=%s reason=%s", batch_id, str(report_error)[:200])
            self._submit_monitor(result_dataset, batch_id)
            return [self.repo.get(item["request_id"]) for item in items]
        except Exception:
            return items

    def _submit_monitor(self, result_dataset: str, batch_id: str):
        monitor_path = Path(getattr(self.settings, "monitor_jcl", "mainframe/jcl/EXPMON.jcl"))
        if not monitor_path.exists():
            return None
        source = monitor_path.read_text(encoding="utf-8")
        source = re.sub(
            r"^//EXPMONIN DD DSN=.*$",
            f"//EXPMONIN DD DSN={result_dataset},DISP=SHR",
            source, count=1, flags=re.MULTILINE,
        )
        if "//EXPMONIN DD DSN=" not in source:
            source = source.replace(
                "//SYSTSPRT DD",
                f"//EXPMONIN DD DSN={result_dataset},DISP=SHR\n//SYSTSPRT DD",
                1,
            )
        source = re.sub(r"^\s*%EXPMON.*$", "  %EXPMON", source, count=1, flags=re.MULTILINE)
        path = self.settings.data_dir / f"batch-{batch_id}-monitor.jcl"
        path.write_text(source, encoding="ascii")
        try:
            job_id = self._job_id(self.adapter.submit_job(path))
            if not job_id:
                return None
            return_code = self._wait_for_terminal_job(job_id)
            output = self.adapter.get_job_output(job_id)
            summary = parse_monitor_output(self._spool_text(output))
            for item in self.repo.all():
                if item.get("batch_id") == batch_id:
                    self.repo.update(item["request_id"], monitor_job_id=job_id,
                                     monitor_return_code=return_code,
                                     monitor_summary=summary)
            return job_id
        except Exception as exc:
            log.warning("batch monitor submission failed batch_id=%s reason=%s", batch_id, str(exc)[:200])
            return None

    def _wait_for_terminal_job(self, job_id: str) -> str:
        deadline = time.monotonic() + self.settings.timeout_seconds * 2
        while time.monotonic() < deadline:
            status = self.adapter.get_job_status(job_id)
            retcode = str(status.get("retcode") or "").upper()
            phase = str(status.get("phase") or status.get("status") or "").upper()
            if retcode:
                return retcode
            if phase in {"OUTPUT", "COMPLETED"}:
                return phase
            time.sleep(2)
        raise RuntimeError(f"Monitor job {job_id} timed out")

    @staticmethod
    def _spool_text(output) -> str:
        if isinstance(output, str):
            return output
        if isinstance(output, dict):
            return str(output.get("data", ""))
        if isinstance(output, list):
            return "\n".join(str(item.get("data", "")) if isinstance(item, dict) else str(item)
                                for item in output)
        return str(output or "")

    def _refresh_report(self) -> str:
        submitted = self.adapter.submit_job(Path(self.settings.report_jcl))
        job_id = self._job_id(submitted)
        if not job_id:
            raise RuntimeError("Report submission returned no job id")
        self._wait_for_job(job_id)
        return job_id
