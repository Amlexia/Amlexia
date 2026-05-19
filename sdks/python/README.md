# amlexia

Official **Python SDK** for [Amlexia](https://amlexia.com). Monitor APIs, AI calls, and webhooks from FastAPI, Flask, Django, or plain Python.

```bash
pip install amlexia
```

**License:** Proprietary — not open source. See [LICENSE](./LICENSE).  
**Support:** support@amlexia.com

---

## Table of contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [AmlexiaClient](#amlexiaclient)
- [track() parameters](#track-parameters)
- [Environment variables](#environment-variables)
- [FastAPI](#fastapi)
- [Flask](#flask)
- [Django](#django)
- [Distributed tracing](#distributed-tracing)
- [Provider detection](#provider-detection)
- [Errors and retries](#errors-and-retries)
- [Best practices](#best-practices)

Cross-SDK docs: [Environment variables](../../docs/ENVIRONMENT_VARIABLES.md) · [Event fields](../../docs/EVENT_FIELDS.md)

---

## Installation

```bash
pip install amlexia
```

Optional extras:

```bash
pip install "amlexia[fastapi]"
pip install "amlexia[flask]"
```

---

## Quick start

```python
import os
from amlexia import AmlexiaClient

client = AmlexiaClient(
    sdk_key=os.environ["AMLEXIA_SDK_KEY"],
    ingest_url=os.environ.get("AMLEXIA_INGEST_URL", "https://ingest.amlexia.com"),
)

client.track(
    endpoint="GET /health",
    method="GET",
    status_code=200,
    latency_ms=12,
)

client.shutdown()
```

### From environment

```python
from amlexia import AmlexiaClient

client = AmlexiaClient.from_env()
# Reads: AMLEXIA_SDK_KEY, AMLEXIA_INGEST_URL, AMLEXIA_ENVIRONMENT, AMLEXIA_RELEASE
```

---

## AmlexiaClient

### Constructor

```python
AmlexiaClient(
    sdk_key: str,                          # Required
    ingest_url: str | None = None,         # Default: https://ingest.amlexia.com
    flush_interval_seconds: float = 5.0,   # Background flush interval
    max_batch_size: int = 50,              # Flush when buffer reaches this size
    max_retries: int = 5,                  # Retries per batch
    environment: str | None = None,        # Applied to every event
    release_version: str | None = None,    # Applied to every event
)
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `sdk_key` | — | **Required.** Project SDK key (`am_...`) |
| `ingest_url` | `https://ingest.amlexia.com` | Ingest API base URL |
| `flush_interval_seconds` | `5.0` | Timer-based flush |
| `max_batch_size` | `50` | Events per HTTP request |
| `max_retries` | `5` | Backoff retries (max delay 30s) |
| `environment` | `None` | Set on all events (e.g. `production`) |
| `release_version` | `None` | Set on all events (e.g. git SHA) |

### Methods

| Method | Description |
|--------|-------------|
| `track(...)` | Queue one event |
| `flush()` | Send buffer now |
| `shutdown()` | Cancel timer, flush all events |
| `from_env()` | Class method — construct from environment variables |

---

## track() parameters

### Required

```python
client.track(
    endpoint="POST /v1/chat",
    method="POST",
    status_code=200,
    latency_ms=430,
)
```

### Optional

```python
client.track(
    endpoint="POST /v1/chat",
    method="POST",
    status_code=200,
    latency_ms=430,
    timestamp=None,                    # Unix seconds; default: now
    request_size_bytes=1024,
    response_size_bytes=4096,
    cost_usd=0.002,
    provider="openai",                 # Auto-detected if omitted
    error_message=None,
    metadata={"plan": "pro"},
    trace_id="...",
    span_id="...",
    parent_span_id="...",
    session_id="sess_abc",
    user_id="user_123",
    service_name="api",
    operation_name="/v1/chat",
    model_name="gpt-4o",
    tokens_input=120,
    tokens_output=80,
    streaming_latency_ms=1200,
    first_token_latency_ms=180,
    cache_hit=False,
    retry_count=0,
    is_webhook=False,
)
```

Python auto-sets `provider_category`, `provider_name`, and `total_tokens` when detection/token fields apply.

Full reference: [Event fields](../../docs/EVENT_FIELDS.md).

---

## Environment variables

| Variable | Used by | Description |
|----------|---------|-------------|
| `AMLEXIA_SDK_KEY` | **Required** for `from_env()` | SDK key |
| `AMLEXIA_INGEST_URL` | Optional | Ingest URL |
| `AMLEXIA_ENVIRONMENT` | `from_env()`, events | Environment label |
| `AMLEXIA_RELEASE` | `from_env()`, events | Release version |
| `AMLEXIA_SERVICE_NAME` | Django middleware | Default `api` |

See [ENVIRONMENT_VARIABLES.md](../../docs/ENVIRONMENT_VARIABLES.md).

---

## FastAPI

```python
from fastapi import FastAPI
from amlexia import AmlexiaClient
from amlexia.fastapi_integration import AmlexiaMiddleware

client = AmlexiaClient.from_env()
app = FastAPI()
app.add_middleware(AmlexiaMiddleware, client=client, service_name="api")

@app.get("/users/{user_id}")
async def get_user(user_id: str):
    return {"user_id": user_id}
```

### Middleware parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `client` | — | **Required.** `AmlexiaClient` instance |
| `service_name` | `"api"` | `service_name` on events |

### Behavior

- Wraps each request with trace + span
- Sets `traceparent` response header
- Normalizes paths (`/users/42` → `/users/:id`)
- Detects provider from path
- Tracks status, latency, errors

### Session / user headers

| Header | Field |
|--------|-------|
| `x-session-id` | `session_id` |
| `x-user-id` | `user_id` |

---

## Flask

Decorator-based tracking per route:

```python
from flask import Flask
from amlexia import AmlexiaClient
from amlexia.flask_integration import amlexia_track

client = AmlexiaClient.from_env()
app = Flask(__name__)

@app.get("/users/<int:user_id>")
@amlexia_track(client)
def get_user(user_id: int):
    return {"user_id": user_id}
```

On exception, records `status_code=500` and `error_message`. Paths are normalized to `/:id` segments.

---

## Django

Add middleware after `SecurityMiddleware`:

```python
# settings.py
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "amlexia.django_integration.AmlexiaMiddleware",
    # ...
]
```

Environment:

```bash
AMLEXIA_SDK_KEY=am_...
AMLEXIA_INGEST_URL=https://ingest.amlexia.com   # optional
AMLEXIA_SERVICE_NAME=api                         # optional, default api
```

`AmlexiaMiddleware` uses `AmlexiaClient.from_env()` when no client is injected.

Optional headers: `HTTP_X_SESSION_ID`, `HTTP_X_USER_ID` (Django `META` format).

---

## Distributed tracing

```python
from amlexia.tracing import create_trace_context, child_span

trace = create_trace_context(
    session_id="sess_1",
    user_id="user_1",
    environment="production",
    release_version="1.4.0",
)
span = child_span(trace)

client.track(
    endpoint="POST /internal/job",
    method="POST",
    status_code=200,
    latency_ms=100,
    trace_id=span.trace_id,
    span_id=span.span_id,
    parent_span_id=span.parent_span_id,
    session_id=trace.session_id,
    user_id=trace.user_id,
)
```

| Function | Description |
|----------|-------------|
| `create_trace_context(**kwargs)` | New trace/span IDs |
| `child_span(parent)` | Child span under parent |

---

## Provider detection

If `provider` is omitted, the SDK inspects `endpoint` and `metadata` for known hosts (OpenAI, Anthropic, Stripe, Clerk, etc.) and sets:

- `provider` / `provider_name`
- `provider_category`
- `model_name` when inferrable

Override with explicit `provider=` when needed.

---

## Errors and retries

| Condition | Behavior |
|-----------|----------|
| HTTP `401` | Raises `ValueError("Invalid SDK key")` |
| HTTP `4xx` | Raises `RuntimeError` (no retry) |
| HTTP `5xx` / network | Retries with backoff |
| Exhausted retries | Raises `RuntimeError`; events re-queued to buffer |

---

## Best practices

1. **Singleton client** per worker process (Gunicorn/Uvicorn).
2. **Call `shutdown()`** on worker exit hooks.
3. **Prefer middleware** for web frameworks — consistent paths and traces.
4. **Use `from_env()`** in production for twelve-factor config.
5. **Do not log SDK keys** or send them from client-side Python in untrusted environments.
6. **Keep `metadata` small** — avoid PII and secrets.

---

## Module reference

| Module | Purpose |
|--------|---------|
| `amlexia` | `AmlexiaClient` |
| `amlexia.fastapi_integration` | `AmlexiaMiddleware` |
| `amlexia.flask_integration` | `amlexia_track` |
| `amlexia.django_integration` | `AmlexiaMiddleware` |
| `amlexia.tracing` | `TraceContext`, `create_trace_context`, `child_span` |

---

## Links

- [Getting started](../../docs/GETTING_STARTED.md)
- [Dashboard](https://app.amlexia.com)
- [Terms](https://amlexia.com/terms) · [Privacy](https://amlexia.com/privacy)
