# frozen_string_literal: true

require "json"
require "net/http"
require "uri"
require "thread"

module Amlexia
  class Client
    DEFAULT_INGEST_URL = "https://ingest.amlexia.com"
    DEFAULT_FLUSH_SECONDS = 5
    DEFAULT_BATCH_SIZE = 50
    DEFAULT_MAX_RETRIES = 5

    attr_reader :diagnostic

    def initialize(
      sdk_key:,
      ingest_url: DEFAULT_INGEST_URL,
      flush_interval_seconds: DEFAULT_FLUSH_SECONDS,
      max_batch_size: DEFAULT_BATCH_SIZE,
      max_retries: DEFAULT_MAX_RETRIES,
      environment: nil,
      release_version: nil,
      default_session_id: nil,
      sample_rate: 1.0,
      diagnostic: false
    )
      @sdk_key = sdk_key
      @ingest_url = ingest_url.chomp("/")
      @flush_interval = flush_interval_seconds
      @max_batch_size = max_batch_size
      @max_retries = max_retries
      @environment = environment
      @release_version = release_version
      @default_session_id = default_session_id
      @sample_rate = sample_rate
      @diagnostic = DiagnosticState.new(enabled: diagnostic, events_buffered: 0)
      @buffer = []
      @mutex = Mutex.new
      @flushing = false
      @stop = false
      @flush_thread = Thread.new { flush_loop }
    end

    def self.from_env
      new(
        sdk_key: ENV.fetch("AMLEXIA_SDK_KEY"),
        ingest_url: ENV.fetch("AMLEXIA_INGEST_URL", DEFAULT_INGEST_URL),
        environment: ENV["AMLEXIA_ENVIRONMENT"],
        release_version: ENV["AMLEXIA_RELEASE"]
      )
    end

    def track(**event)
      return unless Sampling.should_sample(@sample_rate)

      event = Cost.enrich_event(event)
      event[:timestamp] ||= Time.now.to_i
      event[:environment] ||= @environment
      event[:release_version] ||= @release_version
      event[:session_id] ||= @default_session_id
      event[:method] = event[:method].to_s.upcase

      should_flush = false
      @mutex.synchronize do
        @buffer << event
        should_flush = @buffer.length >= @max_batch_size
      end
      flush if should_flush
    end

    def get_diagnostic_snapshot
      @mutex.synchronize do
        @diagnostic.events_buffered = @buffer.length
        DiagnosticState.new(
          enabled: @diagnostic.enabled,
          events_buffered: @diagnostic.events_buffered,
          last_flush_at: @diagnostic.last_flush_at,
          last_error: @diagnostic.last_error
        )
      end
    end

    def flush
      events = nil
      @mutex.synchronize do
        return if @flushing || @buffer.empty?

        @flushing = true
        events = @buffer.shift(@max_batch_size)
      end
      post_events(events)
    ensure
      @mutex.synchronize { @flushing = false }
    end

    def shutdown
      @stop = true
      @flush_thread.join
      flush until @mutex.synchronize { @buffer.empty? }
    end

    private

    def flush_loop
      until @stop
        sleep @flush_interval
        flush
      rescue StandardError
        nil
      end
    end

    def post_events(events)
      post("/v1/events", { sdk_key: @sdk_key, events: events })
      @diagnostic.last_flush_at = (Time.now.to_f * 1000).to_i
      @diagnostic.last_error = nil
      warn "[amlexia] flushed #{events.length} events" if @diagnostic.enabled
    rescue StandardError => e
      @diagnostic.last_error = e.message
      warn "[amlexia] flush failed: #{e.message}" if @diagnostic.enabled
      @mutex.synchronize { @buffer = events + @buffer }
      raise
    end

    def post(path, body)
      uri = URI("#{@ingest_url}#{path}")
      data = JSON.generate(body)
      attempt = 0
      last_error = nil
      while attempt < @max_retries
        begin
          http = Net::HTTP.new(uri.host, uri.port)
          http.use_ssl = uri.scheme == "https"
          req = Net::HTTP::Post.new(uri)
          req["Content-Type"] = "application/json"
          req.body = data
          res = http.request(req)
          return true if res.is_a?(Net::HTTPSuccess)
          raise "Invalid SDK key" if res.code.to_i == 401
          raise "Usage limit exceeded" if res.code.to_i == 402
          raise "Ingest failed: #{res.code} #{res.body}" if res.code.to_i >= 400 && res.code.to_i < 500

          last_error = "HTTP #{res.code}"
        rescue StandardError => e
          last_error = e.message
          raise e if attempt >= @max_retries - 1
        end
        sleep([2**attempt, 30].min)
        attempt += 1
      end
      raise last_error || "Failed to send events after retries"
    end
  end
end
