from __future__ import annotations

import re
import time
from functools import wraps
from typing import Any, Callable

from .client import AmlexiaClient

_ID_PATTERN = re.compile(
    r"/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.I
)
_NUM_PATTERN = re.compile(r"/\d+")


def amlexia_track(client: AmlexiaClient) -> Callable:
    def decorator(fn: Callable) -> Callable:
        @wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            start = time.time()
            from flask import request, g

            try:
                result = fn(*args, **kwargs)
                status_code = getattr(g, "amlexia_status", 200)
                return result
            except Exception as exc:
                status_code = 500
                error_message = str(exc)
                raise
            finally:
                latency_ms = int((time.time() - start) * 1000)
                path = _normalize_path(request.path)
                client.track(
                    endpoint=f"{request.method} {path}",
                    method=request.method,
                    status_code=status_code,
                    latency_ms=latency_ms,
                    error_message=locals().get("error_message"),
                )

        return wrapper

    return decorator


def _normalize_path(path: str) -> str:
    path = _ID_PATTERN.sub("/:id", path)
    return _NUM_PATTERN.sub("/:id", path)
