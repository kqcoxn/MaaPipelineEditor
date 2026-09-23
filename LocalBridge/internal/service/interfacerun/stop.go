package interfacerun

import "time"

// A successful PostStop only submits the request. Both its job and the native
// tasker must become idle before callers may destroy tasker/resource/agents.
// Failed submissions can be retried; pending stop jobs must not be discarded.
func waitForTaskerStop(postStop func() taskJob, running func() bool) {
	job := postStop()
	lastAttempt := time.Now()
	ticker := time.NewTicker(20 * time.Millisecond)
	defer ticker.Stop()
	for {
		finished := job == nil
		if job != nil {
			status := job.Status()
			finished = status.Done() || status.Invalid()
		}
		if finished {
			if !running() {
				return
			}
			if time.Since(lastAttempt) >= 500*time.Millisecond {
				job = postStop()
				lastAttempt = time.Now()
			}
		}
		<-ticker.C
	}
}
