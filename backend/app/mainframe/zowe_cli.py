from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path

DATASET_RE = re.compile(r"^[A-Z0-9$#@.-]+$")
JOB_RE = re.compile(r"^[A-Z0-9]+$")


class ZoweError(RuntimeError):
    pass


class ZoweCLI:
    """Small allowlisted wrapper around Zowe CLI v3 commands."""

    def __init__(self, settings, runner=subprocess.run):
        self.settings, self.runner = settings, runner

    def _dataset(self, value: str) -> str:
        if not DATASET_RE.fullmatch(value) or not value.startswith(self.settings.hlq + "."):
            raise ValueError("dataset is not in the configured mainframe allowlist")
        return value

    def _run(self, args: list[str]) -> dict | str:
        try:
            result = self.runner([self.settings.zowe_command, *args], capture_output=True,
                                 text=True, timeout=self.settings.timeout_seconds, check=False)
        except subprocess.TimeoutExpired as exc:
            raise ZoweError("Zowe command timed out") from exc
        except OSError as exc:
            raise ZoweError("Zowe CLI is not available") from exc
        if result.returncode:
            detail = (result.stderr or result.stdout or "command failed").strip()
            raise ZoweError(detail[:500])
        text = (result.stdout or "").strip()
        try:
            return json.loads(text) if text else {}
        except json.JSONDecodeError:
            return text

    def check_connection(self):
        return self._run(["zosmf", "check", "status", "--response-format-json"])

    def upload_transaction_file(self, local_path: Path, dataset: str):
        return self._run(["zos-files", "upload", "file-to-data-set", str(local_path),
                          self._dataset(dataset), "--response-format-json"])

    def create_transaction_dataset(self, dataset: str):
        """Create an isolated FB/80 input dataset for one posting request."""
        args = ["zos-files", "create", "data-set-sequential", self._dataset(dataset),
                "--record-format", "FB", "--record-length", "80",
                "--primary-space", "1", "--secondary-space", "1"]
        volume = getattr(self.settings, "transaction_volume", "")
        device = getattr(self.settings, "transaction_device_type", "")
        if volume: args.extend(["--volume-serial", volume])
        if device: args.extend(["--device-type", device])
        args.append("--response-format-json")
        return self._run(args)

    def submit_job(self, jcl_path: Path):
        return self._with_data(self._run(["zos-jobs", "submit", "local-file", str(jcl_path),
                                          "--job-record-format", "V", "--response-format-json"]))

    def get_job_status(self, job_id: str):
        if not JOB_RE.fullmatch(job_id): raise ValueError("invalid job id")
        return self._with_data(self._run(["zos-jobs", "view", "job-status-by-jobid", job_id,
                                          "--response-format-json"]))

    @staticmethod
    def _with_data(result):
        """Expose z/OSMF's nested job fields to callers while retaining the raw response."""
        if isinstance(result, dict) and isinstance(result.get("data"), dict):
            return {**result, **result["data"]}
        return result

    def get_job_output(self, job_id: str):
        if not JOB_RE.fullmatch(job_id): raise ValueError("invalid job id")
        return self._run(["zos-jobs", "view", "all-spool-content", job_id,
                          "--response-format-json"])

    def read_output_dataset(self, dataset: str):
        with tempfile.NamedTemporaryFile(prefix="zowe-output-", suffix=".txt", delete=False) as handle:
            output_path = Path(handle.name)
        try:
            self._run(["zos-files", "download", "data-set", self._dataset(dataset),
                       "--file", str(output_path), "--overwrite", "--encoding", "IBM-1047",
                       "--response-format-json"])
            return output_path.read_text(encoding="utf-8")
        finally:
            output_path.unlink(missing_ok=True)
