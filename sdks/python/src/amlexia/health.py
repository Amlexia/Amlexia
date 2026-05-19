from __future__ import annotations

import time
from typing import Any, Dict
from urllib import request as urllib_request

DEFAULT_INGEST_URL = "https://ingest.amlexia.com"


def check_ingest_health(ingest_url: str = DEFAULT_INGEST_URL, timeout: float = 5.0) -> Dict[str, Any]:
    base = ingest_url.rstrip("/")
    start = time.time()
    try:
        req = urllib_request.Request(f"{base}/health", method="GET")
        with urllib_request.urlopen(req, timeout=timeout) as resp:
            return {
                "ok": 200 <= resp.status < 300,
                "status": resp.status,
                "latency_ms": int((time.time() - start) * 1000),
            }
    except Exception:
        return {"ok": False, "status": 0, "latency_ms": int((time.time() - start) * 1000)}
