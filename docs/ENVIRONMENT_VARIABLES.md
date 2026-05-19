# Environment variables

Variables used by Amlexia SDKs and recommended for your application.

## Required

| Variable | Used by | Description |
|----------|---------|-------------|
| `AMLEXIA_SDK_KEY` | Node, Python | Project SDK key from [app.amlexia.com](https://app.amlexia.com) → Project → Settings. Format: `am_...` |

## Recommended

| Variable | Used by | Default | Description |
|----------|---------|---------|-------------|
| `AMLEXIA_INGEST_URL` | Node, Python | `https://ingest.amlexia.com` | Ingest API base URL (no trailing slash). Use for staging or local dev. |
| `AMLEXIA_ENVIRONMENT` | Python `from_env()`, event fields | — | Logical environment label, e.g. `production`, `staging`, `development`. |
| `AMLEXIA_RELEASE` | Node tracing, Python `from_env()` | — | App release / git SHA shown on events, e.g. `1.2.3` or `abc1234`. |
| `AMLEXIA_SERVICE_NAME` | Django middleware | `api` | Service name tag on HTTP events. |

## Node.js only

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Used as default `environment` on trace context when not set on the event. |

## Optional HTTP headers (middleware)

Pass through your API gateway or app to attach user/session context. Middleware reads these and attaches them to traces/events.

| Header | Description |
|--------|-------------|
| `x-session-id` | End-user or browser session identifier |
| `x-user-id` | Authenticated user identifier |

## Local development

| Variable | Example | Description |
|----------|---------|-------------|
| `AMLEXIA_INGEST_URL` | `http://localhost:8787` | Point to local API worker when running `pnpm dev:workers` in the full platform repo |

## Security

- **Never** commit `AMLEXIA_SDK_KEY` to git or ship it in frontend bundles.
- Use server-side instrumentation only, or proxy ingest through your backend.
- Rotate keys in the dashboard if exposed.

## Python: load from environment

```python
from amlexia import AmlexiaClient

client = AmlexiaClient.from_env()  # reads AMLEXIA_SDK_KEY, AMLEXIA_INGEST_URL, AMLEXIA_ENVIRONMENT, AMLEXIA_RELEASE
```

## Node.js: typical pattern

```typescript
const client = new AmlexiaClient({
  sdkKey: process.env.AMLEXIA_SDK_KEY!,
  ingestUrl: process.env.AMLEXIA_INGEST_URL,
});
```
