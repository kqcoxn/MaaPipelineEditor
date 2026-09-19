package interfacerun

import (
	"context"
	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
	pi "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/service/projectinterface"
	"reflect"
	"testing"
)

type fakeJob struct{ status maa.Status }

func (j *fakeJob) Status() maa.Status { return j.status }
func (j *fakeJob) Success() bool      { return j.status.Success() }
func queueFixture() (*Service, []*pi.RuntimePlan) {
	s := New(nil, nil, eventbus.New(), "test")
	s.state.Items = []Item{{Name: "a", Label: "A", Status: "pending"}, {Name: "b", Label: "B", Status: "pending"}}
	return s, []*pi.RuntimePlan{{TaskName: "a", Entry: "DynamicA"}, {TaskName: "b", Entry: "DynamicB"}}
}
func TestQueueExecutesInOrderWithoutSourceNodes(t *testing.T) {
	s, plans := queueFixture()
	entries := []string{}
	err := s.executeTasks(context.Background(), plans, func(plan *pi.RuntimePlan) (taskJob, error) {
		entries = append(entries, plan.Entry)
		return &fakeJob{maa.StatusSuccess}, nil
	}, func() { t.Fatal("unexpected stop") })
	if err != nil || !reflect.DeepEqual(entries, []string{"DynamicA", "DynamicB"}) {
		t.Fatalf("%v %v", entries, err)
	}
	for _, item := range s.Snapshot().Items {
		if item.Status != "completed" {
			t.Fatal(item)
		}
	}
}
func TestQueueFailureAndInvalidJobDoNotRunNextTask(t *testing.T) {
	for _, status := range []maa.Status{maa.StatusFailure, maa.StatusInvalid} {
		s, plans := queueFixture()
		count := 0
		err := s.executeTasks(context.Background(), plans, func(*pi.RuntimePlan) (taskJob, error) { count++; return &fakeJob{status}, nil }, func() {})
		if err == nil || count != 1 {
			t.Fatalf("status %v: count=%d err=%v", status, count, err)
		}
	}
}
func TestQueueCancellationWaitsForStopAndSkipsNextTask(t *testing.T) {
	s, plans := queueFixture()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	count, stops := 0, 0
	job := &fakeJob{maa.StatusRunning}
	err := s.executeTasks(ctx, plans, func(*pi.RuntimePlan) (taskJob, error) { count++; cancel(); return job, nil }, func() { stops++; job.status = maa.StatusFailure })
	if err != context.Canceled || count != 1 || stops != 1 {
		t.Fatalf("%v count=%d stops=%d", err, count, stops)
	}
}
func TestOverrideLayersDoNotMutateOrLeakAcrossTasks(t *testing.T) {
	original := map[string]any{"N": map[string]any{"action": map[string]any{"type": "Click", "param": map[string]any{"x": 1}}, "next": []any{"A"}}}
	result := mergeOverrides([]map[string]any{{"runtimeName": "N", "pipeline": original["N"]}, {"runtimeName": "N", "pipeline": map[string]any{"action": map[string]any{"param": map[string]any{"x": 2}}, "next": []any{"B"}}}})
	node := result["N"].(map[string]any)
	if node["action"].(map[string]any)["param"].(map[string]any)["x"] != 2 {
		t.Fatal(result)
	}
	if original["N"].(map[string]any)["action"].(map[string]any)["param"].(map[string]any)["x"] != 1 {
		t.Fatal("mutated PI plan")
	}
	if len(mergeOverrides(nil)) != 0 {
		t.Fatal("task override leaked")
	}
}
func TestLogRingAndSnapshotsAreBoundedAndIsolated(t *testing.T) {
	s, _ := queueFixture()
	for i := 0; i < 510; i++ {
		s.log("info", "line")
	}
	snapshot := s.Snapshot()
	if len(snapshot.Logs) != 500 || snapshot.Logs[0].Sequence != 11 {
		t.Fatal("unbounded or unordered logs")
	}
	snapshot.Items[0].Status = "bad"
	snapshot.Logs[0].Message = "bad"
	if s.Snapshot().Items[0].Status == "bad" || s.Snapshot().Logs[0].Message == "bad" {
		t.Fatal("snapshot mutated live state")
	}
}
