package maa

// Status represents the lifecycle state of a task or item.
type Status int32

const (
	StatusInvalid Status = 0    // Unknown or uninitialized state
	StatusPending Status = 1000 // Queued but not yet started
	StatusRunning Status = 2000 // Work is in progress
	StatusSuccess Status = 3000 // Completed successfully
	StatusFailure Status = 4000 // Completed with failure
)

// Invalid reports whether the status is StatusInvalid.
func (s Status) Invalid() bool {
	return s == StatusInvalid
}

// Pending reports whether the status is StatusPending.
func (s Status) Pending() bool {
	return s == StatusPending
}

// Running reports whether the status is StatusRunning.
func (s Status) Running() bool {
	return s == StatusRunning
}

// Success reports whether the status is StatusSuccess.
func (s Status) Success() bool {
	return s == StatusSuccess
}

// Failure reports whether the status is StatusFailure.
func (s Status) Failure() bool {
	return s == StatusFailure
}

// Done reports whether the status is terminal (success or failure).
func (s Status) Done() bool {
	return s.Success() || s.Failure()
}

// String returns the human-readable representation of the Status.
func (s Status) String() string {
	switch s {
	case StatusInvalid:
		return "invalid"
	case StatusPending:
		return "pending"
	case StatusRunning:
		return "running"
	case StatusSuccess:
		return "success"
	case StatusFailure:
		return "failure"
	default:
		return "invalid"
	}
}
