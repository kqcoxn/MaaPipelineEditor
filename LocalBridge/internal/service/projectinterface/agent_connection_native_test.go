package projectinterface

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
)

func TestNativeAgentStartupLifecycle(t *testing.T) {
	lib, python := os.Getenv("MPE_MFW_TEST_LIB_DIR"), os.Getenv("MPE_MFW_TEST_PYTHON")
	if lib == "" || python == "" {
		t.Skip("requires MPE_MFW_TEST_LIB_DIR and MPE_MFW_TEST_PYTHON")
	}
	if err := logger.Init("ERROR", "", false); err != nil {
		t.Fatal(err)
	}
	if err := maa.Init(maa.WithLibDir(lib), maa.WithLogDir(t.TempDir()), maa.WithStdoutLevel(maa.LoggingLevelOff)); err != nil {
		t.Fatal(err)
	}
	defer maa.Release()
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "pipeline"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "pipeline", "main.json"), []byte(`{"Seed":{}}`), 0600); err != nil {
		t.Fatal(err)
	}
	resource, err := maa.NewResource()
	if err != nil {
		t.Fatal(err)
	}
	defer resource.Destroy()
	if !resource.PostBundle(root).Wait().Success() {
		t.Fatal("resource load failed")
	}
	client, identifier, err := mfw.NewProjectAgentClient("")
	if err != nil {
		t.Fatal(err)
	}
	defer client.Destroy()
	if err := client.BindResource(resource); err != nil {
		t.Fatal(err)
	}
	bus := eventbus.New()
	supervisor := NewSupervisor(bus)
	defer supervisor.StopAll()
	plan := &RuntimePlan{ContextID: "native", ProjectID: "test", InterfaceRoot: root}
	agent := AgentPlan{ID: "python", ChildExec: python, ChildArgs: []string{"-u", "-c", "import sys,time; time.sleep(3); from maa.agent.agent_server import AgentServer; AgentServer.start_up(sys.argv[-1]); AgentServer.join(); AgentServer.shut_down()"}}
	if err := supervisor.Ensure(plan, agent, identifier, nil); err != nil {
		t.Fatal(err)
	}
	started := time.Now()
	if err := supervisor.ConnectAgent(context.Background(), plan.ContextID, agent.ID, client, 2*time.Second); err != nil {
		t.Fatal(err)
	}
	if time.Since(started) < 2*time.Second || !client.Connected() {
		t.Fatal("did not wait for the delayed Python server")
	}
	if err := client.Disconnect(); err != nil {
		t.Fatal(err)
	}
	supervisor.StopAgentIfRunning(plan.ContextID, agent.ID)

	// Cancellation during preparation leaves the same client reusable.
	agent.ChildArgs[2] = "import time; time.sleep(60)"
	if err := supervisor.Ensure(plan, agent, identifier, nil); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := supervisor.ConnectAgent(ctx, plan.ContextID, agent.ID, client, 2*time.Second); !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
	supervisor.StopAgentIfRunning(plan.ContextID, agent.ID)
	agent.ChildArgs[2] = "import sys; sys.exit(7)"
	if err := supervisor.Ensure(plan, agent, identifier, nil); err != nil {
		t.Fatal(err)
	}
	if err := supervisor.ConnectAgent(context.Background(), plan.ContextID, agent.ID, client, 2*time.Second); err == nil || !strings.Contains(err.Error(), "退出码 7") {
		t.Fatalf("lost early exit: %v", err)
	}
	supervisor.StopAgentIfRunning(plan.ContextID, agent.ID)
	agent.ChildArgs[2] = "import sys; from maa.agent.agent_server import AgentServer; AgentServer.start_up(sys.argv[-1]); AgentServer.join(); AgentServer.shut_down()"
	if err := supervisor.Ensure(plan, agent, identifier, nil); err != nil {
		t.Fatal(err)
	}
	if err := supervisor.ConnectAgent(context.Background(), plan.ContextID, agent.ID, client, 2*time.Second); err != nil {
		t.Fatalf("retry failed: %v", err)
	}
	// The process can exit while the native client still reports Connected.
	// A replacement process must receive a new startup handshake.
	supervisor.StopAgentIfRunning(plan.ContextID, agent.ID)
	if err := supervisor.Ensure(plan, agent, identifier, nil); err != nil {
		t.Fatal(err)
	}
	if err := supervisor.ConnectAgent(context.Background(), plan.ContextID, agent.ID, client, 2*time.Second); err != nil {
		t.Fatalf("replacement handshake failed: %v", err)
	}
	if err := client.Disconnect(); err != nil {
		t.Fatal(err)
	}
}
