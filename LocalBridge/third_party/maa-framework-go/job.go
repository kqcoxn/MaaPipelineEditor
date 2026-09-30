package maa

import "errors"

// Job represents an asynchronous job with status tracking capabilities.
// It provides methods to check the job status and wait for completion.
type Job struct {
	id          int64
	finalStatus Status
	statusFunc  func(id int64) Status
	waitFunc    func(id int64) Status
	err         error
	owner       *handleState
}

func newJob(id int64, statusFunc func(id int64) Status, waitFunc func(id int64) Status, owner ...*handleState) *Job {
	job := &Job{
		id:         id,
		statusFunc: statusFunc,
		waitFunc:   waitFunc,
	}
	if len(owner) != 0 {
		job.owner = owner[0]
		job.owner.trackJob(id)
	}
	return job
}

func newFailedJob(err error) *Job {
	return &Job{err: err, finalStatus: StatusFailure}
}

// Error reports why the job could not be submitted or used.
func (j *Job) Error() error {
	if j.err != nil {
		return j.err
	}
	if j.owner != nil {
		return j.owner.check()
	}
	return nil
}

// Status returns the current status of the job.
func (j *Job) Status() Status {
	if !j.finalStatus.Invalid() {
		return j.finalStatus
	}
	if j.Error() != nil {
		return StatusFailure
	}
	return j.trackStatus(j.statusFunc(j.id))
}

func (j *Job) trackStatus(status Status) Status {
	if j.owner != nil && (status.Done() || status.Invalid()) {
		j.owner.untrackJob(j.id)
	}
	return status
}

// Invalid reports whether the status is invalid.
func (j *Job) Invalid() bool {
	return j.Status().Invalid()
}

// Pending reports whether the status is pending.
func (j *Job) Pending() bool {
	return j.Status().Pending()
}

// Running reports whether the status is running.
func (j *Job) Running() bool {
	return j.Status().Running()
}

// Success reports whether the status is success.
func (j *Job) Success() bool {
	return j.Status().Success()
}

// Failure reports whether the status is a failure.
func (j *Job) Failure() bool {
	return j.Status().Failure()
}

// Done reports whether the job is done (either success or failure).
func (j *Job) Done() bool {
	return j.Status().Done()
}

// Wait blocks until the job completes and returns the job instance.
func (j *Job) Wait() *Job {
	if j.Error() != nil {
		return j
	}
	if j.finalStatus.Invalid() {
		j.finalStatus = j.trackStatus(j.waitFunc(j.id))
	}
	return j
}

func newFailedTaskJob(err error) *TaskJob {
	return newTaskJob(0, nil, nil, nil, nil, err)
}

// TaskJob extends Job with task-specific functionality.
// It provides additional methods to retrieve task details.
type TaskJob struct {
	job                  *Job
	getTaskDetailFunc    func(id int64) (*TaskDetail, error)
	overridePipelineFunc func(id int64, override any) error
	err                  error
}

func newTaskJob(
	id int64,
	statusFunc func(id int64) Status,
	waitFunc func(id int64) Status,
	getTaskDetailFunc func(id int64) (*TaskDetail, error),
	overridePipelineFunc func(id int64, override any) error,
	err error,
	owner ...*handleState,
) *TaskJob {
	job := newJob(id, statusFunc, waitFunc, owner...)
	return &TaskJob{
		job:                  job,
		getTaskDetailFunc:    getTaskDetailFunc,
		overridePipelineFunc: overridePipelineFunc,
		err:                  err,
	}
}

// Status returns the current status of the task job.
// If the task job has an error, it returns StatusFailure.
func (j *TaskJob) Status() Status {
	if j.err != nil {
		return StatusFailure
	}
	return j.job.Status()
}

// Wait blocks until the task job completes and returns the TaskJob instance.
func (j *TaskJob) Wait() *TaskJob {
	if j.Error() == nil {
		j.job.Wait()
	}
	return j
}

// Error returns the error of the task job.
func (j *TaskJob) Error() error {
	if j.err != nil {
		return j.err
	}
	return j.job.Error()
}

// Invalid reports whether the status is invalid.
func (j *TaskJob) Invalid() bool {
	return j.Status().Invalid()
}

// Pending reports whether the status is pending.
func (j *TaskJob) Pending() bool {
	return j.Status().Pending()
}

// Running reports whether the status is running.
func (j *TaskJob) Running() bool {
	return j.Status().Running()
}

// Success reports whether the status is success.
func (j *TaskJob) Success() bool {
	return j.Status().Success()
}

// Failure reports whether the status is a failure.
func (j *TaskJob) Failure() bool {
	return j.Status().Failure()
}

// Done reports whether the job is done (either success or failure).
func (j *TaskJob) Done() bool {
	return j.Status().Done()
}

// GetDetail retrieves the detailed information of the task.
func (j *TaskJob) GetDetail() (*TaskDetail, error) {
	if err := j.Error(); err != nil {
		return nil, err
	}
	if j.getTaskDetailFunc == nil {
		return nil, errors.New("getTaskDetailFunc is nil")
	}
	return j.getTaskDetailFunc(j.job.id)
}

// OverridePipeline overrides the pipeline for a running task.
// The `override` parameter can be a JSON string or any data type that can be marshaled to JSON.
func (j *TaskJob) OverridePipeline(override any) error {
	if err := j.Error(); err != nil {
		return err
	}
	if j.overridePipelineFunc == nil {
		return errors.New("overridePipelineFunc is nil")
	}
	return j.overridePipelineFunc(j.job.id, override)
}
