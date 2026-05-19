package amlexia

import (
	"crypto/rand"
	"encoding/hex"
)

type TraceContext struct {
	TraceID        string
	SpanID         string
	ParentSpanID   string
	SessionID      string
	UserID         string
	Environment    string
	ReleaseVersion string
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func CreateTraceContext() TraceContext {
	return TraceContext{
		TraceID: randomHex(16),
		SpanID:  randomHex(8),
	}
}

func ChildSpan(parent TraceContext) TraceContext {
	return TraceContext{
		TraceID:        parent.TraceID,
		SpanID:         randomHex(8),
		ParentSpanID:   parent.SpanID,
		SessionID:      parent.SessionID,
		UserID:         parent.UserID,
		Environment:    parent.Environment,
		ReleaseVersion: parent.ReleaseVersion,
	}
}
