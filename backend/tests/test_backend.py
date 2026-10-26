from datetime import date
from decimal import Decimal
from types import SimpleNamespace
import subprocess

import pytest

from backend.app.mainframe.layout import parse, serialize
from backend.app.mainframe.employee_layout import parse as parse_employee, serialize as serialize_employee
from backend.app.mainframe.report import parse_report
from backend.app.mainframe.zowe_cli import ZoweCLI, ZoweError
from backend.app.schemas.expenses import ExpenseCreate
from backend.app.repositories.job_repository import JobRepository
from backend.app.services.expense_service import ExpenseService


def expense(**overrides):
    values = dict(expense_id="EX20261001A", employee_id="E0001001",
                  expense_date=date(2026, 10, 1), category="FOOD",
                  amount=Decimal("1250.50"), description="Client lunch")
    values.update(overrides)
    return SimpleNamespace(**values)


def test_fixed_width_round_trip_uses_paise():
    record = serialize(expense())
    assert len(record) == 80
    assert record[32:41] == "000125050"
    parsed = parse(record)
    assert parsed["expense_id"] == "EX20261001A"
    assert parsed["amount"] == Decimal("1250.50")


def test_fixed_width_rejects_bad_category_and_overflow():
    with pytest.raises(ValueError): serialize(expense(category="XXXX"))
    with pytest.raises(ValueError): serialize(expense(description="x" * 40))


def test_employee_layout_is_80_bytes_and_preserves_active_status():
    record = serialize_employee("E0001001", "Alice Johnson", "FINANCE", "A")
    assert len(record) == 80
    assert parse_employee(record) == {
        "employee_id": "E0001001", "name": "Alice Johnson",
        "department": "FINANCE", "status": "A",
    }
    assert parse_employee(serialize_employee("E0001004", "Drew Patel", "HR", "I"))["status"] == "I"


def test_employee_layout_rejects_incompatible_ids():
    with pytest.raises(ValueError): serialize_employee("00010001", "Name", "HR")


def test_report_parser_reads_detail_and_total_records():
    report = parse_report(
        "EX26102501A1|E0001001|20261025|FOOD|000012345|Controlled Zowe test\n"
        "TOTAL|000000001|000000000012345\n"
    )
    assert report["expenses"][0]["expense_id"] == "EX26102501A1"
    assert report["expenses"][0]["amount"] == Decimal("123.45")
    assert report["total"] == {"count": 1, "amount_paise": 12345}


def test_zowe_command_uses_argument_list_and_allowlist():
    calls = []

    def runner(args, **kwargs):
        calls.append((args, kwargs))
        return SimpleNamespace(returncode=0, stdout='{"jobid":"JOB123"}', stderr="")

    settings = SimpleNamespace(zowe_command="zowe", hlq="Z86073", timeout_seconds=4)
    cli = ZoweCLI(settings, runner)
    assert cli.get_job_status("JOB123")["jobid"] == "JOB123"
    assert calls[0][0] == ["zowe", "zos-jobs", "view", "job-status-by-jobid", "JOB123", "--response-format-json"]
    cli.get_job_output("JOB123")
    assert calls[1][0] == ["zowe", "zos-jobs", "view", "all-spool-content", "JOB123", "--response-format-json"]
    cli.submit_job(__import__("pathlib").Path("verify.jcl"))
    assert calls[2][0] == ["zowe", "zos-jobs", "submit", "local-file", "verify.jcl",
                            "--job-record-format", "V", "--response-format-json"]
    with pytest.raises(ValueError): cli.read_output_dataset("OTHER.DATA")


def test_zowe_timeout_is_sanitized():
    def runner(*args, **kwargs): raise subprocess.TimeoutExpired("zowe", 1)
    settings = SimpleNamespace(zowe_command="zowe", hlq="Z86073", timeout_seconds=1)
    with pytest.raises(ZoweError, match="timed out"): ZoweCLI(settings, runner).check_connection()


def test_request_validation_rejects_zero_amount_and_long_description():
    with pytest.raises(Exception): ExpenseCreate(**expense(amount=Decimal("0")).__dict__)
    with pytest.raises(Exception): ExpenseCreate(**expense(description="x" * 40).__dict__)


def test_repository_is_idempotent_for_expense_id(tmp_path):
    repository = JobRepository(tmp_path / "jobs.json")
    first = repository.create({"expense_id": "EXIDEMP", "employee_id": "E0001001",
                               "expense_date": "2026-10-01", "category": "FOOD",
                               "amount": "1.00", "description": "same"})
    second = repository.create({"expense_id": "EXIDEMP", "employee_id": "E0001001",
                                "expense_date": "2026-10-01", "category": "FOOD",
                                "amount": "1.00", "description": "same"})
    assert first["request_id"] == second["request_id"]


def test_per_request_submission_uses_isolated_dataset_and_jcl(tmp_path):
    class Adapter:
        def __init__(self): self.calls = []
        def upload_transaction_file(self, path, dataset): self.calls.append(("upload", dataset))
        def submit_job(self, path):
            self.calls.append(("submit", path.read_text()))
            return {"jobid": "JOB123"}
        def get_job_status(self, job_id): return {"retcode": "CC 0000"}

    settings = SimpleNamespace(zowe_enabled=True, data_dir=tmp_path,
                               transaction_dataset="Z86073.EXPTRK.TRAN",
                               transaction_dataset_mode="per-request",
                               transaction_dataset_prefix="Z86073.EXPTRK.TXN",
                               allocation_timeout_seconds=5,
                               post_jcl=str(tmp_path / "EXPPOST.jcl"))
    (tmp_path / "EXPPOST.jcl").write_text(
        "// SET TRANDSN=Z86073.EXPTRK.TRAN\n//TRANSIN DD DSN=&TRANDSN,DISP=SHR\n")
    adapter = Adapter()
    item = ExpenseService(settings, JobRepository(tmp_path / "jobs.json"), adapter).submit(
        ExpenseCreate(**expense().__dict__))
    assert item["status"] == "running"
    assert adapter.calls[0][0] == "submit"
    assert adapter.calls[1][0] == "upload"
    assert adapter.calls[2][0] == "submit"
    assert adapter.calls[1][1].startswith("Z86073.EXPTRK.TXN.T")
    assert len(adapter.calls[1][1].rsplit(".", 1)[1]) <= 8
    assert f"DSN={adapter.calls[1][1]}" in adapter.calls[0][1]
    assert f"// SET TRANDSN={adapter.calls[1][1]}" in adapter.calls[2][1]
