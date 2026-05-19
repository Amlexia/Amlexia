package main

import (
	"encoding/json"
	"fmt"
	"os"

	amlexia "github.com/Amlexia/Amlexia/sdks/go"
)

func main() {
	ingest := os.Getenv("AMLEXIA_INGEST_URL")
	if ingest == "" {
		ingest = amlexia.DefaultIngestURL
	}
	cmd := "health"
	if len(os.Args) > 1 {
		cmd = os.Args[1]
	}
	switch cmd {
	case "version":
		fmt.Println("1.0.2")
	case "health":
		res := amlexia.CheckIngestHealth(ingest, 0)
		out, _ := json.MarshalIndent(map[string]any{"ingestUrl": ingest, "ok": res.OK, "status": res.Status, "latencyMs": res.LatencyMs}, "", "  ")
		fmt.Println(string(out))
		if !res.OK {
			os.Exit(1)
		}
	default:
		fmt.Fprintf(os.Stderr, "Usage: amlexia [health|version]\n")
		os.Exit(1)
	}
}
