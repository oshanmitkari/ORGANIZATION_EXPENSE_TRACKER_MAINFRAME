from __future__ import annotations

from decimal import Decimal
import re


def parse_report(text: str) -> dict:
    expenses = []
    total = None
    for raw in text.splitlines():
        fields = [field.strip() for field in raw.rstrip().split("|")]
        if not fields or not fields[0]:
            continue
        if fields[0] == "TOTAL" and len(fields) >= 3:
            total = {"count": int(fields[1]), "amount_paise": int(fields[2])}
        elif len(fields) >= 6:
            expenses.append({
                "expense_id": fields[0], "employee_id": fields[1],
                "expense_date": fields[2], "category": fields[3],
                "amount_paise": int(fields[4]),
                "amount": (Decimal(fields[4]) / Decimal(100)).quantize(Decimal("0.01")),
                "description": fields[5],
            })
    if total is None:
        raise ValueError("report did not contain a TOTAL record")
    return {"expenses": expenses, "total": total}


def parse_monitor_output(text: str) -> dict | None:
    """Parse the bounded EXPMON SYSTSPRT summary when JES returned one."""
    match = re.search(
        r"EXPMON SUMMARY:\s*POSTED=(\d+)\s+REJECTED=(\d+)\s+FAILED=(\d+)\s+MALFORMED=(\d+)",
        text or "",
        flags=re.IGNORECASE,
    )
    if not match:
        return None
    return {
        "posted": int(match.group(1)),
        "rejected": int(match.group(2)),
        "failed": int(match.group(3)),
        "malformed": int(match.group(4)),
    }
