# Getting started with Amlexia

## 1. Create an account

1. Sign up at [app.amlexia.com](https://app.amlexia.com/signup).
2. Create an **organization** and **project**.
3. Copy the **SDK key** (`am_...`) from project settings.

## 2. Install an SDK

**Node.js**

```bash
npm install @amlexiahq/node
```

**Python**

```bash
pip install amlexia
```

## 3. Send your first event

**Node.js**

```typescript
import { AmlexiaClient } from '@amlexiahq/node';

const client = new AmlexiaClient({
  sdkKey: process.env.AMLEXIA_SDK_KEY!,
});

await client.track({
  endpoint: 'GET /health',
  method: 'GET',
  statusCode: 200,
  latencyMs: 12,
});

await client.shutdown();
```

**Python**

```python
import os
from amlexia import AmlexiaClient

client = AmlexiaClient(sdk_key=os.environ["AMLEXIA_SDK_KEY"])
client.track("GET /health", "GET", 200, 12)
client.shutdown()
```

## 4. Confirm in the dashboard

Open [app.amlexia.com](https://app.amlexia.com) → your project. Within a minute you should see traffic on the dashboard and live stream.

## 5. Instrument your app (recommended)

| Stack | Guide |
|-------|--------|
| **AI assistant (fastest)** | [AI setup prompts](./AI_SETUP_PROMPTS.md) — copy-paste for your stack |
| Express | [sdks/node/README.md#express](../sdks/node/README.md#express) |
| Fastify / Hono / Next.js | [sdks/node/README.md](../sdks/node/README.md) |
| FastAPI / Flask / Django | [sdks/python/README.md](../sdks/python/README.md) |

## 6. Configure environment

See [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md).

## Troubleshooting

| Symptom | Check |
|---------|--------|
| `Invalid SDK key` | Key matches project; not revoked |
| No data in dashboard | `AMLEXIA_INGEST_URL` correct; call `shutdown()` or wait for flush interval |
| 401 from ingest | SDK key in server env only, not browser |
| High cardinality endpoints | Use framework middleware (paths normalized) |

Support: **support@amlexia.com**
