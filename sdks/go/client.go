package amlexia

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sync"
	"time"
)

const DefaultIngestURL = "https://ingest.amlexia.com"

const (
	defaultFlushInterval = 5 * time.Second
	defaultBatchSize     = 50
	defaultMaxRetries    = 5
)

type Event struct {
	Endpoint             string   `json:"endpoint"`
	Method               string   `json:"method"`
	StatusCode           int      `json:"status_code"`
	LatencyMs            int      `json:"latency_ms"`
	Timestamp            *int64   `json:"timestamp,omitempty"`
	RequestSizeBytes     *int     `json:"request_size_bytes,omitempty"`
	ResponseSizeBytes    *int     `json:"response_size_bytes,omitempty"`
	CostUSD              *float64 `json:"cost_usd,omitempty"`
	Provider             *string  `json:"provider,omitempty"`
	ErrorMessage         *string  `json:"error_message,omitempty"`
	Metadata             map[string]any `json:"metadata,omitempty"`
	TraceID              *string  `json:"trace_id,omitempty"`
	SpanID               *string  `json:"span_id,omitempty"`
	ParentSpanID         *string  `json:"parent_span_id,omitempty"`
	SessionID            *string  `json:"session_id,omitempty"`
	UserID               *string  `json:"user_id,omitempty"`
	Environment          *string  `json:"environment,omitempty"`
	ReleaseVersion       *string  `json:"release_version,omitempty"`
	ServiceName          *string  `json:"service_name,omitempty"`
	OperationName        *string  `json:"operation_name,omitempty"`
	ModelName            *string  `json:"model_name,omitempty"`
	TokensIn             *int     `json:"tokens_input,omitempty"`
	TokensOut            *int     `json:"tokens_output,omitempty"`
	TotalTokens          *int     `json:"total_tokens,omitempty"`
	StreamingLatencyMs   *int     `json:"streaming_latency_ms,omitempty"`
	FirstTokenLatencyMs  *int     `json:"first_token_latency_ms,omitempty"`
	CacheHit             *bool    `json:"cache_hit,omitempty"`
	RetryCount           *int     `json:"retry_count,omitempty"`
	IsWebhook            *bool    `json:"is_webhook,omitempty"`
}

type ClientOptions struct {
	SDKKey           string
	IngestURL        string
	FlushInterval    time.Duration
	MaxBatchSize     int
	MaxRetries       int
	Environment      string
	ReleaseVersion   string
	DefaultSessionID string
	SampleRate       float64
	Diagnostic       bool
}

type Client struct {
	opts       ClientOptions
	http       *http.Client
	buffer     []Event
	mu         sync.Mutex
	flushing   bool
	stopCh     chan struct{}
	Diagnostic DiagnosticState
}

func NewClient(opts ClientOptions) *Client {
	if opts.IngestURL == "" {
		opts.IngestURL = DefaultIngestURL
	}
	if opts.FlushInterval == 0 {
		opts.FlushInterval = defaultFlushInterval
	}
	if opts.MaxBatchSize == 0 {
		opts.MaxBatchSize = defaultBatchSize
	}
	if opts.MaxRetries == 0 {
		opts.MaxRetries = defaultMaxRetries
	}
	if opts.SampleRate == 0 {
		opts.SampleRate = 1
	}
	c := &Client{
		opts:   opts,
		http:   &http.Client{Timeout: 30 * time.Second},
		stopCh: make(chan struct{}),
		Diagnostic: DiagnosticState{Enabled: opts.Diagnostic},
	}
	go c.flushLoop()
	return c
}

func New(sdkKey string) *Client {
	return NewClient(ClientOptions{SDKKey: sdkKey})
}

func NewFromEnv() (*Client, error) {
	key := os.Getenv("AMLEXIA_SDK_KEY")
	if key == "" {
		return nil, fmt.Errorf("AMLEXIA_SDK_KEY is required")
	}
	return NewClient(ClientOptions{
		SDKKey:         key,
		IngestURL:      os.Getenv("AMLEXIA_INGEST_URL"),
		Environment:    os.Getenv("AMLEXIA_ENVIRONMENT"),
		ReleaseVersion: os.Getenv("AMLEXIA_RELEASE"),
	}), nil
}

func (c *Client) Track(e Event) error {
	if !ShouldSample(c.opts.SampleRate) {
		return nil
	}
	model := ""
	if e.ModelName != nil {
		model = *e.ModelName
	}
	prov := ""
	if e.Provider != nil {
		prov = *e.Provider
	}
	tin, tout, total := 0, 0, 0
	if e.TokensIn != nil {
		tin = *e.TokensIn
	}
	if e.TokensOut != nil {
		tout = *e.TokensOut
	}
	if e.TotalTokens != nil {
		total = *e.TotalTokens
	}
	e.CostUSD = EstimateEventCostUSD(e.CostUSD, model, prov, tin, tout, total)
	if c.opts.Environment != "" && e.Environment == nil {
		e.Environment = &c.opts.Environment
	}
	if c.opts.ReleaseVersion != "" && e.ReleaseVersion == nil {
		e.ReleaseVersion = &c.opts.ReleaseVersion
	}
	if c.opts.DefaultSessionID != "" && e.SessionID == nil {
		e.SessionID = &c.opts.DefaultSessionID
	}

	c.mu.Lock()
	c.buffer = append(c.buffer, e)
	shouldFlush := len(c.buffer) >= c.opts.MaxBatchSize
	c.mu.Unlock()
	if shouldFlush {
		return c.Flush()
	}
	return nil
}

func (c *Client) GetDiagnosticSnapshot() DiagnosticState {
	c.mu.Lock()
	defer c.mu.Unlock()
	return DiagnosticState{
		Enabled:        c.Diagnostic.Enabled,
		EventsBuffered: len(c.buffer),
		LastFlushAt:    c.Diagnostic.LastFlushAt,
		LastError:      c.Diagnostic.LastError,
	}
}

func (c *Client) Flush() error {
	c.mu.Lock()
	if c.flushing || len(c.buffer) == 0 {
		c.mu.Unlock()
		return nil
	}
	c.flushing = true
	n := c.opts.MaxBatchSize
	if len(c.buffer) < n {
		n = len(c.buffer)
	}
	events := make([]Event, n)
	copy(events, c.buffer[:n])
	c.buffer = c.buffer[n:]
	c.mu.Unlock()

	err := c.send(events)
	c.mu.Lock()
	c.flushing = false
	if err != nil {
		c.buffer = append(events, c.buffer...)
		c.Diagnostic.LastError = err.Error()
	} else {
		c.Diagnostic.LastFlushAt = time.Now().UnixMilli()
		c.Diagnostic.LastError = ""
	}
	c.mu.Unlock()
	return err
}

func (c *Client) Shutdown() error {
	close(c.stopCh)
	for {
		c.mu.Lock()
		empty := len(c.buffer) == 0
		c.mu.Unlock()
		if empty {
			return nil
		}
		if err := c.Flush(); err != nil {
			return err
		}
	}
}

func (c *Client) flushLoop() {
	ticker := time.NewTicker(c.opts.FlushInterval)
	defer ticker.Stop()
	for {
		select {
		case <-c.stopCh:
			return
		case <-ticker.C:
			_ = c.Flush()
		}
	}
}

func (c *Client) send(events []Event) error {
	now := time.Now().Unix()
	payloadEvents := make([]map[string]any, 0, len(events))
	for _, e := range events {
		ts := now
		if e.Timestamp != nil {
			ts = *e.Timestamp
		}
		m := map[string]any{
			"endpoint":    e.Endpoint,
			"method":      e.Method,
			"status_code": e.StatusCode,
			"latency_ms":  e.LatencyMs,
			"timestamp":   ts,
		}
		if e.CostUSD != nil {
			m["cost_usd"] = *e.CostUSD
		}
		if e.Provider != nil {
			m["provider"] = *e.Provider
		}
		if e.ErrorMessage != nil && *e.ErrorMessage != "" {
			m["error_message"] = *e.ErrorMessage
		}
		if e.ModelName != nil {
			m["model_name"] = *e.ModelName
		}
		if e.TokensIn != nil {
			m["tokens_input"] = *e.TokensIn
		}
		if e.TokensOut != nil {
			m["tokens_output"] = *e.TokensOut
		}
		if e.TraceID != nil {
			m["trace_id"] = *e.TraceID
		}
		if e.SpanID != nil {
			m["span_id"] = *e.SpanID
		}
		if e.Environment != nil {
			m["environment"] = *e.Environment
		}
		payloadEvents = append(payloadEvents, m)
	}
	body, _ := json.Marshal(map[string]any{"sdk_key": c.opts.SDKKey, "events": payloadEvents})
	url := c.opts.IngestURL + "/v1/events"
	var lastErr error
	for attempt := 0; attempt < c.opts.MaxRetries; attempt++ {
		req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
		if err != nil {
			return err
		}
		req.Header.Set("Content-Type", "application/json")
		res, err := c.http.Do(req)
		if err != nil {
			lastErr = err
		} else {
			b, _ := io.ReadAll(res.Body)
			res.Body.Close()
			if res.StatusCode >= 200 && res.StatusCode < 300 {
				return nil
			}
			if res.StatusCode == 401 {
				return fmt.Errorf("invalid SDK key")
			}
			if res.StatusCode == 402 {
				return fmt.Errorf("usage limit exceeded: %s", string(b))
			}
			if res.StatusCode >= 400 && res.StatusCode < 500 {
				return fmt.Errorf("ingest %d: %s", res.StatusCode, string(b))
			}
			lastErr = fmt.Errorf("ingest %d", res.StatusCode)
		}
		delay := 1000 * (1 << attempt)
		if delay > 30000 {
			delay = 30000
		}
		time.Sleep(time.Duration(delay) * time.Millisecond)
	}
	return lastErr
}
