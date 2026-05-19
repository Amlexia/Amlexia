# frozen_string_literal: true

module Amlexia
  module OpenAI
    module_function

    def track_openai_completion(client, model:, status_code:, latency_ms:, usage: {}, cost_usd: nil, endpoint: "/v1/chat/completions", **kwargs)
      event = Cost.enrich_event(
        cost_usd: cost_usd,
        model_name: model,
        provider: "openai",
        tokens_input: usage[:prompt_tokens],
        tokens_output: usage[:completion_tokens],
        total_tokens: usage[:total_tokens]
      )
      client.track(
        endpoint: endpoint,
        method: "POST",
        status_code: status_code,
        latency_ms: latency_ms,
        provider: "openai",
        model_name: model,
        tokens_input: usage[:prompt_tokens],
        tokens_output: usage[:completion_tokens],
        cost_usd: event[:cost_usd],
        **kwargs
      )
    end
  end
end
