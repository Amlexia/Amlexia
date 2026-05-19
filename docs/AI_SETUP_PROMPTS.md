# AI setup prompts â€” complete integration guide for IDEs & agents

> **Canonical (always up to date):** https://docs.amlexia.com/guide/ai-prompts  
> This file mirrors the docs site for GitHub. Prefer the web version for the latest edits.
Use these prompts in **Cursor, Copilot, Windsurf, ChatGPT, or Claude** so an agent can integrate Amlexia without prior context. Prompts include all four SDKs, auto cost, alerts, environments, and verification.

::: info Human-readable full guide
For step-by-step setup (not AI), start with **[Complete setup](./full-setup.md)** and **[Using the dashboard](./using-dashboard.md)**.
:::

::: warning Security
Never put `AMLEXIA_SDK_KEY` in the browser, `NEXT_PUBLIC_*`, mobile apps, or git. Get your key from [app.amlexia.com](https://app.amlexia.com) → Project → Settings (`am_...`).
:::

## Before you start

| Step | Action |
|------|--------|
| 1 | Sign up at [app.amlexia.com/signup](https://app.amlexia.com/signup) |
| 2 | Create **organization** and **project** |
| 3 | Copy **SDK key** from Settings |
| 4 | Set `AMLEXIA_SDK_KEY` in **server** environment only |
| 5 | Set `AMLEXIA_ENVIRONMENT=production` (or `staging`) |
| 6 | Confirm events at Overview or Live (~60s) |

| Resource | URL |
|----------|-----|
| Docs | https://docs.amlexia.com |
| Ingest | https://ingest.amlexia.com |
| Dashboard API | https://api.amlexia.com (Clerk JWT — not for SDK) |
| Node | `npm install @amlexiahq/node` |
| Python | `pip install amlexia` |
| Go | `go get github.com/amlexiahq/amlexia-go` |
| Ruby | `gem install amlexia` |
| Plans | Startup free = **10k events/month** |

---

## Master prompt (recommended)

Paste the block below into your agent. Fill **section 12** with your repo paths.

<details>
<summary><strong>Expand — full master prompt</strong></summary>

```text
You are a senior engineer integrating Amlexia observability. You have NO prior context — follow ONLY this spec.

═══════════════════════════════════════════════════════════════
1. WHAT AMLEXIA IS
═══════════════════════════════════════════════════════════════
Operational intelligence (lightweight APM) for backends:
- Inbound HTTP (Express, FastAPI, Next.js, Go, Ruby, …)
- Outbound AI (OpenAI, Anthropic, Gemini, Groq), payments (Stripe, Razorpay, PayPal), auth (Clerk), messaging, infra
- Traces, live stream, alerts (email/Slack/webhook), insights, AI summary, operations/SLO view
- Environment filter: production / staging / development on dashboard when events include environment tag

Data flow:
  Server ──SDK──► https://ingest.amlexia.com/v1/events
  Team   ──Clerk──► https://app.amlexia.com (NEVER put SDK key in browser)

Amlexia does NOT run my app logic or call vendors for me.

═══════════════════════════════════════════════════════════════
2. KEYS & ENV (server only)
═══════════════════════════════════════════════════════════════
AMLEXIA_SDK_KEY=am_...                    # required
AMLEXIA_INGEST_URL=https://ingest.amlexia.com
AMLEXIA_ENVIRONMENT=production            # recommended for env filter
AMLEXIA_RELEASE=1.0.0                     # optional
AMLEXIA_SERVICE_NAME=api                  # optional (Django default: api)

NEVER: SDK key in frontend, NEXT_PUBLIC_*, mobile, committed secrets.

═══════════════════════════════════════════════════════════════
3. INSTALL (exact names)
═══════════════════════════════════════════════════════════════
Node:   npm install @amlexiahq/node       # org is @amlexiahq NOT @amlexia
Python: pip install amlexia
        pip install "amlexia[fastapi]"     # optional extras
Go:     go get github.com/amlexiahq/amlexia-go
Ruby:   gem install amlexia
Bun:    bun add @amlexiahq/node
Deno:   import from npm:@amlexiahq/node

═══════════════════════════════════════════════════════════════
4. CLIENT PATTERNS (all languages)
═══════════════════════════════════════════════════════════════
- Buffered batching, flush on interval, shutdown() on SIGTERM
- sampleRate / sample_rate 0–1 to reduce volume
- diagnostic: true → log flush errors to stderr
- Health: CLI `npx amlexia health` or `amlexia health` (Go/Ruby too)
- wrapFetch / HTTP wrapper → auto-track outbound calls
- OpenAI/Anthropic helpers → pass usage from vendor response
- On 402: monthly plan limit (Startup = 10k events/mo) — do not spin-retry forever

Node:
  import { AmlexiaClient, wrapFetch, trackOpenAICompletion } from '@amlexiahq/node';
  const client = AmlexiaClient.fromEnv();
  globalThis.fetch = wrapFetch(client, fetch);
  await client.shutdown();

Python:
  from amlexia import AmlexiaClient
  client = AmlexiaClient.from_env()

Go:
  client, _ := amlexia.NewFromEnv()
  defer client.Shutdown()

Ruby:
  client = Amlexia::Client.from_env

Cloudflare Worker: ctx.waitUntil(client.flush()) after track()

═══════════════════════════════════════════════════════════════
5. FRAMEWORKS
═══════════════════════════════════════════════════════════════
Express:  AmlexiaMiddleware from @amlexiahq/node/express
Fastify:  amlexiaPlugin from @amlexiahq/node/fastify
Hono:     amlexiaHonoMiddleware from @amlexiahq/node/hono
Next.js:  withAmlexia from @amlexiahq/node/next — Route Handlers ONLY (server)
FastAPI:  AmlexiaMiddleware from amlexia.fastapi_integration
Flask:    amlexia_track from amlexia.flask_integration
Django:   AmlexiaMiddleware in MIDDLEWARE

═══════════════════════════════════════════════════════════════
6. COST (reported + estimated)
═══════════════════════════════════════════════════════════════
Ingest enriches cost_usd when you send model + provider + tokens WITHOUT cost_usd:
  cost_source = "estimated" (public model price table)
If you send cost_usd > 0:
  cost_source = "reported"

OpenAI after completion — tokens required for estimate:
  await client.track({
    endpoint: 'POST /v1/chat/completions',
    method: 'POST',
    statusCode: 200,
    latencyMs,
    provider: 'openai',
    modelName: res.model,
    tokensInput: usage.prompt_tokens,
    tokensOutput: usage.completion_tokens,
    // optional explicit: costUsd: yourNumber,
  });

Or use trackOpenAICompletion(client, { model, statusCode, latencyMs, usage }).

Stripe:
  provider: 'stripe',
  costUsd: chargeAmountUsd,
  metadata: { payment_intent_id: pi.id },  // NO card numbers

Inbound webhooks: isWebhook: true, provider: 'stripe'

Providers: openai, anthropic, gemini, groq, togetherai, replicate, stripe, razorpay, paypal, twilio, resend, sendgrid, clerk, supabase, firebase, aws

═══════════════════════════════════════════════════════════════
7. EVENT FIELDS
═══════════════════════════════════════════════════════════════
Required: endpoint, method, statusCode/status_code, latencyMs/latency_ms
Optional: provider, modelName/model_name, tokens_*, costUsd/cost_usd, environment, release, trace_id, span_id, session_id, user_id, metadata (no secrets), isWebhook/is_webhook
Headers: x-session-id, x-user-id

═══════════════════════════════════════════════════════════════
8. DASHBOARD (human — not in code)
═══════════════════════════════════════════════════════════════
User configures at app.amlexia.com:
- Alerts: latency, error_rate, cost, anomaly, provider_outage, retry_storm, cost_explosion, token_spike, webhook_degradation
- Channels: email | slack | webhook (HTTPS POST JSON)
- Saved views, env compare, usage meter (10k/mo free)
No SDK code for alerts.

═══════════════════════════════════════════════════════════════
9. VERIFY
═══════════════════════════════════════════════════════════════
curl -X POST https://ingest.amlexia.com/v1/events \
  -H "Content-Type: application/json" \
  -d '{"sdk_key":"am_...","events":[{"endpoint":"GET /health","method":"GET","status_code":200,"latency_ms":1,"timestamp":'"$(date +%s)"'","environment":"production"}]}'
Expect: accepted / queued

npx amlexia health

═══════════════════════════════════════════════════════════════
10. TASKS FOR YOU
═══════════════════════════════════════════════════════════════
1. Pick SDK for my stack (Node/Python/Go/Ruby)
2. Wire framework middleware OR manual track()
3. Track LLM calls (helpers or manual tokens)
4. Track Stripe/payments with costUsd
5. Mark inbound webhooks isWebhook: true
6. Set AMLEXIA_ENVIRONMENT per deploy
7. shutdown() / flush on serverless
8. .env.example with placeholders only
9. README section: Amlexia + health check command

═══════════════════════════════════════════════════════════════
11. MY PROJECT (fill in)
═══════════════════════════════════════════════════════════════
Framework:
Entry files:
OpenAI/Anthropic location:
Stripe/webhooks location:
Deploy target (Vercel, Fly, Workers, K8s):

Implement. List every file changed. Do not commit real SDK keys.
```

</details>

---

## Quick prompts by stack

### Node / TypeScript (Express)

```text
Integrate @amlexiahq/node into this Express app.
Use AmlexiaMiddleware, AmlexiaClient.fromEnv(), AMLEXIA_ENVIRONMENT, wrapFetch for outbound OpenAI if present.
Track Stripe webhooks with isWebhook: true. shutdown on SIGTERM.
Run npx amlexia health when done. List files changed.
```

### Python (FastAPI)

```text
Integrate amlexia into this FastAPI app.
Use AmlexiaMiddleware from amlexia.fastapi_integration, AmlexiaClient.from_env().
Track OpenAI with tokens for cost estimate. AMLEXIA_ENVIRONMENT=production in .env.example.
amlexia health when done.
```

### Go

```text
Integrate github.com/amlexiahq/amlexia-go.
NewFromEnv(), defer Shutdown(), Track() on main HTTP handlers and OpenAI client calls.
Set Environment pointer on events. go run .../cmd/amlexia health when done.
```

### Ruby

```text
Integrate gem amlexia. Client.from_env, track routes, Amlexia::OpenAI.track_openai_completion for LLM.
amlexia health when done.
```

### Cloudflare Workers

```text
Use @amlexiahq/node in this Worker. AmlexiaClient with small maxBatchSize, track in fetch handler, ctx.waitUntil(client.flush()).
Never expose AMLEXIA_SDK_KEY to client bundle — use env secret binding only.
```

### OpenAI / LLM only

```text
Add Amlexia tracking for every OpenAI/Anthropic call in this repo.
Use SDK helpers (trackOpenAICompletion / track_anthropic_message) or manual track with modelName, tokensInput, tokensOutput, provider.
Do not log API keys. Verify with amlexia health.
```

### Stripe / payments

```text
Track all Stripe API calls with provider: stripe and costUsd from charge amount.
Inbound POST /webhooks/stripe handlers: isWebhook: true, provider: stripe.
```

### Production audit

```text
Audit this repo for Amlexia production readiness:
- SDK key only server-side
- shutdown/flush on all processes
- AMLEXIA_ENVIRONMENT set per environment
- LLM events include model + tokens
- No secrets in metadata
- amlexia health passes
List gaps and fix them.
```

---

## Quick reference

### Install

```bash
npm install @amlexiahq/node
pip install amlexia
go get github.com/amlexiahq/amlexia-go
gem install amlexia
```

### Cost rules

| Topic | Rule |
|-------|------|
| Estimated cost | Send model + provider + tokens; omit `cost_usd` |
| Reported cost | Send `costUsd` / `cost_usd` > 0 |
| Dashboard | Shows reported vs estimated on Overview |
| Stripe / payments | You send `cost_usd` from your fee logic |

### Framework cheat sheet

| Stack | Pattern |
|-------|---------|
| Express | `AmlexiaMiddleware` |
| Fastify | `amlexiaPlugin` |
| Hono | `amlexiaHonoMiddleware` |
| Next.js | `withAmlexia` (server routes only) |
| FastAPI | `AmlexiaMiddleware` |
| Flask | `@amlexia_track` |
| Django | `AmlexiaMiddleware` |

### Verify

```bash
npx amlexia health
curl -s https://ingest.amlexia.com/health
```

---

## After the agent finishes

1. Set real `AMLEXIA_SDK_KEY` in deployment secrets.
2. Deploy and hit a route or LLM call.
3. Open [app.amlexia.com](https://app.amlexia.com) → **Overview**, **Live**, **Providers**.
4. Check **usage meter** (10k/mo on free tier).
5. Create [alerts](./alerts.md) (email, Slack, or webhook).
6. Use [environment filter](./environment.md) with `AMLEXIA_ENVIRONMENT`.

**Support:** [support@amlexia.com](mailto:support@amlexia.com)
