# frozen_string_literal: true

module Amlexia
  module Anthropic
    module_function

    def track_anthropic_message(client, model:, status_code:, latency_ms:, usage: {}, cost_usd: nil, **kwargs)
      event = Cost.enrich_event(
        cost_usd: cost_usd,
        model_name: model,
        provider: "anthropic",
        tokens_input: usage[:input_tokens],
        tokens_output: usage[:output_tokens]
      )
      client.track(
        endpoint: "/v1/messages",
        method: "POST",
        status_code: status_code,
        latency_ms: latency_ms,
        provider: "anthropic",
        model_name: model,
        tokens_input: usage[:input_tokens],
        tokens_output: usage[:output_tokens],
        cost_usd: event[:cost_usd],
        **kwargs
      )
    end
  end
end
