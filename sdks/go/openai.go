package amlexia

type OpenAIUsage struct {
	PromptTokens     int
	CompletionTokens int
	TotalTokens      int
}

func TrackOpenAICompletion(c *Client, model string, statusCode, latencyMs int, usage OpenAIUsage, costUSD *float64) error {
	in := usage.PromptTokens
	out := usage.CompletionTokens
	est := EstimateEventCostUSD(costUSD, model, "openai", in, out, usage.TotalTokens)
	prov := "openai"
	endpoint := "/v1/chat/completions"
	method := "POST"
	return c.Track(Event{
		Endpoint:   endpoint,
		Method:     method,
		StatusCode: statusCode,
		LatencyMs:  latencyMs,
		CostUSD:    est,
		Provider:   &prov,
		ModelName:  &model,
		TokensIn:   &in,
		TokensOut:  &out,
	})
}
