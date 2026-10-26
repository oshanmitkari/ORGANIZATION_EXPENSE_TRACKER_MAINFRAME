from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path


def now(): return datetime.now(timezone.utc)


class JobRepository:
    def __init__(self, path: Path):
        self.path, self.lock = path, threading.RLock()
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def _read(self):
        if not self.path.exists(): return {}
        return json.loads(self.path.read_text())

    def _write(self, data):
        tmp = self.path.with_suffix(f".{uuid.uuid4().hex}.tmp")
        tmp.write_text(json.dumps(data, indent=2, default=str)); tmp.replace(self.path)

    def create(self, expense: dict):
        with self.lock:
            data = self._read()
            for item in data.values():
                if item["expense_id"] == expense["expense_id"]:
                    return item
            request_id = str(uuid.uuid4())
            stamp = now().isoformat()
            item = {"request_id": request_id, **expense, "status": "queued",
                    "created_at": stamp, "updated_at": stamp}
            data[request_id] = item; self._write(data); return item

    def get(self, request_id):
        with self.lock: return self._read().get(request_id)

    def update(self, request_id, **changes):
        with self.lock:
            data = self._read(); item = data[request_id]; item.update(changes, updated_at=now().isoformat())
            self._write(data); return item

    def all(self):
        with self.lock: return list(self._read().values())
