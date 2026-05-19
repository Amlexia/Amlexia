package amlexia

type AnthropicUsage struct {
	InputTokens  int
	OutputTokens int
}

func TrackAnthropicMessage(c *Client, model string, statusCode, latencyMs int, usage AnthropicUsage, costUSD *float64) error {
	est := EstimateEventCostUSD(costUSD, model, "anthropic", usage.InputTokens, usage.OutputTokens, 0)
	prov := "anthropic"
	return c.Track(Event{
		Endpoint:   "/v1/messages",
		Method:     "POST",
		StatusCode: statusCode,
		LatencyMs:  latencyMs,
		CostUSD:    est,
		Provider:   &prov,
		ModelName:  &model,
		TokensIn:   &usage.InputTokens,
		TokensOut:  &usage.OutputTokens,
	})
}
