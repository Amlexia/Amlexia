# @amlexiahq/node

Official **Node.js SDK** for [Amlexia](https://amlexia.com). Ship traces, latency, errors, and provider metrics from Express, Fastify, Hono, Next.js, or custom code.

```bash
npm install @amlexiahq/node
```

**License:** Proprietary — not open source. See [LICENSE](./LICENSE).  
**Support:** support@amlexia.com

---

## Table of contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [AmlexiaClient](#amlexiaclient)
- [track() fields](#track-fields)
- [Environment variables](#environment-variables)
- [Express](#express)
- [Fastify](#fastify)
- [Hono](#hono)
- [Next.js](#nextjs)
- [Distributed tracing](#distributed-tracing)
- [OpenTelemetry bridge](#opentelemetry-bridge)
- [Errors and retries](#errors-and-retries)
- [Best practices](#best-practices)

Cross-SDK docs: [Environment variables](../../docs/ENVIRONMENT_VARIABLES.md) · [Event fields](../../docs/EVENT_FIELDS.md)

---

## Installation

```bash
npm install @amlexiahq/node
```

Peer dependencies (install only what you use):

```bash
npm install express   # for @amlexiahq/node/express
npm install fastify   # for @amlexiahq/node/fastify
npm install hono      # for @amlexiahq/node/hono
```

---

## Quick start

```typescript
import { AmlexiaClient } from '@amlexiahq/node';

const client = new AmlexiaClient({
  sdkKey: process.env.AMLEXIA_SDK_KEY!,
  ingestUrl: process.env.AMLEXIA_INGEST_URL ?? 'https://ingest.amlexia.com',
});

client.track({
  endpoint: 'GET /api/health',
  method: 'GET',
  statusCode: 200,
  latencyMs: 8,
});

// Graceful shutdown — flushes buffered events
process.on('SIGTERM', () => void client.shutdown());
```

---

## AmlexiaClient

### Constructor options

```typescript
new AmlexiaClient({
  sdkKey: string;              // Required — project SDK key (am_...)
  ingestUrl?: string;         // Default: https://ingest.amlexia.com
  flushIntervalMs?: number;   // Default: 5000 — auto-flush interval
  maxBatchSize?: number;      // Default: 50 — flush when buffer reaches this size
  maxRetries?: number;        // Default: 5 — retries per batch on failure
});
```

| Option | Default | Description |
|--------|---------|-------------|
| `sdkKey` | — | **Required.** From dashboard → Project → SDK key |
| `ingestUrl` | `https://ingest.amlexia.com` | Base URL without trailing slash |
| `flushIntervalMs` | `5000` | Background flush interval (ms) |
| `maxBatchSize` | `50` | Max events per HTTP request |
| `maxRetries` | `5` | Exponential backoff retries (cap 30s delay) |

### Methods

| Method | Description |
|--------|-------------|
| `track(event: TrackEvent): void` | Queue one event (sync). Flushes early if batch is full |
| `flush(): Promise<void>` | Send current buffer immediately |
| `shutdown(): Promise<void>` | Stop timer, flush all remaining events |

---

## track() fields

### Required

```typescript
client.track({
  endpoint: 'POST /v1/chat',  // Route or operation name
  method: 'POST',
  statusCode: 200,
  latencyMs: 430,
});
```

### Optional (common)

```typescript
client.track({
  endpoint: 'POST /v1/chat',
  method: 'POST',
  statusCode: 200,
  latencyMs: 430,
  timestamp: Math.floor(Date.now() / 1000), // Unix seconds
  provider: 'openai',
  providerCategory: 'ai',
  modelName: 'gpt-4o',
  tokensInput: 120,
  tokensOutput: 80,
  totalTokens: 200,
  costUsd: 0.0024,
  errorMessage: null,
  metadata: { plan: 'pro' },
  traceId: '...',
  spanId: '...',
  parentSpanId: '...',
  sessionId: 'sess_abc',
  userId: 'user_123',
  environment: 'production',
  releaseVersion: '1.4.0',
  serviceName: 'api',
  operationName: '/v1/chat',
  requestSizeBytes: 1024,
  responseSizeBytes: 4096,
  streamingLatencyMs: 1200,
  firstTokenLatencyMs: 180,
  cacheHit: false,
  retryCount: 0,
  isWebhook: false,
});
```

Full reference: [Event fields](../../docs/EVENT_FIELDS.md).

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `AMLEXIA_SDK_KEY` | **Required** — SDK key |
| `AMLEXIA_INGEST_URL` | Ingest base URL (optional) |
| `AMLEXIA_RELEASE` | Default release on trace context |
| `NODE_ENV` | Default environment on trace context |

See [ENVIRONMENT_VARIABLES.md](../../docs/ENVIRONMENT_VARIABLES.md).

---

## Express

```typescript
import express from 'express';
import { AmlexiaClient } from '@amlexiahq/node';
import { AmlexiaMiddleware } from '@amlexiahq/node/express';

const client = new AmlexiaClient({ sdkKey: process.env.AMLEXIA_SDK_KEY! });
const app = express();

app.use(AmlexiaMiddleware(client, { serviceName: 'api' }));

app.get('/users/:id', (req, res) => {
  res.json({ ok: true });
});

app.listen(3000);
```

### Middleware options

| Option | Default | Description |
|--------|---------|-------------|
| `serviceName` | `'api'` | `serviceName` on tracked events |

### Behavior

- Creates trace + span per request
- Sets response header `traceparent` (W3C format)
- Normalizes paths (`/users/42` → `/users/:id`)
- Auto-detects provider from route/host hints
- Tracks on `res.finish` with status and latency

### Session / user headers

| Header | Attached to event |
|--------|-------------------|
| `x-session-id` | `sessionId` |
| `x-user-id` | `userId` |

---

## Fastify

```typescript
import Fastify from 'fastify';
import { AmlexiaClient } from '@amlexiahq/node';
import { amlexiaPlugin } from '@amlexiahq/node/fastify';

const client = new AmlexiaClient({ sdkKey: process.env.AMLEXIA_SDK_KEY! });
const app = Fastify();

await app.register(amlexiaPlugin(client, { serviceName: 'api' }));
```

Same options and behavior as Express (`serviceName`, path normalization, `traceparent`).

---

## Hono

```typescript
import { Hono } from 'hono';
import { AmlexiaClient } from '@amlexiahq/node';
import { amlexiaHonoMiddleware } from '@amlexiahq/node/hono';

const client = new AmlexiaClient({ sdkKey: process.env.AMLEXIA_SDK_KEY! });
const app = new Hono();

app.use('*', amlexiaHonoMiddleware(client, { serviceName: 'api' }));
```

---

## Next.js

Wrap App Router route handlers:

```typescript
import { AmlexiaClient } from '@amlexiahq/node';
import { withAmlexia } from '@amlexiahq/node/next';

const client = new AmlexiaClient({ sdkKey: process.env.AMLEXIA_SDK_KEY! });

export const GET = withAmlexia(
  client,
  async (request) => {
    return Response.json({ ok: true });
  },
  { route: '/api/hello', serviceName: 'nextjs' },
);
```

### `withAmlexia` options

| Option | Description |
|--------|-------------|
| `route` | Static route pattern for cardinality control (e.g. `/api/users/[id]`) |
| `serviceName` | Default `nextjs` |

Tracks status, latency, and errors (including thrown exceptions → 500).

---

## Distributed tracing

```typescript
import {
  createTraceContext,
  childSpan,
  applyTraceToEvent,
} from '@amlexiahq/node/tracing';

const trace = createTraceContext({
  sessionId: 'sess_1',
  userId: 'user_1',
  environment: 'production',
  releaseVersion: process.env.AMLEXIA_RELEASE,
});

const span = childSpan(trace);

client.track(
  applyTraceToEvent(
    {
      endpoint: 'POST /internal/job',
      method: 'POST',
      statusCode: 200,
      latencyMs: 100,
    },
    span,
  ),
);
```

| Function | Description |
|----------|-------------|
| `createTraceContext(partial?)` | New trace id + span id; fills env from `NODE_ENV` / `AMLEXIA_RELEASE` |
| `childSpan(parent)` | New span under parent |
| `applyTraceToEvent(event, ctx)` | Merges trace fields into a `TrackEvent` |

---

## OpenTelemetry bridge

Map OTEL spans into Amlexia events (sends via `/v1/events`, not a separate OTEL ingest):

```typescript
import { AmlexiaClient } from '@amlexiahq/node';
import { exportOtelSpans, type OtelSpanInput } from '@amlexiahq/node/otel';

const spans: OtelSpanInput[] = [/* from your OTEL exporter */];
exportOtelSpans(client, spans);
```

`OtelSpanInput` fields: `traceId`, `spanId`, `parentSpanId`, `name`, `startTimeUnixNano`, `endTimeUnixNano`, `status`, `attributes`.

---

## Errors and retries

| HTTP status | Behavior |
|-------------|----------|
| `401` | Throws `Invalid SDK key` (no retry) |
| `4xx` (other) | Throws with body (no retry) |
| `5xx` / network | Retries with exponential backoff |

Failed batches are **re-queued** to the buffer after exhausted retries.

---

## Best practices

1. **One client per process** — reuse a singleton `AmlexiaClient`.
2. **Call `shutdown()`** on SIGTERM/SIGINT in servers and serverless `finally` blocks.
3. **Use middleware** for HTTP so paths are normalized and traces are consistent.
4. **Never expose `AMLEXIA_SDK_KEY` in browsers** — instrument backend only.
5. **Set `releaseVersion`** via `AMLEXIA_RELEASE` for deploy correlation.
6. **Avoid high-cardinality endpoints** — use parameterized routes, not raw URLs with IDs in middleware-covered apps.

---

## Package exports

| Import path | Contents |
|-------------|----------|
| `@amlexiahq/node` | `AmlexiaClient`, types |
| `@amlexiahq/node/express` | `AmlexiaMiddleware` |
| `@amlexiahq/node/fastify` | `amlexiaPlugin` |
| `@amlexiahq/node/hono` | `amlexiaHonoMiddleware` |
| `@amlexiahq/node/next` | `withAmlexia` |
| `@amlexiahq/node/tracing` | `createTraceContext`, `childSpan`, `applyTraceToEvent` |
| `@amlexiahq/node/otel` | `exportOtelSpans` |

---

## Links

- [Getting started](../../docs/GETTING_STARTED.md)
- [Amlexia dashboard](https://app.amlexia.com)
- [Terms](https://amlexia.com/terms) · [Privacy](https://amlexia.com/privacy)
