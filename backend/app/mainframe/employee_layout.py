from __future__ import annotations

RECORD_LENGTH = 80
FIELDS = {
    "employee_id": (0, 8),
    "name": (8, 38),
    "department": (38, 48),
    "status": (48, 49),
    "reserved": (49, 80),
}


def serialize(employee_id: str, name: str, department: str, status: str = "A") -> str:
    employee_id = employee_id.strip().upper()
    name = name.strip()
    department = department.strip().upper()
    status = status.strip().upper()
    if len(employee_id) != 8 or not employee_id[0].isalpha() or not employee_id[1:].isdigit():
        raise ValueError("employee ID must be one letter followed by seven digits")
    if len(name) > 30 or len(department) > 10 or status not in {"A", "I"}:
        raise ValueError("invalid employee master field")
    return employee_id + name.ljust(30) + department.ljust(10) + status + (" " * 31)


def parse(record: str) -> dict:
    if len(record) != RECORD_LENGTH:
        raise ValueError(f"expected {RECORD_LENGTH} characters, got {len(record)}")
    return {
        "employee_id": record[0:8].strip(),
        "name": record[8:38].rstrip(),
        "department": record[38:48].rstrip(),
        "status": record[48:49],
    }
