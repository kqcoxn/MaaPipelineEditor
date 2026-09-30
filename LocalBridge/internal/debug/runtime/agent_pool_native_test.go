package runtime

import (
	"errors"
	"net"
	"os"
	"path/filepath"
	"testing"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
)

func TestNativePIAgentPoolOwnership(t *testing.T) {
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
	t.Cleanup(func() {
		if err := maa.Release(); err != nil {
			t.Errorf("release: %v", err)
		}
	})
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "pipeline"), 0755); err != nil {
		t.Fatal(err)
	}
	pipeline := filepath.Join(root, "pipeline", "test.json")
	writePipeline := func(content string) {
		t.Helper()
		if err := os.WriteFile(pipeline, []byte(content), 0644); err != nil {
			t.Fatal(err)
		}
	}
	writePipeline(`{"Seed":{}}`)
	pool := NewAgentPool()
	t.Cleanup(pool.Close)
	agent := protocol.AgentProfile{ID: "pi-agent", Enabled: true}
	var startedIdentifier string
	starter := func(identifier string) error { startedIdentifier = identifier; return nil }
	prepared, err := pool.PreparePIAgent(agent, []string{root}, starter, "project")
	if err != nil {
		t.Fatal(err)
	}
	if prepared.Identifier == "" || prepared.Identifier != startedIdentifier {
		t.Fatalf("child identifier differs from prepared profile: %q vs %q", startedIdentifier, prepared.Identifier)
	}
	client, err := pool.Acquire(prepared)
	if err != nil {
		t.Fatal(err)
	}
	again, err := pool.PreparePIAgent(agent, []string{root}, starter, "project")
	if err != nil {
		t.Fatal(err)
	}
	bound, err := pool.EnsureBound(again, []string{root})
	if err != nil || bound != client || again.Identifier != prepared.Identifier || pool.GetResource(again) == nil {
		t.Fatalf("repeated run did not reuse client/resource: %v", err)
	}
	startErr := errors.New("child startup failed")
	if _, err := pool.PreparePIAgent(agent, []string{root}, func(string) error { return startErr }, "project"); !errors.Is(err, startErr) {
		t.Fatalf("lost startup failure: %v", err)
	}
	if id, err := client.Identifier(); err != nil || id != prepared.Identifier {
		t.Fatalf("failed restart destroyed pooled client: %q, %v", id, err)
	}
	pool.Close()

	// 新客户端在启动失败或资源加载失败时必须释放 socket，不能留下不可重试的占用。
	for _, stage := range []string{"startup", "resource"} {
		t.Run(stage, func(t *testing.T) {
			if stage == "resource" {
				writePipeline(`{"Seed":`)
			}
			seed, err := maa.NewAgentClient(maa.WithTcpPort(0))
			if err != nil {
				t.Fatal(err)
			}
			identifier, err := seed.Identifier()
			seed.Destroy()
			if err != nil {
				t.Fatal(err)
			}
			agent.Identifier = identifier
			_, err = pool.PreparePIAgent(agent, []string{root}, func(string) error {
				if stage == "startup" {
					return startErr
				}
				return nil
			})
			if err == nil {
				t.Fatal("expected preparation failure")
			}
			if len(pool.clients) != 0 || len(pool.piIdentifiers) != 0 {
				t.Fatal("failed preparation was cached")
			}
			listener, err := net.Listen("tcp4", "127.0.0.1:"+identifier)
			if err != nil {
				t.Fatalf("failed preparation left port occupied: %v", err)
			}
			_ = listener.Close()
		})
	}
}
