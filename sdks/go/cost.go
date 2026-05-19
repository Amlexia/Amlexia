package amlexia

type modelPrice struct {
	InputPer1M  float64
	OutputPer1M float64
}

var modelPrices = map[string]modelPrice{
	"gpt-4o-mini":      {0.15, 0.6},
	"gpt-4o":           {2.5, 10},
	"claude-3-5-haiku": {0.8, 4},
	"claude-3-5-sonnet": {3, 15},
	"gemini-2.0-flash": {0.1, 0.4},
}

var providerDefaultModel = map[string]string{
	"openai":    "gpt-4o-mini",
	"anthropic": "claude-3-5-haiku",
	"google":    "gemini-2.0-flash",
}

func resolveModelPrice(model, provider string) *modelPrice {
	if model != "" {
		if p, ok := modelPrices[model]; ok {
			return &p
		}
	}
	if provider != "" {
		if def, ok := providerDefaultModel[provider]; ok {
			if p, ok := modelPrices[def]; ok {
				return &p
			}
		}
	}
	return nil
}

func EstimateEventCostUSD(costUSD *float64, model, provider string, tokensIn, tokensOut, totalTokens int) *float64 {
	if costUSD != nil && *costUSD > 0 {
		return costUSD
	}
	price := resolveModelPrice(model, provider)
	if price == nil {
		return costUSD
	}
	var est float64
	if tokensIn == 0 && tokensOut == 0 {
		if totalTokens <= 0 {
			return costUSD
		}
		blended := (price.InputPer1M + price.OutputPer1M) / 2
		est = (float64(totalTokens) / 1_000_000) * blended
	} else {
		est = (float64(tokensIn)/1_000_000)*price.InputPer1M + (float64(tokensOut)/1_000_000)*price.OutputPer1M
	}
	return &est
}
