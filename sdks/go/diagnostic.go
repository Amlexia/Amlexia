package amlexia

type DiagnosticState struct {
	Enabled        bool
	EventsBuffered int
	LastFlushAt    int64
	LastError      string
}
