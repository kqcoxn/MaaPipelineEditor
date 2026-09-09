package maa

import (
	"time"
)

// WaitFreezesParam defines parameters for waiting until screen stabilizes.
// The screen is considered stable when there are no significant changes for a continuous period.
type WaitFreezesParam struct {
	// Time specifies the duration that the screen must remain stable. Default: 1ms.
	// JSON: serialized as integer milliseconds.
	Time time.Duration `json:"-"`
	// Target specifies the region to monitor for changes.
	Target Target `json:"target,omitzero"`
	// TargetOffset specifies additional offset applied to target.
	TargetOffset Rect `json:"target_offset,omitempty"`
	// Threshold specifies the template matching threshold for detecting changes. Default: 0.95.
	Threshold float64 `json:"threshold,omitempty"`
	// Method specifies the template matching algorithm (cv::TemplateMatchModes). Default: 5.
	Method int `json:"method,omitempty"`
	// RateLimit specifies the minimum interval between checks. Default: 1000ms.
	// JSON: serialized as integer milliseconds.
	RateLimit time.Duration `json:"-"`
	// Timeout specifies the maximum wait time. Default: 20000ms.
	// JSON: serialized as integer milliseconds.
	Timeout time.Duration `json:"-"`
}

func (w WaitFreezesParam) MarshalJSON() ([]byte, error) {
	type NoMethod WaitFreezesParam
	return marshalJSON(struct {
		NoMethod
		Time      int64 `json:"time,omitempty"`
		RateLimit int64 `json:"rate_limit,omitempty"`
		Timeout   int64 `json:"timeout,omitempty"`
	}{
		NoMethod:  NoMethod(w),
		Time:      w.Time.Milliseconds(),
		RateLimit: w.RateLimit.Milliseconds(),
		Timeout:   w.Timeout.Milliseconds(),
	})
}

func (w *WaitFreezesParam) UnmarshalJSON(data []byte) error {
	type NoMethod WaitFreezesParam
	raw := struct {
		NoMethod
		Time      int64 `json:"time,omitempty"`
		RateLimit int64 `json:"rate_limit,omitempty"`
		Timeout   int64 `json:"timeout,omitempty"`
	}{}
	if err := unmarshalJSON(data, &raw); err != nil {
		return err
	}
	*w = WaitFreezesParam(raw.NoMethod)
	w.Time = time.Duration(raw.Time) * time.Millisecond
	w.RateLimit = time.Duration(raw.RateLimit) * time.Millisecond
	w.Timeout = time.Duration(raw.Timeout) * time.Millisecond
	return nil
}
