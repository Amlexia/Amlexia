"""Distributed tracing helpers for Amlexia Python SDK."""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Optional


@dataclass
class TraceContext:
    trace_id: str
    span_id: str
    parent_span_id: Optional[str] = None
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    environment: Optional[str] = None
    release_version: Optional[str] = None


def create_trace_context(**kwargs: str) -> TraceContext:
    return TraceContext(
        trace_id=kwargs.get("trace_id", uuid.uuid4().hex),
        span_id=kwargs.get("span_id", uuid.uuid4().hex[:16]),
        parent_span_id=kwargs.get("parent_span_id"),
        session_id=kwargs.get("session_id"),
        user_id=kwargs.get("user_id"),
        environment=kwargs.get("environment"),
        release_version=kwargs.get("release_version"),
    )


def child_span(parent: TraceContext) -> TraceContext:
    return TraceContext(
        trace_id=parent.trace_id,
        span_id=uuid.uuid4().hex[:16],
        parent_span_id=parent.span_id,
        session_id=parent.session_id,
        user_id=parent.user_id,
        environment=parent.environment,
        release_version=parent.release_version,
    )
