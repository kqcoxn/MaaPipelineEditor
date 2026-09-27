package mfw

import (
	"bytes"
	"context"
	"os"
	"os/exec"
	"slices"
	"strconv"
	"testing"
	"time"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
)

// 使用真实 MaaFramework 和独立 AgentServer 子进程验证端口 identifier 协议；不连接设备。
func TestNativeProjectAgentTCP(t *testing.T) {
	lib := os.Getenv("MPE_MFW_TEST_LIB_DIR")
	if lib == "" {
		t.Skip("requires MPE_MFW_TEST_LIB_DIR")
	}
	if err := logger.Init("ERROR", "", false); err != nil {
		t.Fatal(err)
	}
	if err := maa.Init(maa.WithLibDir(lib), maa.WithLogDir(t.TempDir()), maa.WithStdoutLevel(maa.LoggingLevelOff)); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = maa.Release() })
	if identifier := os.Getenv("MPE_TEST_PROJECT_AGENT_IDENTIFIER"); identifier != "" {
		if err := maa.AgentServerRegisterCustomAction("ProjectAgentProbe", maa.CustomActionFunc(func(*maa.Context, *maa.CustomActionArg) bool { return true })); err != nil {
			t.Fatal(err)
		}
		if err := maa.AgentServerStartUp(identifier); err != nil {
			t.Fatal(err)
		}
		maa.AgentServerJoin()
		maa.AgentServerShutDown()
		return
	}
	t.Logf("loaded MaaFramework %s", maa.Version())
	resource, err := maa.NewResource()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(resource.Destroy)
	// 即使本机为 macOS/Linux，也走 Windows 的自动 TCP 创建分支。
	client, identifier, err := newProjectAgentClient("", "windows")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(client.Destroy)
	port, err := strconv.ParseUint(identifier, 10, 16)
	if err != nil || port == 0 {
		t.Fatalf("expected allocated TCP port, got %q: %v", identifier, err)
	}
	other, otherID, err := newProjectAgentClient("", "windows")
	if err != nil {
		t.Fatal(err)
	}
	other.Destroy()
	if otherID == identifier {
		t.Fatalf("simultaneous clients share port %s", identifier)
	}
	if err := client.BindResource(resource); err != nil {
		t.Fatal(err)
	}
	if err := client.SetTimeout(5 * time.Second); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	child := exec.CommandContext(ctx, os.Args[0], "-test.run=^TestNativeProjectAgentTCP$")
	child.Env = append(os.Environ(), "MPE_TEST_PROJECT_AGENT_IDENTIFIER="+identifier)
	var output bytes.Buffer
	child.Stdout, child.Stderr = &output, &output
	if err := child.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() { cancel(); _ = child.Wait() }()
	if err := client.Connect(); err != nil {
		t.Fatalf("TCP AgentServer handshake failed: %v", err)
	}
	actions, err := client.GetCustomActionList()
	if err != nil || !slices.Contains(actions, "ProjectAgentProbe") {
		t.Fatalf("agent registrations missing after handshake: %v, %v", actions, err)
	}
	if err := client.Disconnect(); err != nil {
		t.Fatal(err)
	}
	if err := child.Wait(); err != nil {
		t.Fatalf("AgentServer exit: %v\n%s", err, output.String())
	}
}
