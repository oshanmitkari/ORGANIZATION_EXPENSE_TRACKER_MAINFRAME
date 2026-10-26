from __future__ import annotations

from decimal import Decimal, InvalidOperation

RECORD_LENGTH = 80
FIELDS = {
    "expense_id": (0, 12), "employee_id": (12, 8), "expense_date": (20, 8),
    "category": (28, 4), "amount_paise": (32, 9), "description": (41, 39),
}
ALLOWED_CATEGORIES = {"FOOD", "TRVL", "OFFC", "MEDC", "UTIL", "TRNG", "COMM", "OTHR"}


def _fit(value: str, width: int) -> str:
    value = str(value)
    if len(value) > width:
        raise ValueError(f"value exceeds fixed-width field ({width}): {value[:20]}")
    return value.ljust(width)


def to_paise(amount: Decimal) -> int:
    if amount <= 0 or amount.as_tuple().exponent < -2:
        raise ValueError("amount must be positive with at most two decimal places")
    return int(amount * 100)


def serialize(expense) -> str:
    paise = to_paise(expense.amount)
    if expense.category not in ALLOWED_CATEGORIES:
        raise ValueError("unsupported category")
    fields = [
        _fit(expense.expense_id, 12), _fit(expense.employee_id, 8),
        _fit(expense.expense_date.strftime("%Y%m%d"), 8), _fit(expense.category, 4),
        f"{paise:09d}", _fit(expense.description, 39),
    ]
    record = "".join(fields)
    assert len(record) == RECORD_LENGTH
    return record


def parse(record: str) -> dict:
    if len(record) != RECORD_LENGTH:
        raise ValueError(f"expected {RECORD_LENGTH} characters, got {len(record)}")
    try:
        amount = (Decimal(record[32:41]) / Decimal(100)).quantize(Decimal("0.01"))
    except InvalidOperation as exc:
        raise ValueError("invalid amount field") from exc
    return {
        "expense_id": record[0:12].strip(), "employee_id": record[12:20].strip(),
        "expense_date": record[20:28].strip(), "category": record[28:32].strip(),
        "amount_paise": int(record[32:41]), "amount": amount,
        "description": record[41:80].rstrip(),
    }
