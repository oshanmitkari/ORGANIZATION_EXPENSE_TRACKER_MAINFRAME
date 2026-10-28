from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "Expense Tracker Mainframe API")
    data_dir: Path = Path(os.getenv("BACKEND_DATA_DIR", "backend/runtime"))
    zowe_enabled: bool = os.getenv("ZOWE_ENABLED", "false").lower() == "true"
    zowe_command: str = os.getenv("ZOWE_COMMAND", "zowe")
    hlq: str = os.getenv("MAINFRAME_HLQ", "Z86073")
    expense_cluster: str = os.getenv("EXPENSE_CLUSTER", "Z86073.EXPTRK.MASTER")
    transaction_dataset: str = os.getenv("TRANSACTION_DATASET", "Z86073.EXPTRK.TRAN")
    transaction_dataset_mode: str = os.getenv("TRANSACTION_DATASET_MODE", "per-batch").lower()
    transaction_dataset_prefix: str = os.getenv("TRANSACTION_DATASET_PREFIX", "Z86073.EXPTRK.TXN")
    result_dataset_prefix: str = os.getenv("RESULT_DATASET_PREFIX", "Z86073.EXPTRK.RES")
    transaction_volume: str = os.getenv("TRANSACTION_VOLUME", "ZXPC02")
    transaction_device_type: str = os.getenv("TRANSACTION_DEVICE_TYPE", "3390")
    allocation_timeout_seconds: int = int(os.getenv("ALLOCATION_TIMEOUT_SECONDS", "90"))
    result_dataset: str = os.getenv("RESULT_DATASET", "Z86073.EXPTRK.RESULT")
    report_dataset: str = os.getenv("REPORT_DATASET", "Z86073.EXPTRK.REPORT")
    employee_dataset: str = os.getenv("EMPLOYEE_DATASET", "Z86073.EXPTRK.EMPLOYEE")
    post_jcl: str = os.getenv("POST_JCL", "mainframe/jcl/EXPPOST.jcl")
    report_jcl: str = os.getenv("REPORT_JCL", "mainframe/jcl/EXPRPT.jcl")
    monitor_jcl: str = os.getenv("MONITOR_JCL", "mainframe/jcl/EXPMON.jcl")
    timeout_seconds: int = int(os.getenv("ZOWE_TIMEOUT_SECONDS", "30"))
    frontend_origin: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")


settings = Settings()
