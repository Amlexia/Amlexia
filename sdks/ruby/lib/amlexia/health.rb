# frozen_string_literal: true

require "net/http"
require "uri"

module Amlexia
  module Health
    module_function

    def check_ingest_health(ingest_url: Client::DEFAULT_INGEST_URL, timeout: 5)
      uri = URI("#{ingest_url.to_s.chomp('/')}/health")
      start = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = uri.scheme == "https"
      http.open_timeout = timeout
      http.read_timeout = timeout
      res = http.get(uri.path)
      latency = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - start) * 1000).to_i
      { ok: res.is_a?(Net::HTTPSuccess), status: res.code.to_i, latency_ms: latency }
    rescue StandardError
      latency = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - start) * 1000).to_i
      { ok: false, status: 0, latency_ms: latency }
    end
  end
end
