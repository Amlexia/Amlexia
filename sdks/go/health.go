package amlexia

import (
	"net/http"
	"time"
)

type HealthResult struct {
	OK        bool `json:"ok"`
	Status    int  `json:"status"`
	LatencyMs int  `json:"latencyMs"`
}

func CheckIngestHealth(ingestURL string, timeout time.Duration) HealthResult {
	if timeout == 0 {
		timeout = 5 * time.Second
	}
	base := ingestURL
	if base == "" {
		base = DefaultIngestURL
	}
	start := time.Now()
	client := &http.Client{Timeout: timeout}
	res, err := client.Get(base + "/health")
	if err != nil {
		return HealthResult{OK: false, Status: 0, LatencyMs: int(time.Since(start).Milliseconds())}
	}
	defer res.Body.Close()
	return HealthResult{
		OK:        res.StatusCode >= 200 && res.StatusCode < 300,
		Status:    res.StatusCode,
		LatencyMs: int(time.Since(start).Milliseconds()),
	}
}
