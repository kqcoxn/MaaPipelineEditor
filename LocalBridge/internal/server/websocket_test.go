package server

import (
	"net/http/httptest"
	"testing"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

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
