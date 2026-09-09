package maa

import "time"

func durationsToMs(ds []time.Duration) []int64 {
	if ds == nil {
		return nil
	}
	ms := make([]int64, len(ds))
	for i, d := range ds {
		ms[i] = d.Milliseconds()
	}
	return ms
}

func msToDurations(ms []int64) []time.Duration {
	if ms == nil {
		return nil
	}
	ds := make([]time.Duration, len(ms))
	for i, m := range ms {
		ds[i] = time.Duration(m) * time.Millisecond
	}
	return ds
}
