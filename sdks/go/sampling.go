package amlexia

import "math/rand"

func ShouldSample(rate float64) bool {
	if rate >= 1 {
		return true
	}
	if rate <= 0 {
		return false
	}
	return rand.Float64() < rate
}
