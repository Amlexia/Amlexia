# frozen_string_literal: true

module Amlexia
  DiagnosticState = Struct.new(:enabled, :events_buffered, :last_flush_at, :last_error, keyword_init: true)
end
