from __future__ import annotations

import logging
import threading
import time
import uuid
from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .mainframe.zowe_cli import ZoweCLI
from .mainframe.report import parse_report
from .repositories.job_repository import JobRepository
from .schemas.expenses import ExpenseCreate, ExpenseStatus, ExpenseView, JobView, SubmissionResponse
from .services.expense_service import ExpenseService

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
repo = JobRepository(settings.data_dir / "jobs.json")
batch_repo = JobRepository(settings.data_dir / "batches.json")
service = ExpenseService(settings, repo, ZoweCLI(settings))
app = FastAPI(title=settings.app_name, version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=[settings.frontend_origin], allow_credentials=True,
                   allow_methods=["GET", "POST"], allow_headers=["Content-Type"])


def _mainframe_report() -> dict:
    if not settings.zowe_enabled:
        return {"expenses": [], "total": {"count": 0, "amount_paise": 0}}
    return parse_report(service.adapter.read_output_dataset(settings.report_dataset))


def _mainframe_expenses() -> list[dict]:
    from datetime import datetime, timezone
    report = _mainframe_report()
    stamp = datetime.now(timezone.utc)
    return [{
        "expense_id": row["expense_id"], "employee_id": row["employee_id"],
        "expense_date": f'{row["expense_date"][:4]}-{row["expense_date"][4:6]}-{row["expense_date"][6:8]}',
        "category": row["category"], "amount": str(row["amount"]),
        "description": row["description"], "status": "posted",
        "created_at": stamp, "updated_at": stamp,
        "processing_reference": "verified report dataset",
    } for row in report["expenses"]]


def _expenses() -> list[dict]:
    if not settings.zowe_enabled:
        return repo.all()
    live = _mainframe_expenses()
    known = {item["expense_id"] for item in live}
    transient = {"pending_approval", "approved", "queued", "running", "rejected", "failed", "unavailable"}
    return live + [item for item in repo.all()
                   if item["expense_id"] not in known and item.get("status") in transient]


@app.get("/api/health")
def health(): return {"status": "ok", "mainframe_configured": settings.zowe_enabled}


@app.get("/api/mainframe/health")
def mainframe_health():
    if not settings.zowe_enabled: return {"status": "unavailable", "reason": "not configured"}
    try: service.adapter.check_connection(); return {"status": "ok"}
    except Exception: return {"status": "unavailable", "reason": "Zowe connection check failed"}


@app.post("/api/expenses", response_model=SubmissionResponse, status_code=202)
def create_expense(expense: ExpenseCreate, background: BackgroundTasks):
    if settings.zowe_enabled and any(x["expense_id"] == expense.expense_id for x in _mainframe_expenses()):
        raise HTTPException(409, "expense ID already exists in the mainframe report")
    item = repo.create(expense.model_dump(mode="json"))
    if item["status"] == ExpenseStatus.QUEUED.value:
        item = repo.update(item["request_id"], status=ExpenseStatus.PENDING_APPROVAL.value)
    return SubmissionResponse(request_id=item["request_id"], expense_id=item["expense_id"],
                              status=item["status"], message="Submitted for manager approval")


@app.get("/api/expenses", response_model=list[ExpenseView])
def list_expenses(): return _expenses()


@app.get("/api/expenses/{expense_id}")
def get_expense(expense_id: str):
    item = next((x for x in _expenses() if x["expense_id"] == expense_id.upper()), None)
    if not item: raise HTTPException(404, "expense not found")
    return item


@app.get("/api/jobs/{request_id}", response_model=JobView)
def get_job(request_id: str):
    item = service.refresh(request_id)
    if not item: raise HTTPException(404, "request not found")
    return item


@app.post("/api/expenses/{expense_id}/approve")
def approve_expense(expense_id: str):
    item = next((x for x in repo.all() if x["expense_id"] == expense_id.upper()), None)
    if not item: raise HTTPException(404, "expense not found")
    if item["status"] != ExpenseStatus.PENDING_APPROVAL.value:
        raise HTTPException(409, "only pending expenses can be approved")
    return repo.update(item["request_id"], status=ExpenseStatus.APPROVED.value)


@app.post("/api/expenses/{expense_id}/reject")
def reject_expense(expense_id: str, body: dict | None = None):
    item = next((x for x in repo.all() if x["expense_id"] == expense_id.upper()), None)
    if not item: raise HTTPException(404, "expense not found")
    if item["status"] != ExpenseStatus.PENDING_APPROVAL.value:
        raise HTTPException(409, "only pending expenses can be rejected")
    reason = str((body or {}).get("reason") or "Rejected by manager")[:120]
    return repo.update(item["request_id"], status=ExpenseStatus.REJECTED.value,
                       rejection_reason=reason)


def _run_batch(batch_id: str, items: list[dict]):
    batch_repo.update(batch_id, status="running")
    posted = rejected = failed = 0
    for raw in items:
        request_id = raw["request_id"]
        repo.update(request_id, status=ExpenseStatus.QUEUED.value)
        result = service.submit(ExpenseCreate(**raw))
        deadline = time.monotonic() + settings.allocation_timeout_seconds + settings.timeout_seconds * 2
        while result["status"] == ExpenseStatus.RUNNING.value and time.monotonic() < deadline:
            time.sleep(2)
            result = service.refresh(request_id)
        if result["status"] == ExpenseStatus.POSTED.value: posted += 1
        elif result["status"] == ExpenseStatus.REJECTED.value: rejected += 1
        else: failed += 1
    batch_repo.update(batch_id, status="completed", posted=posted,
                      rejected=rejected, failed=failed, completed_at=str(time.time()))


@app.get("/api/batches")
def list_batches():
    return batch_repo.all()


@app.post("/api/batches")
def run_batch(background: BackgroundTasks):
    approved = [x for x in repo.all() if x["status"] == ExpenseStatus.APPROVED.value]
    if not approved: raise HTTPException(409, "no approved expenses are waiting for batch processing")
    batch_id = str(uuid.uuid4())
    batch = batch_repo.create({"expense_id": f"BATCH-{batch_id[:8]}", "batch_id": batch_id, "status": "queued",
                               "input_count": len(approved), "posted": 0,
                               "rejected": 0, "failed": 0})
    background.add_task(_run_batch, batch["request_id"], approved)
    return {"batch_id": batch_id, "request_id": batch["request_id"],
            "status": "queued", "input_count": len(approved)}


@app.get("/api/reports/monthly")
def monthly():
    from collections import defaultdict
    from decimal import Decimal
    out = defaultdict(lambda: {"count": 0, "amount_paise": 0})
    for item in _expenses():
        if item["status"] == "posted":
            key = item["expense_date"][:7]; out[key]["count"] += 1
            out[key]["amount_paise"] += int(Decimal(str(item["amount"])) * 100)
    return out


@app.get("/api/reports/categories")
def categories():
    from decimal import Decimal
    out = {}
    for item in _expenses():
        if item["status"] == "posted":
            row = out.setdefault(item["category"], {"count": 0, "amount_paise": 0})
            row["count"] += 1; row["amount_paise"] += int(Decimal(str(item["amount"])) * 100)
    return out


@app.get("/api/reports/mainframe")
def mainframe_report():
    if not settings.zowe_enabled:
        raise HTTPException(503, "mainframe integration is not configured")
    try:
        return _mainframe_report()
    except Exception as exc:
        raise HTTPException(503, "mainframe report is unavailable") from exc
