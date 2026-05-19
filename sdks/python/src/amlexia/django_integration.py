from __future__ import annotations

import os
import re
import time
from typing import Callable, Optional

from .client import AmlexiaClient
from .providers import detect_provider
from .tracing import child_span, create_trace_context

_ID_PATTERN = re.compile(
    r"/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.I
)
_NUM_PATTERN = re.compile(r"/\d+")


class AmlexiaMiddleware:
    """Django middleware — add to MIDDLEWARE after SecurityMiddleware."""

    def __init__(self, get_response: Callable, client: Optional[AmlexiaClient] = None):
        self.get_response = get_response
        self.client = client or AmlexiaClient.from_env()
        self.service_name = os.environ.get("AMLEXIA_SERVICE_NAME", "api")

    def __call__(self, request):
        trace = create_trace_context(
            session_id=request.META.get("HTTP_X_SESSION_ID"),
            user_id=request.META.get("HTTP_X_USER_ID"),
        )
        span = child_span(trace)
        start = time.time()

        response = self.get_response(request)
        response["traceparent"] = f"00-{trace.trace_id}-{span.span_id}-01"

        path = _normalize_path(request.path)
        detected = detect_provider(endpoint=path)
        latency_ms = int((time.time() - start) * 1000)

        self.client.track(
            endpoint=f"{request.method} {path}",
            method=request.method,
            status_code=response.status_code,
            latency_ms=latency_ms,
            service_name=self.service_name,
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
