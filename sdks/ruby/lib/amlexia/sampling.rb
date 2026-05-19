# frozen_string_literal: true

module Amlexia
  module Sampling
    module_function

    def should_sample(rate)
      return true if rate >= 1.0
      return false if rate <= 0.0

      rand < rate
    end
  end
end
