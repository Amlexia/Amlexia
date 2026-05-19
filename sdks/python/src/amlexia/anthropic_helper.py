from __future__ import annotations

from typing import Any, Optional

from .client import AmlexiaClient
from .cost import enrich_event_cost


def track_anthropic_message(
    client: AmlexiaClient,
    *,
    model: str,
    status_code: int,
    latency_ms: int,
    usage: Optional[dict[str, Any]] = None,
    cost_usd: Optional[float] = None,
    error_message: Optional[str] = None,
    trace_id: Optional[str] = None,
) -> None:
    usage = usage or {}
    tokens_in = usage.get("input_tokens")
    tokens_out = usage.get("output_tokens")
    event = enrich_event_cost(
        {
            "cost_usd": cost_usd,
            "model_name": model,
            "provider": "anthropic",
            "tokens_input": tokens_in,
            "tokens_output": tokens_out,
        }
    )
    client.track(
        endpoint="/v1/messages",
        method="POST",
        status_code=status_code,
        latency_ms=latency_ms,
        provider="anthropic",
        model_name=model,
        tokens_input=tokens_in,
        tokens_output=tokens_out,
        cost_usd=event.get("cost_usd"),
        error_message=error_message,
        trace_id=trace_id,
    )
