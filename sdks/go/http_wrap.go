package amlexia

import (
	"net/http"
	"strings"
	"time"
)

func providerFromURL(url string) string {
	if strings.Contains(url, "openai") {
		return "openai"
	}
	if strings.Contains(url, "anthropic") {
		return "anthropic"
	}
	if strings.Contains(url, "stripe") {
		return "stripe"
	}
	return ""
}

type trackingRoundTripper struct {
	base   http.RoundTripper
	client *Client
}

func (t *trackingRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	start := time.Now()
	status := 500
	var err error
	var res *http.Response
	res, err = t.base.RoundTrip(req)
	if res != nil {
		status = res.StatusCode
	}
	latency := int(time.Since(start).Milliseconds())
	prov := providerFromURL(req.URL.String())
	e := Event{
		Endpoint:   req.URL.String(),
		Method:     req.Method,
		StatusCode: status,
		LatencyMs:  latency,
		Provider:   &prov,
	}
	if err != nil {
		msg := err.Error()
		e.ErrorMessage = &msg
	}
	_ = t.client.Track(e)
	return res, err
}

// WrapHTTPClient returns an http.Client that tracks outbound requests.
func WrapHTTPClient(c *Client, base *http.Client) *http.Client {
	if base == nil {
		base = &http.Client{Timeout: 30 * time.Second}
	}
	rt := base.Transport
	if rt == nil {
		rt = http.DefaultTransport
	}
	clone := *base
	clone.Transport = &trackingRoundTripper{base: rt, client: c}
	return &clone
}
