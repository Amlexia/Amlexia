"""Token cost estimation (mirrors @amlexiahq/shared pricing table)."""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

MODEL_PRICES: Dict[str, Dict[str, float]] = {
    "gpt-4o-mini": {"input": 0.15, "output": 0.6},
    "gpt-4o": {"input": 2.5, "output": 10},
    "claude-3-5-haiku": {"input": 0.8, "output": 4},
    "claude-3-5-sonnet": {"input": 3, "output": 15},
    "gemini-2.0-flash": {"input": 0.1, "output": 0.4},
}

PROVIDER_DEFAULT = {
    "openai": "gpt-4o-mini",
    "anthropic": "claude-3-5-haiku",
    "google": "gemini-2.0-flash",
}


def estimate_cost_usd(
    *,
    cost_usd: Optional[float] = None,
    model_name: Optional[str] = None,
    provider: Optional[str] = None,
    tokens_input: Optional[int] = None,
    tokens_output: Optional[int] = None,
    total_tokens: Optional[int] = None,
) -> Tuple[Optional[float], Optional[str]]:
    if cost_usd is not None and cost_usd > 0:
        return cost_usd, "reported"

    key = (model_name or "").lower()
    price = MODEL_PRICES.get(key)
    if not price and provider:
        default = PROVIDER_DEFAULT.get(provider.lower())
        if default:
            price = MODEL_PRICES.get(default)
    if not price:
        return cost_usd, None

    inp = tokens_input or 0
    out = tokens_output or 0
    if inp == 0 and out == 0:
        if not total_tokens:
            return cost_usd, None
        blended = (price["input"] + price["output"]) / 2
        return (total_tokens / 1_000_000) * blended, "estimated"

    est = (inp / 1_000_000) * price["input"] + (out / 1_000_000) * price["output"]
    return round(est, 8), "estimated"


def enrich_event_cost(event: Dict[str, Any]) -> Dict[str, Any]:
    cost, _source = estimate_cost_usd(
        cost_usd=event.get("cost_usd"),
        model_name=event.get("model_name"),
        provider=event.get("provider") or event.get("provider_name"),
        tokens_input=event.get("tokens_input"),
        tokens_output=event.get("tokens_output"),
        total_tokens=event.get("total_tokens"),
    )
    if cost is not None:
        event["cost_usd"] = cost
    return event
