package server

import (
	"net"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/websocket"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

func TestDynamicPortReportsConnectableAddress(t *testing.T) {
	if err := logger.Init("error", "", false); err != nil {
		t.Fatal(err)
	}
	s := NewWebSocketServer("127.0.0.1", 0, eventbus.New(), nil)
	defer s.Stop()
	ready := make(chan string, 1)
	done := make(chan error, 1)
	go func() { done <- s.StartWithReady(func(address string) { ready <- address }) }()
	select {
	case address := <-ready:
		connection, _, err := websocket.DefaultDialer.Dial(address, nil)
		if err != nil {
			t.Fatalf("reported address is not connectable: %s: %v", address, err)
		}
		connection.Close()
	case err := <-done:
		t.Fatalf("server exited before ready: %v", err)
	case <-time.After(5 * time.Second):
		t.Fatal("server did not report ready")
	}
	s.Stop()
	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("server did not stop")
	}
}

func TestBindFailureNeverReportsReady(t *testing.T) {
	if err := logger.Init("error", "", false); err != nil {
		t.Fatal(err)
	}
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	s := NewWebSocketServer("127.0.0.1", listener.Addr().(*net.TCPAddr).Port, eventbus.New(), nil)
	ready := false
	if err := s.StartWithReady(func(string) { ready = true }); err == nil {
		t.Fatal("accepted occupied port")
	}
	if ready {
		t.Fatal("reported readiness after bind failure")
	}
	select {
	case <-s.done:
	default:
		t.Fatal("failed service not cleaned up")
	}
}

func TestOriginAllowed(t *testing.T) {
	webSocketServer := NewWebSocketServer(
		"localhost",
		9066,
		eventbus.New(),
		[]string{"https://mpe.codax.site", "http://localhost", "http://127.0.0.1"},
	)

	tests := []struct {
		name    string
		origin  string
		allowed bool
	}{
		{name: "official site", origin: "https://mpe.codax.site", allowed: true},
		{name: "localhost dev server", origin: "http://localhost:5173", allowed: true},
		{name: "loopback dev server", origin: "http://127.0.0.1:4173", allowed: true},
		{name: "native client", origin: "", allowed: true},
		{name: "untrusted site", origin: "https://example.com", allowed: false},
		{name: "malformed origin", origin: "not an origin", allowed: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if allowed := webSocketServer.originAllowed(test.origin); allowed != test.allowed {
				t.Fatalf("originAllowed(%q) = %v, want %v", test.origin, allowed, test.allowed)
			}
		})
	}

	request := httptest.NewRequest("GET", "http://localhost", nil)
	request.Header.Set("Origin", "https://example.com")
	if webSocketServer.originAllowed(request.Header.Get("Origin")) {
		t.Fatal("untrusted request origin was allowed")
	}
}

func TestConnectionDoneClosesOnce(t *testing.T) {
	connection := newConnection("test", nil, nil)
	connection.closeDone()
	connection.closeDone()

	select {
	case <-connection.Done():
	default:
		t.Fatal("connection Done channel was not closed")
	}
}

func TestConnectionRejectsSendAfterClose(t *testing.T) {
	connection := newConnection("test", nil, nil)
	connection.closeSend()
	connection.closeSend()

	if err := connection.Send(models.Message{Path: "/test"}); err == nil {
		t.Fatal("Send() after close succeeded, want an error")
	}
}
