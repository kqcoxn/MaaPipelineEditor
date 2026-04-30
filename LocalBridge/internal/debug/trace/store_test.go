package trace

import (
	"testing"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
)

func TestStoreAppendCopiesEventData(t *testing.T) {
	store := NewStore()
	data := map[string]interface{}{"status": "completed"}

	appended, err := store.Append(protocol.Event{
		SessionID: "session-1",
		RunID:     "run-1",
		Source:    "localbridge",
		Kind:      "session",
		Phase:     "completed",
		Status:    "completed",
		Data:      data,
	})
	if err != nil {
		t.Fatalf("Append() error = %v", err)
	}

	data["performanceSummaryRef"] = "external-mutation"
	appended.Data["another"] = "external-mutation"

	events := store.ListRun("session-1", "run-1")
	if len(events) != 1 {
		t.Fatalf("ListRun() len = %d, want 1", len(events))
	}
	if got := events[0].Data["performanceSummaryRef"]; got != nil {
		t.Fatalf("stored event Data[performanceSummaryRef] = %v, want nil", got)
	}
	if got := events[0].Data["another"]; got != nil {
		t.Fatalf("stored event Data[another] = %v, want nil", got)
	}
}

func TestStoreAttachDetailRef(t *testing.T) {
	store := NewStore()

	appended, err := store.Append(protocol.Event{
		SessionID: "session-1",
		RunID:     "run-1",
		Source:    "localbridge",
		Kind:      "session",
		Phase:     "completed",
		Status:    "completed",
		Data: map[string]interface{}{
			"status": "success",
		},
	})
	if err != nil {
		t.Fatalf("Append() error = %v", err)
	}

	updated, err := store.AttachDetailRef(appended.SessionID, appended.Seq, "perf-1", map[string]interface{}{
		"performanceSummaryRef": "perf-1",
	})
	if err != nil {
		t.Fatalf("AttachDetailRef() error = %v", err)
	}
	if updated.Seq != appended.Seq {
		t.Fatalf("updated Seq = %d, want %d", updated.Seq, appended.Seq)
	}
	if updated.DetailRef != "perf-1" {
		t.Fatalf("updated DetailRef = %q, want perf-1", updated.DetailRef)
	}
	if got := updated.Data["performanceSummaryRef"]; got != "perf-1" {
		t.Fatalf("updated Data[performanceSummaryRef] = %v, want perf-1", got)
	}

	events := store.ListRun("session-1", "run-1")
	if len(events) != 1 {
		t.Fatalf("ListRun() len = %d, want 1", len(events))
	}
	if events[0].Seq != appended.Seq {
		t.Fatalf("stored Seq = %d, want %d", events[0].Seq, appended.Seq)
	}
	if events[0].DetailRef != "perf-1" {
		t.Fatalf("stored DetailRef = %q, want perf-1", events[0].DetailRef)
	}
	if got := events[0].Data["performanceSummaryRef"]; got != "perf-1" {
		t.Fatalf("stored Data[performanceSummaryRef] = %v, want perf-1", got)
	}
}
