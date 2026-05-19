# AI setup prompts — complete integration guide for IDEs & agents

Copy a prompt into **Cursor, Copilot, ChatGPT, Claude, Windsurf, or any coding agent**. These prompts include every command, URL, package name, env var, cost/payment pattern, and verification step so the agent does not need prior Amlexia context.

**Human quick start**

1. Sign up: https://app.amlexia.com/signup  
2. Create **organization** → **project** → copy **SDK key** (`am_...`) from Settings  
3. Set `AMLEXIA_SDK_KEY` in server environment only (never browser / `NEXT_PUBLIC_`)  
4. Production ingest: `https://ingest.amlexia.com`  
5. Docs: https://docs.amlexia.com · Support: support@amlexia.com  

| Resource | URL |
|----------|-----|
| Dashboard | https://app.amlexia.com |
| Ingest API | https://ingest.amlexia.com |
| Docs | https://docs.amlexia.com |
| Marketing / pricing | https://amlexia.com/pricing |
| Status | https://status.amlexia.com |
| SDK repo | https://github.com/Amlexia/Amlexia |
| npm Node SDK | `@amlexiahq/node` |
| npm shared | `@amlexiahq/shared` (dependency of Node SDK) |
| PyPI | `amlexia` |

---

## Master prompt (recommended — paste this first)

Use this **single prompt** for any stack. It contains full product context so the AI does not need other files.

```text
You are a senior engineer integrating Amlexia observability into my codebase. You have NO prior context — follow ONLY this spec.

═══════════════════════════════════════════════════════════════
1. WHAT AMLEXIA IS
═══════════════════════════════════════════════════════════════
Amlexia is operational intelligence (lightweight APM) for backends:
- Inbound HTTP APIs (Express, FastAPI, Next.js routes, etc.)
- Outbound calls to AI (OpenAI, Anthropic, Gemini, Groq, …), payments (Stripe, Razorpay, PayPal), auth (Clerk), messaging (Twilio, Resend, SendGrid), infra (AWS, Supabase, Firebase)
- Distributed traces, live request stream, alerts, provider dashboards

Data flow:
  My server ──SDK──► https://ingest.amlexia.com/v1/events
  My team   ──browser──► https://app.amlexia.com (Clerk login, NOT the SDK key)

Amlexia does NOT run my business logic. It does NOT call OpenAI/Stripe for me.
Amlexia does NOT auto-bill me. It does NOT compute $ cost from public price lists today — I must send cost_usd when I want dollar charts (see section 6).

═══════════════════════════════════════════════════════════════
2. ACCOUNT & KEYS (do this first)
═══════════════════════════════════════════════════════════════
1. User signs up at https://app.amlexia.com/signup
2. Creates Organization + Project in dashboard
3. Copies SDK key from Project → Settings (format: am_xxxxxxxx...)
4. Sets in SERVER env only:
   AMLEXIA_SDK_KEY=am_...
   AMLEXIA_INGEST_URL=https://ingest.amlexia.com   # optional; default shown
   AMLEXIA_ENVIRONMENT=production                   # optional
   AMLEXIA_RELEASE=1.0.0                            # optional git SHA / version
   AMLEXIA_SERVICE_NAME=api                         # optional; Django uses this

NEVER:
- AMLEXIA_SDK_KEY in frontend, mobile, NEXT_PUBLIC_*, or committed .env with real values
- SDK key in git — use .env.example with placeholder am_your_key_here

═══════════════════════════════════════════════════════════════
3. INSTALL COMMANDS (exact package names)
═══════════════════════════════════════════════════════════════
Node.js:
  npm install @amlexiahq/node
  # or: pnpm add @amlexiahq/node / yarn add @amlexiahq/node

Python:
  pip install amlexia
  # FastAPI extras: pip install "amlexia[fastapi]"
  # Flask extras:   pip install "amlexia[flask]"

Do NOT use @amlexia/node (wrong scope). Published org is @amlexiahq.

═══════════════════════════════════════════════════════════════
4. FRAMEWORK SETUP (pick one)
═══════════════════════════════════════════════════════════════

── Node.js — Express ──
import express from 'express';
import { AmlexiaClient } from '@amlexiahq/node';
import { AmlexiaMiddleware } from '@amlexiahq/node/express';

const client = new AmlexiaClient({
  sdkKey: process.env.AMLEXIA_SDK_KEY!,
  ingestUrl: process.env.AMLEXIA_INGEST_URL ?? 'https://ingest.amlexia.com',
});
const app = express();
app.use(AmlexiaMiddleware(client, { serviceName: 'api' }));
// ... routes ...
process.on('SIGTERM', async () => { await client.shutdown(); process.exit(0); });

── Node.js — Fastify ──
import { AmlexiaClient } from '@amlexiahq/node';
import { amlexiaPlugin } from '@amlexiahq/node/fastify';
await fastify.register(amlexiaPlugin(client, { serviceName: 'api' }));

── Node.js — Hono ──
import { amlexiaHonoMiddleware } from '@amlexiahq/node/hono';
app.use('*', amlexiaHonoMiddleware(client, { serviceName: 'api' }));

── Node.js — Next.js App Router (SERVER ONLY) ──
import { withAmlexia } from '@amlexiahq/node/next';
export const GET = withAmlexia(client, async (req) => Response.json({ ok: true }), {
  route: '/api/hello',
  serviceName: 'nextjs',
});
// Only app/api/**/route.ts — NEVER client components. No NEXT_PUBLIC_ for SDK key.

── Node.js — manual / workers / cron ──
import { AmlexiaClient } from '@amlexiahq/node';
const client = new AmlexiaClient({ sdkKey: process.env.AMLEXIA_SDK_KEY! });
await client.track({ endpoint: 'job/sync', method: 'POST', statusCode: 200, latencyMs: 1200 });
await client.shutdown();

── Python — FastAPI ──
from amlexia import AmlexiaClient
from amlexia.fastapi_integration import AmlexiaMiddleware
client = AmlexiaClient.from_env()
app.add_middleware(AmlexiaMiddleware, client=client, service_name="api")
# lifespan shutdown: client.shutdown()

── Python — Flask ──
from amlexia.flask_integration import amlexia_track
@app.get("/users/<id>")
@amlexia_track(client)
def get_user(id): ...

── Python — Django ──
MIDDLEWARE = ["django.middleware.security.SecurityMiddleware", "amlexia.django_integration.AmlexiaMiddleware", ...]

── OpenTelemetry bridge (Node) ──
import { exportOtelSpans } from '@amlexiahq/node/otel';
exportOtelSpans(client, spans);

═══════════════════════════════════════════════════════════════
5. SDK CLIENT OPTIONS (Node)
═══════════════════════════════════════════════════════════════
new AmlexiaClient({
  sdkKey: string,              // required
  ingestUrl?: string,          // default https://ingest.amlexia.com
  flushIntervalMs?: 5000,      // background batch flush
  maxBatchSize?: 50,           // events per HTTP POST
  maxRetries?: 5,
});
Methods: track(event), flush(), shutdown() — ALWAYS shutdown on SIGTERM.

Python: AmlexiaClient.from_env() reads AMLEXIA_SDK_KEY, AMLEXIA_INGEST_URL, AMLEXIA_ENVIRONMENT, AMLEXIA_RELEASE

═══════════════════════════════════════════════════════════════
6. COST, PAYMENTS & AI USAGE (critical)
═══════════════════════════════════════════════════════════════
Amlexia AGGREGATES cost_usd you send. It does NOT fetch OpenAI/Stripe invoices.

YOU must set cost on events when you want $ dashboards/alerts:
- After OpenAI/Anthropic response: read usage.prompt_tokens, usage.completion_tokens
- Compute USD with YOUR pricing (list price or your contract) OR use usage.cost if API returns it
- Pass costUsd (Node) / cost_usd (Python) on track()

Example Node — OpenAI chat:
  const t0 = Date.now();
  const res = await openai.chat.completions.create({ ... });
  const usage = res.usage;
  await client.track({
    endpoint: 'POST /v1/chat/completions',
    method: 'POST',
    statusCode: 200,
    latencyMs: Date.now() - t0,
    provider: 'openai',
    modelName: res.model,
    tokensInput: usage?.prompt_tokens,
    tokensOutput: usage?.completion_tokens,
    costUsd: estimateOpenAICost(res.model, usage), // implement helper in MY codebase
  });

Example Node — Stripe charge:
  await client.track({
    endpoint: 'POST /v1/payment_intents',
    method: 'POST',
    statusCode: 200,
    latencyMs,
    provider: 'stripe',
    costUsd: amountUsd,  // charge amount or fee you attribute
    metadata: { payment_intent_id: pi.id }, // no card numbers
  });

Example Node — inbound Stripe webhook:
  await client.track({
    endpoint: 'POST /webhooks/stripe',
    method: 'POST',
    statusCode: 200,
    latencyMs,
    provider: 'stripe',
    isWebhook: true,
  });

Auto-detected providers (set provider explicitly if unsure):
  openai, anthropic, gemini, groq, togetherai, replicate,
  stripe, razorpay, paypal,
  twilio, resend, sendgrid,
  clerk, supabase, firebase, aws

If cost_usd omitted → $0 in cost charts (latency/errors/tokens still work).

═══════════════════════════════════════════════════════════════
7. EVENT FIELDS (track / ingest)
═══════════════════════════════════════════════════════════════
Required on every event:
  endpoint (string)     e.g. "GET /api/users/:id" or "POST openai/chat"
  method (string)       GET, POST, etc.
  statusCode / status_code  100-599
  latencyMs / latency_ms    integer milliseconds

Strongly recommended:
  timestamp (Unix seconds) — REQUIRED for raw HTTP curl; SDK sets automatically
  provider, modelName/model_name
  tokensInput/tokens_input, tokensOutput/tokens_output
  costUsd/cost_usd
  traceId, spanId, sessionId, userId
  environment, releaseVersion, serviceName
  errorMessage on failures
  metadata (JSON object, NO secrets/PII/card numbers/API keys)
  isWebhook: true for inbound webhooks

Headers middleware reads (optional):
  x-session-id, x-user-id

Path normalization: middleware rewrites /users/42 → /users/:id

═══════════════════════════════════════════════════════════════
8. RAW INGEST (if not using SDK)
═══════════════════════════════════════════════════════════════
POST https://ingest.amlexia.com/v1/events
Content-Type: application/json
Body:
{
  "sdk_key": "am_...",
  "events": [{
    "endpoint": "GET /health",
    "method": "GET",
    "status_code": 200,
    "latency_ms": 12,
    "timestamp": 1747651200
  }]
}
Also: POST /v1/traces, POST /v1/otel/traces
401 = bad key, 429 = rate limit

═══════════════════════════════════════════════════════════════
9. LOCAL DEV (monorepo operators only)
═══════════════════════════════════════════════════════════════
If user runs full Amlexia platform locally:
  pnpm install && pnpm db:migrate && pnpm dev:workers  # :8787
  pnpm dev:web  # dashboard :5173
  AMLEXIA_INGEST_URL=http://localhost:8787
Most production users only need SDK + cloud ingest URL.

═══════════════════════════════════════════════════════════════
10. YOUR TASKS
═══════════════════════════════════════════════════════════════
1. Detect my language, framework, and entry files from the repo I provide.
2. Install correct package with exact name above.
3. Wire middleware OR manual track() for routes, LLM calls, Stripe/payment calls, webhooks.
4. Implement cost helper for LLM/payment outbound calls OR document why cost is omitted.
5. Create/update .env.example with all AMLEXIA_* vars (placeholder key only).
6. Add graceful shutdown with client.shutdown().
7. Add README section "Observability (Amlexia)" with: signup link, env vars, verify at app.amlexia.com.
8. Do NOT add Amlexia to client-side bundles.

═══════════════════════════════════════════════════════════════
11. ACCEPTANCE CRITERIA
═══════════════════════════════════════════════════════════════
[ ] @amlexiahq/node or amlexia installed
[ ] AMLEXIA_SDK_KEY from env only
[ ] ingest URL https://ingest.amlexia.com in prod
[ ] HTTP routes tracked (normalized paths)
[ ] OpenAI/Stripe/Clerk outbound calls tracked with provider + latency
[ ] costUsd/cost_usd on LLM/payment events where usage/amount known
[ ] shutdown() on process exit
[ ] .env.example updated, no real key in git
[ ] No NEXT_PUBLIC_AMLEXIA or browser exposure

═══════════════════════════════════════════════════════════════
12. MY PROJECT (I will fill this in)
═══════════════════════════════════════════════════════════════
[PASTE: language, framework, package manager, main entry files, where OpenAI/Stripe/Clerk are called, deployment target e.g. Vercel/Railway/Docker, and .env layout]

Now implement. List every file changed with a one-line reason.
```

---

## Universal prompt (shorter)

Same as master but condensed — use if token limits apply.

```text
Integrate Amlexia (https://amlexia.com) — observability for APIs, AI, payments.

Packages: npm install @amlexiahq/node | pip install amlexia
Env (server only): AMLEXIA_SDK_KEY=am_... from app.amlexia.com, AMLEXIA_INGEST_URL=https://ingest.amlexia.com
Never expose SDK key to browser or git.

Wire framework middleware (Express: AmlexiaMiddleware from @amlexiahq/node/express, FastAPI: AmlexiaMiddleware, Next: withAmlexia on route handlers only).
Track outbound OpenAI/Stripe with provider, tokens, latency, costUsd (YOU compute $ from usage — Amlexia does not auto-price).
Call client.shutdown() on SIGTERM. Update .env.example.

My project: [PASTE framework, paths, LLM/payment call sites]
```

---

## Node.js — Express

```text
Integrate Amlexia into my Express.js API.

Install: npm install @amlexiahq/node express

import { AmlexiaClient } from '@amlexiahq/node';
import { AmlexiaMiddleware } from '@amlexiahq/node/express';

const client = new AmlexiaClient({
  sdkKey: process.env.AMLEXIA_SDK_KEY!,
  ingestUrl: process.env.AMLEXIA_INGEST_URL ?? 'https://ingest.amlexia.com',
});
app.use(AmlexiaMiddleware(client, { serviceName: 'api' }));
process.on('SIGTERM', async () => { await client.shutdown(); process.exit(0); });

Also add manual track() after OpenAI/Stripe calls with provider, tokens, costUsd.
Headers x-session-id, x-user-id optional.

.env.example: AMLEXIA_SDK_KEY, AMLEXIA_INGEST_URL, AMLEXIA_RELEASE

My server file and middleware order:
[PASTE]
```

---

## Node.js — Fastify / Hono / Next.js

See master prompt section 4 for exact imports:
- Fastify: `amlexiaPlugin` from `@amlexiahq/node/fastify`
- Hono: `amlexiaHonoMiddleware` from `@amlexiahq/node/hono`
- Next.js: `withAmlexia` from `@amlexiahq/node/next` — Route Handlers only, no NEXT_PUBLIC_

My file:
[PASTE]

---

## Python — FastAPI / Flask / Django

```text
Integrate Amlexia into my Python [FastAPI|Flask|Django] app.

pip install amlexia
# or pip install "amlexia[fastapi]"

client = AmlexiaClient.from_env()
# FastAPI: app.add_middleware(AmlexiaMiddleware, client=client, service_name="api")
# Flask: @amlexia_track(client) on routes
# Django: "amlexia.django_integration.AmlexiaMiddleware" in MIDDLEWARE

After OpenAI/Stripe calls:
client.track(..., provider="openai", tokens_input=..., tokens_output=..., cost_usd=YOUR_ESTIMATE)

client.shutdown() on app shutdown.

My project:
[PASTE main.py / settings.py]
```

---

## Prompt — OpenAI / Anthropic / LLM

```text
Add Amlexia tracking for every LLM API call in my backend.

Package: @amlexiahq/node or amlexia (Python)
Client from env: AMLEXIA_SDK_KEY, ingest https://ingest.amlexia.com

After each completion (including streaming):
- endpoint: e.g. POST /v1/chat/completions
- method: POST
- status_code: 200 or 5xx
- latency_ms: wall clock (first_token_latency_ms for streaming TTFT)
- provider: openai | anthropic | gemini | groq
- model_name: from response
- tokens_input, tokens_output from usage object
- cost_usd / costUsd: compute from public model pricing × tokens (Amlexia does NOT auto-calculate — implement estimateOpenAICost() in my repo)

Do NOT put API keys, raw prompts, or PII in metadata.

My LLM code:
[PASTE files]
```

---

## Prompt — Stripe / Razorpay / PayPal

```text
Add Amlexia tracking for payment provider calls in my backend.

Install: npm install @amlexiahq/node (or pip install amlexia)

For each Stripe API call (payment intents, charges, refunds):
  client.track({
    endpoint: 'POST /v1/payment_intents',  // or actual path
    method: 'POST',
    statusCode: res.status or 200,
    latencyMs,
    provider: 'stripe',
    costUsd: amountInUsd,  // charge amount or platform fee YOU attribute
    metadata: { id: paymentIntent.id },  // no card numbers, no secret keys
  });

For inbound Stripe webhooks:
  provider: 'stripe', isWebhook: true, endpoint: 'POST /webhooks/stripe'

Also track Razorpay/PayPal similarly with provider razorpay | paypal.

My payment code paths:
[PASTE]
```

---

## Prompt — Clerk / auth outbound

```text
Track outbound Clerk API calls with Amlexia.

provider: 'clerk'
endpoint: e.g. GET /v1/users/{id}
Include latency_ms, status_code from Clerk SDK/HTTP response.
No Clerk secret keys in metadata.

My Clerk integration:
[PASTE]
```

---

## Prompt — cost estimation helper (generate code)

```text
Create a small module in my codebase: estimateProviderCost(provider, model, tokensInput, tokensOutput, cacheHit?)

Use public list prices (document source URL in comments) for:
- openai: gpt-4o, gpt-4o-mini, etc. ($ per 1M input/output tokens)
- anthropic: claude models
- gemini, groq as needed

Return USD number. Use in client.track({ ..., costUsd: estimateProviderCost(...) }).

Amlexia stores whatever we send — this is OUR estimate, not Amlexia billing.
Add unit tests with known token counts.

Language: [Node TypeScript | Python]
[PASTE preferred file path]
```

---

## Prompt — verify production readiness

```text
Audit my Amlexia integration:

1. AMLEXIA_SDK_KEY server-side only (grep NEXT_PUBLIC, Vite import.meta, client bundles)
2. Production ingest https://ingest.amlexia.com (not localhost)
3. client.shutdown() / atexit on shutdown
4. No am_ key in git (.env gitignored, .env.example has placeholder)
5. Routes normalized via middleware
6. OpenAI/Stripe/Clerk outbound have provider + latency + cost when applicable
7. .env.example documents AMLEXIA_SDK_KEY, AMLEXIA_INGEST_URL, AMLEXIA_ENVIRONMENT, AMLEXIA_RELEASE

Test command (user runs with their key):
curl -X POST https://ingest.amlexia.com/v1/events -H "Content-Type: application/json" -d '{"sdk_key":"am_...","events":[{"endpoint":"GET /health","method":"GET","status_code":200,"latency_ms":1,"timestamp":UNIX_NOW}]}'

Repo paths:
[PASTE]

Output: checklist pass/fail + exact fixes.
```

---

## Prompt — OpenTelemetry

```text
Bridge existing OpenTelemetry spans to Amlexia.

npm install @amlexiahq/node
import { AmlexiaClient } from '@amlexiahq/node';
import { exportOtelSpans } from '@amlexiahq/node/otel';

const client = new AmlexiaClient({ sdkKey: process.env.AMLEXIA_SDK_KEY! });
// exportOtelSpans(client, spans) when batch ready

Or POST OTLP to https://ingest.amlexia.com/v1/otel/traces with sdk_key in payload.

My OTEL setup:
[PASTE]
```

---

## Reference — environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AMLEXIA_SDK_KEY` | Yes | — | `am_...` from app.amlexia.com |
| `AMLEXIA_INGEST_URL` | No | `https://ingest.amlexia.com` | Ingest base URL |
| `AMLEXIA_ENVIRONMENT` | No | — | `production`, `staging`, … |
| `AMLEXIA_RELEASE` | No | — | Git SHA or version |
| `AMLEXIA_SERVICE_NAME` | No | `api` | Service tag (Django) |

Dashboard (separate from SDK): `VITE_API_URL=https://api.amlexia.com` — only for building apps/web, not for customer apps.

---

## Reference — ingest vs dashboard

| | Ingest | Dashboard |
|--|--------|-----------|
| URL | ingest.amlexia.com | app.amlexia.com |
| Auth | `sdk_key` in JSON body | Clerk JWT |
| Used by | Your server / SDK | Humans in browser |

---

## Tips for IDEs (Cursor / Copilot)

1. Paste the **Master prompt** into Agent/Composer with your repo root.  
2. Fill section 12 with real paths to `server.ts`, `routes/`, OpenAI client, Stripe webhook.  
3. Say **"server only"** for Next.js.  
4. Ask for **cost helper** if you use LLMs heavily.  
5. After merge: deploy with env vars → open app.amlexia.com → Overview/Live/Providers (wait ~60s).  

**Support:** support@amlexia.com · **Docs:** https://docs.amlexia.com/guide/ai-prompts
