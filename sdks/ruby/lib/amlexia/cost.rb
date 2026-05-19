# frozen_string_literal: true

module Amlexia
  MODEL_PRICES = {
    "gpt-4o-mini" => { input: 0.15, output: 0.6 },
    "gpt-4o" => { input: 2.5, output: 10 },
    "claude-3-5-haiku" => { input: 0.8, output: 4 },
    "claude-3-5-sonnet" => { input: 3, output: 15 },
    "gemini-2.0-flash" => { input: 0.1, output: 0.4 }
  }.freeze

  PROVIDER_DEFAULT_MODEL = {
    "openai" => "gpt-4o-mini",
    "anthropic" => "claude-3-5-haiku",
    "google" => "gemini-2.0-flash"
  }.freeze

  module Cost
    module_function

    def estimate_cost_usd(cost_usd:, model_name: nil, provider: nil, tokens_input: nil, tokens_output: nil, total_tokens: nil)
      return [cost_usd, "reported"] if cost_usd && cost_usd.positive?

      key = (model_name || "").downcase
      price = MODEL_PRICES[key]
      price ||= MODEL_PRICES[PROVIDER_DEFAULT_MODEL[(provider || "").downcase]] if provider
      return [cost_usd, nil] unless price

      inp = tokens_input || 0
      out = tokens_output || 0
      if inp.zero? && out.zero?
        return [cost_usd, nil] unless total_tokens&.positive?

        blended = (price[:input] + price[:output]) / 2.0
        return [(total_tokens / 1_000_000.0) * blended, "estimated"]
      end

      est = (inp / 1_000_000.0) * price[:input] + (out / 1_000_000.0) * price[:output]
      [est.round(8), "estimated"]
    end

    def enrich_event(event)
      cost, = estimate_cost_usd(
        cost_usd: event[:cost_usd],
        model_name: event[:model_name],
        provider: event[:provider] || event[:provider_name],
        tokens_input: event[:tokens_input],
        tokens_output: event[:tokens_output],
        total_tokens: event[:total_tokens]
      )
      event[:cost_usd] = cost if cost
      event
    end
  end
end
