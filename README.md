# Amlexia SDKs

Official client libraries for [Amlexia](https://amlexia.com) — operational intelligence for APIs, AI providers, payments, and infrastructure.

| Package | Registry | Install |
|---------|----------|---------|
| **Node.js** | [npm `@amlexiahq/node`](https://www.npmjs.com/package/@amlexiahq/node) | `npm install @amlexiahq/node` |
| **Python** | [PyPI `amlexia`](https://pypi.org/project/amlexia/) | `pip install amlexia` |
| **Shared (Node)** | [npm `@amlexiahq/shared`](https://www.npmjs.com/package/@amlexiahq/shared) | Dependency of `@amlexiahq/node` |

- **Dashboard:** https://app.amlexia.com  
- **Ingest API:** https://ingest.amlexia.com  
- **Support:** support@amlexia.com  
- **Status:** https://status.amlexia.com  

> **License:** Proprietary — not open source. See [LICENSE](./LICENSE). Use is subject to the [Terms of Service](https://amlexia.com/terms).

---

## Documentation

| Doc | Description |
|-----|-------------|
| [Getting started](./docs/GETTING_STARTED.md) | Account, first event, dashboard |
| [Environment variables](./docs/ENVIRONMENT_VARIABLES.md) | All `AMLEXIA_*` and related env vars |
| [Event fields](./docs/EVENT_FIELDS.md) | Every `track()` field and ingest mapping |
| [Node.js SDK](./sdks/node/README.md) | API reference, Express, Fastify, Hono, Next.js, OTEL |
| [Python SDK](./sdks/python/README.md) | API reference, FastAPI, Flask, Django |
| [@amlexiahq/shared](./packages/shared/README.md) | Tracing IDs, provider detection, PII scrubbing |
| [Examples](./examples/README.md) | Runnable samples |
| [Publishing](./PUBLISHING.md) | Release process for maintainers |

---

## Quick start

### Node.js

```typescript
import { AmlexiaClient } from '@amlexiahq/node';

const client = new AmlexiaClient({
  sdkKey: process.env.AMLEXIA_SDK_KEY!,
  ingestUrl: process.env.AMLEXIA_INGEST_URL ?? 'https://ingest.amlexia.com',
});

await client.track({
  endpoint: 'POST /v1/chat',
  method: 'POST',
  statusCode: 200,
  latencyMs: 320,
  provider: 'openai',
  tokensInput: 120,
  tokensOutput: 80,
});

await client.shutdown();
```

### Python

```python
from amlexia import AmlexiaClient

client = AmlexiaClient.from_env()
client.track("POST /v1/chat", "POST", 200, 320, provider="openai", tokens_input=120, tokens_output=80)
client.shutdown()
```

---

## Repository layout

```
packages/shared/     @amlexiahq/shared — tracing, providers, scrubber
sdks/node/           @amlexiahq/node — Node.js SDK + framework middleware
sdks/python/         amlexia — Python SDK + framework integrations
examples/            Minimal Express and FastAPI samples
docs/                Cross-SDK guides
```

---

## How ingestion works

1. Your app calls `track()` (or middleware does it automatically).
2. Events are **buffered** and sent in batches to `POST /v1/events`.
3. Default flush: every **5 seconds** or **50 events** (configurable).
4. On shutdown, call `shutdown()` to flush remaining events.

Retries use exponential backoff (up to 5 attempts by default).

---

## Framework support

| Framework | Node | Python |
|-----------|------|--------|
| Express | `@amlexiahq/node/express` | — |
| Fastify | `@amlexiahq/node/fastify` | — |
| Hono | `@amlexiahq/node/hono` | — |
| Next.js App Router | `@amlexiahq/node/next` | — |
| FastAPI | — | `amlexia.fastapi_integration` |
| Flask | — | `amlexia.flask_integration` |
| Django | — | `amlexia.django_integration` |

---

## Develop from source

```bash
pnpm install
pnpm build
pnpm typecheck
```

---

## Support

- Email: support@amlexia.com  
- Contact: https://amlexia.com/contact  
- Security: https://amlexia.com/security  
