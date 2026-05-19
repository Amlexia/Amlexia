# frozen_string_literal: true

require "net/http"
require "uri"

module Amlexia
  module HttpWrap
    module_function

    def provider_from_url(url)
      return "openai" if url.include?("openai")
      return "anthropic" if url.include?("anthropic")
      return "stripe" if url.include?("stripe")

      nil
    end

    def wrap_net_http(client)
      Net::HTTP.class_eval do
        alias_method :amlexia_original_request, :request unless method_defined?(:amlexia_original_request)

        define_method(:request) do |req, body = nil, &block|
          start = Process.clock_gettime(Process::CLOCK_MONOTONIC)
          status = 500
          err = nil
          begin
            res = amlexia_original_request(req, body, &block)
            status = res.code.to_i
            res
          rescue StandardError => e
            err = e.message
            raise
          ensure
            latency = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - start) * 1000).to_i
            client.track(
              endpoint: req.uri.to_s,
              method: req.method,
              status_code: status,
              latency_ms: latency,
              provider: Amlexia::HttpWrap.provider_from_url(req.uri.to_s),
              error_message: err
            )
          end
        end
      end
    end

    def track_http_call(client, **event)
      client.track(**event)
    end
  end
end
