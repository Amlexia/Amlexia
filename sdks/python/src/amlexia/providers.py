from __future__ import annotations

from typing import Any, Dict, Optional

PROVIDER_HOSTS = {
    "openai": ["api.openai.com", "openai.azure.com"],
    "anthropic": ["api.anthropic.com"],
    "stripe": ["api.stripe.com"],
    "clerk": ["api.clerk.com", "clerk.accounts.dev"],
    "twilio": ["api.twilio.com"],
    "resend": ["api.resend.com"],
    "supabase": ["supabase.co"],
}


def detect_provider(
    provider: Optional[str] = None,
    endpoint: Optional[str] = None,
    host: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Optional[str]]:
    if provider:
        name = provider.lower().replace(" ", "")
        for key in PROVIDER_HOSTS:
            if key in name:
                return {"name": key, "category": _category(key), "model_name": _model(metadata)}
        return {"name": name, "category": "unknown", "model_name": _model(metadata)}

    text = f"{endpoint or ''} {host or ''}".lower()
    for key in PROVIDER_HOSTS:
        if key in text:
            return {"name": key, "category": _category(key), "model_name": _model(metadata)}

    return {"name": "unknown", "category": "unknown", "model_name": _model(metadata)}


def _category(name: str) -> str:
    if name in ("openai", "anthropic", "gemini", "groq", "togetherai", "replicate"):
        return "ai"
    if name in ("stripe", "razorpay", "paypal"):
        return "payments"
    if name in ("twilio", "resend", "sendgrid"):
        return "messaging"
    if name == "clerk":
        return "auth"
    if name in ("supabase", "firebase", "aws"):
        return "infrastructure"
    return "unknown"


def _model(metadata: Optional[Dict[str, Any]]) -> Optional[str]:
    if not metadata:
        return None
    for k in ("model", "model_name", "modelName"):
        v = metadata.get(k)
        if isinstance(v, str):
            return v
    return None
