package projectinterface

import (
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	run "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/service/interfacerun"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

func TestStopAlwaysRepliesWhenRuntimeIsAlreadyIdle(t *testing.T) {
	if err := logger.Init("error", "", false); err != nil {
		t.Fatal(err)
	}
	bus := eventbus.New()
	svc := run.New(nil, nil, bus, "test")
	ws := server.NewWebSocketServer("127.0.0.1", 0, bus, nil)
	handler := NewRunHandler(svc, bus, ws)
	ws.SetMessageHandler(func(msg models.Message, conn *server.Connection) { handler.Handle(msg, conn) })
	ready, done := make(chan string, 1), make(chan error, 1)
	go func() { done <- ws.StartWithReady(func(address string) { ready <- address }) }()
	t.Cleanup(func() {
		_ = ws.Stop()
		select {
		case <-done:
		case <-time.After(3 * time.Second):
			t.Error("test server did not stop")
		}
	})
	var address string
	select {
	case address = <-ready:
	case err := <-done:
		t.Fatalf("server failed: %v", err)
	case <-time.After(3 * time.Second):
		t.Fatal("test server did not start")
	}
	conn, _, err := websocket.DefaultDialer.Dial(address, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	for i := 0; i < 2; i++ {
		if err := conn.WriteJSON(models.Message{Path: "/etl/interface-run/stop", Data: map[string]string{"requestId": "stop", "runId": ""}}); err != nil {
			t.Fatal(err)
		}
		_ = conn.SetReadDeadline(time.Now().Add(3 * time.Second))
		var reply models.Message
		if err := conn.ReadJSON(&reply); err != nil {
			t.Fatalf("idempotent stop was not acknowledged: %v", err)
		}
		if reply.Path != "/lte/interface-run/state" || reply.Data.(map[string]any)["status"] != "idle" {
			t.Fatalf("unexpected acknowledgement: %#v", reply)
		}
	}
}
