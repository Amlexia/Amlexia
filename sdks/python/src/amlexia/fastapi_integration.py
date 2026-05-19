from __future__ import annotations

import re
import time
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from .client import AmlexiaClient
from .providers import detect_provider
from .tracing import child_span, create_trace_context

_ID_PATTERN = re.compile(
    r"/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.I
)
_NUM_PATTERN = re.compile(r"/\d+")


class AmlexiaMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app: Callable,
        client: AmlexiaClient,
        service_name: str = "api",
    ) -> None:
        super().__init__(app)
        self._client = client
        self._service_name = service_name

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        trace = create_trace_context(
            session_id=request.headers.get("x-session-id"),
            user_id=request.headers.get("x-user-id"),
        )
        span = child_span(trace)
        start = time.time()

        response = await call_next(request)
        response.headers["traceparent"] = f"00-{trace.trace_id}-{span.span_id}-01"

        path = _normalize_path(request.url.path)
        detected = detect_provider(endpoint=path)
        latency_ms = int((time.time() - start) * 1000)

        self._client.track(
            endpoint=f"{request.method} {path}",
            method=request.method,
            status_code=response.status_code,
            latency_ms=latency_ms,
            service_name=self._service_name,
            operation_name=path,
            provider=detected["name"] if detected["name"] != "unknown" else None,
            error_message=(
                f"HTTP {response.status_code}" if response.status_code >= 400 else None
            ),
            trace_id=span.trace_id,
            span_id=span.span_id,
            parent_span_id=span.parent_span_id,
            session_id=trace.session_id,
            user_id=trace.user_id,
        )
        return response


def _normalize_path(path: str) -> str:
    path = _ID_PATTERN.sub("/:id", path)
    return _NUM_PATTERN.sub("/:id", path)
