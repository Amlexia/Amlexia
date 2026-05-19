Gem::Specification.new do |s|
  s.name        = "amlexia"
  s.version     = Amlexia::VERSION
  s.summary     = "Official Amlexia Ruby SDK — API, AI, and infrastructure observability"
  s.description = "Track HTTP APIs, LLM providers, payments, and webhooks with traces, latency, and cost fields."
  s.authors     = ["Amlexia"]
  s.email       = "support@amlexia.com"
  s.files       = Dir["lib/**/*.rb", "exe/amlexia", "README.md", "LICENSE"] + ["amlexia.gemspec"]
  s.executables = ["amlexia"]
  s.bindir      = "exe"
  s.homepage    = "https://amlexia.com"
  s.metadata    = {
    "source_code_uri" => "https://github.com/Amlexia/Amlexia",
    "documentation_uri" => "https://docs.amlexia.com/sdk/ruby",
    "changelog_uri" => "https://docs.amlexia.com/changelog"
  }
  s.license     = "Nonstandard"
  s.required_ruby_version = ">= 3.0"
end
