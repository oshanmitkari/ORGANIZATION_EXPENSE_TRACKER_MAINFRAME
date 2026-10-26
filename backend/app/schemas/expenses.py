from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class ExpenseStatus(str, Enum):
    ACCEPTED = "accepted"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    QUEUED = "queued"
    RUNNING = "running"
    POSTED = "posted"
    REJECTED = "rejected"
    FAILED = "failed"
    UNAVAILABLE = "unavailable"


class ExpenseCreate(BaseModel):
    expense_id: str = Field(min_length=1, max_length=12, pattern=r"^[A-Z0-9-]+$")
    employee_id: str = Field(min_length=8, max_length=8, pattern=r"^[A-Z][0-9]{7}$")
    expense_date: date
    category: str = Field(min_length=1, max_length=4, pattern=r"^[A-Z0-9]+$")
    amount: Decimal = Field(gt=Decimal("0"), max_digits=7, decimal_places=2)
    description: str = Field(min_length=1, max_length=39)

    @field_validator("expense_id", "employee_id", "category", mode="before")
    @classmethod
    def uppercase(cls, value: str) -> str:
        return str(value).strip().upper()


class ExpenseView(ExpenseCreate):
    status: ExpenseStatus
    created_at: datetime
    updated_at: datetime
    rejection_reason: Optional[str] = None
    mainframe_job_id: Optional[str] = None
    processing_reference: Optional[str] = None


class SubmissionResponse(BaseModel):
    request_id: str
    expense_id: str
    status: ExpenseStatus
    message: str


class JobView(BaseModel):
    request_id: str
    expense_id: str
    status: ExpenseStatus
    created_at: datetime
    updated_at: datetime
    mainframe_job_id: Optional[str] = None
    rejection_reason: Optional[str] = None
    error: Optional[str] = None
    processing_reference: Optional[str] = None
