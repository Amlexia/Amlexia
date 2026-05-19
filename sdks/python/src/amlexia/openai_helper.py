from __future__ import annotations

from typing import Any, Optional

from .client import AmlexiaClient
from .cost import enrich_event_cost


def track_openai_completion(
    client: AmlexiaClient,
    *,
    model: str,
    status_code: int,
    latency_ms: int,
    usage: Optional[dict[str, Any]] = None,
    cost_usd: Optional[float] = None,
    endpoint: str = "/v1/chat/completions",
    error_message: Optional[str] = None,
    trace_id: Optional[str] = None,
    span_id: Optional[str] = None,
) -> None:
    usage = usage or {}
    tokens_in = usage.get("prompt_tokens")
    tokens_out = usage.get("completion_tokens")
    event = enrich_event_cost(
        {
            "cost_usd": cost_usd,
            "model_name": model,
            "provider": "openai",
            "tokens_input": tokens_in,
            "tokens_output": tokens_out,
            "total_tokens": usage.get("total_tokens"),
        }
    )
    client.track(
        endpoint=endpoint,
        method="POST",
        status_code=status_code,
        latency_ms=latency_ms,
        provider="openai",
        model_name=model,
        tokens_input=tokens_in,
        tokens_output=tokens_out,
        total_tokens=usage.get("total_tokens"),
        cost_usd=event.get("cost_usd"),
        error_message=error_message,
        trace_id=trace_id,
        span_id=span_id,
    )
