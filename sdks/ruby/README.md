# Amlexia Ruby SDK

```ruby
require "amlexia"

client = Amlexia::Client.from_env

client.track(
  endpoint: "/v1/chat/completions",
  method: "POST",
  status_code: 200,
  latency_ms: 340,
  provider: "openai",
  model_name: "gpt-4o-mini",
  tokens_input: 120,
  tokens_output: 45
)

Amlexia::OpenAI.track_openai_completion(client, model: "gpt-4o-mini", status_code: 200, latency_ms: 340, usage: { prompt_tokens: 120, completion_tokens: 45 })
Amlexia::Health.check_ingest_health
```

CLI: `bundle exec amlexia health`
