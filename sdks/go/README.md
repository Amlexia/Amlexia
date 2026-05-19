# Amlexia Go SDK

Official Go client with full feature parity. See [SDK_FEATURE_PARITY.md](../SDK_FEATURE_PARITY.md).

```go
client := amlexia.New(os.Getenv("AMLEXIA_SDK_KEY"))
defer client.Shutdown()

_ = client.Track(amlexia.Event{
    Endpoint: "/api/users", Method: "GET",
    StatusCode: 200, LatencyMs: 42,
})

// OpenAI helper
_ = amlexia.TrackOpenAICompletion(client, "gpt-4o-mini", 200, 1200,
    amlexia.OpenAIUsage{PromptTokens: 100, CompletionTokens: 50}, nil)

// Health
res := amlexia.CheckIngestHealth("", 0)
```

CLI: `go run ./cmd/amlexia health`
