# Getting started with Amlexia

> **Canonical docs:** https://docs.amlexia.com — this file is a short mirror for the GitHub repo.

## 1. Create an account

1. Sign up at [app.amlexia.com](https://app.amlexia.com/signup).
2. Create an **organization** and **project**.
3. Copy the **SDK key** (`am_...`) from project settings.

## 2. Install an SDK

| Language | Install |
|----------|---------|
| Node.js | `npm install @amlexiahq/node` |
| Python | `pip install amlexia` |
| Go | `go get github.com/amlexiahq/amlexia-go` |
| Ruby | `gem install amlexia` |

## 3. Send your first event

**Node.js**

```typescript
import { AmlexiaClient } from '@amlexiahq/node';

const client = AmlexiaClient.fromEnv();

await client.track({
  endpoint: 'GET /health',
  method: 'GET',
  statusCode: 200,
  latencyMs: 12,
  environment: process.env.AMLEXIA_ENVIRONMENT,
});

await client.shutdown();
```

**Python**

```python
from amlexia import AmlexiaClient

client = AmlexiaClient.from_env()
client.track("GET /health", "GET", 200, 12, environment="production")
client.shutdown()
```

## 4. Verify

```bash
npx amlexia health   # Node
amlexia health       # Python
```

Open [app.amlexia.com](https://app.amlexia.com) → Overview or Live.

## 5. Next steps

- [Full documentation](https://docs.amlexia.com/guide/quickstart)
- [AI setup prompts](https://docs.amlexia.com/guide/ai-prompts)
- [SDK feature parity](https://docs.amlexia.com/sdk/feature-parity)
- [Plans & limits](https://docs.amlexia.com/guide/plans-and-limits) (10k events/mo free tier)

Support: support@amlexia.com
