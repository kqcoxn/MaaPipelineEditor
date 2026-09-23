package projectinterface

import (
	"reflect"
	"strings"
	"testing"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
)

func TestSupervisorStreamsRawOutputWithoutSnapshotDeduplication(t *testing.T) {
	s := NewSupervisor(eventbus.New())
	process := &supervisedProcess{}
	var output []string
	s.SetOutputHandler(func(line string) { output = append(output, line) })
	// More identical lines than the diagnostic ring holds must all be delivered.
	process.captureDone.Add(2)
	s.capture(process, "stdout", strings.NewReader(strings.Repeat("相同的 print\n", 510)+"\n  <b>原文</b>  \n最后一行"))
	s.capture(process, "stderr", strings.NewReader("[stdout] 程序自身的前缀\n"))
	if len(output) != 514 {
		t.Fatalf("expected every printed line, got %d", len(output))
	}
	for _, line := range output[:510] {
		if line != "相同的 print" {
			t.Fatalf("unexpected diagnostic prefix: %q", line)
		}
	}
	if !reflect.DeepEqual(output[510:], []string{"", "  <b>原文</b>  ", "最后一行", "[stdout] 程序自身的前缀"}) {
		t.Fatalf("output was changed: %#v", output[510:])
	}
}
