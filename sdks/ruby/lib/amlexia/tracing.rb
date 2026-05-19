# frozen_string_literal: true

require "securerandom"

module Amlexia
  TraceContext = Struct.new(
    :trace_id, :span_id, :parent_span_id, :session_id, :user_id, :environment, :release_version,
    keyword_init: true
  )

  module Tracing
    module_function

    def create_trace_context(**kwargs)
      TraceContext.new(
        trace_id: kwargs[:trace_id] || SecureRandom.hex(16),
        span_id: kwargs[:span_id] || SecureRandom.hex(8),
        parent_span_id: kwargs[:parent_span_id],
        session_id: kwargs[:session_id],
        user_id: kwargs[:user_id],
        environment: kwargs[:environment],
        release_version: kwargs[:release_version]
      )
    end

    def child_span(parent)
      TraceContext.new(
        trace_id: parent.trace_id,
        span_id: SecureRandom.hex(8),
        parent_span_id: parent.span_id,
        session_id: parent.session_id,
        user_id: parent.user_id,
        environment: parent.environment,
        release_version: parent.release_version
      )
    end
  end
end
