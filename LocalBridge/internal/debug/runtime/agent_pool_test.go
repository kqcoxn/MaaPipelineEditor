package runtime

import (
	"testing"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
)

func TestPIAgentProfileKeyStableAcrossGeneratedIdentifiers(t *testing.T) {
	agent := protocol.AgentProfile{ID: "pi-agent-1", Identifier: ""}
	first := piAgentProfileKey(agent, "resource-a")
	agent.Identifier = "ipc://generated-by-test"
	second := piAgentProfileKey(agent, "resource-a")
	if first != second {
		t.Fatalf("PI agent reuse key changed with generated identifier: %q != %q", first, second)
	}
}
