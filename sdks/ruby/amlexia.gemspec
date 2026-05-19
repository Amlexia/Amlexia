Gem::Specification.new do |s|
  s.name        = "amlexia"
  s.version     = "1.0.2"
  s.summary     = "Official Amlexia Ruby SDK"
  s.authors     = ["Amlexia"]
  s.files       = Dir["lib/**/*.rb", "exe/amlexia"]
  s.executables = ["amlexia"]
  s.bindir      = "exe"
  s.homepage    = "https://amlexia.com"
  s.license     = "MIT"
  s.required_ruby_version = ">= 3.0"
end
