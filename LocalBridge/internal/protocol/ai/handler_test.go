package ai

import (
	"context"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

func TestValidateProxyURL(t *testing.T) {
	tests := []struct {
		name    string
		url     string
		wantErr bool
	}{
		{name: "https", url: "https://api.example.com/v1/chat"},
		{name: "localhost", url: "http://127.0.0.1:11434/api"},
		{name: "unsupported scheme", url: "file:///tmp/key", wantErr: true},
		{name: "missing host", url: "http:///v1/chat", wantErr: true},
		{name: "userinfo", url: "https://user:pass@example.com/v1", wantErr: true},
		{name: "metadata hostname", url: "http://metadata.google.internal/", wantErr: true},
		{name: "metadata address", url: "http://169.254.169.254/latest", wantErr: true},
		{name: "link local address", url: "http://169.254.1.1/", wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := validateProxyURL(test.url)
			if (err != nil) != test.wantErr {
				t.Fatalf("validateProxyURL(%q) error = %v, wantErr = %v", test.url, err, test.wantErr)
			}
		})
	}
}

func TestParseProxyRequestPreservesRequestIDOnValidationError(t *testing.T) {
	request, err := parseProxyRequest(models.Message{Data: map[string]interface{}{
		"request_id": "request-1",
		"url":        "ftp://example.com/file",
		"method":     "POST",
	}})
	if err == nil {
		t.Fatal("parseProxyRequest() error = nil, want error")
	}
	if request.id != "request-1" {
		t.Fatalf("request id = %q, want request-1", request.id)
	}
}

func TestParseProxyRequestUsesConfiguredTimeout(t *testing.T) {
	request, err := parseProxyRequest(models.Message{Data: map[string]interface{}{
		"request_id": "request-timeout",
		"url":        "https://api.example.com/v1/chat",
		"method":     "POST",
		"timeout_ms": float64((10 * time.Minute).Milliseconds()),
	}})
	if err != nil {
		t.Fatalf("parseProxyRequest() error = %v", err)
	}
	if request.timeout != 10*time.Minute {
		t.Fatalf("timeout = %v, want 10m", request.timeout)
	}
}

func TestParseProxyRequestRejectsMissingTimeout(t *testing.T) {
	_, err := parseProxyRequest(models.Message{Data: map[string]interface{}{
		"request_id": "request-timeout",
		"url":        "https://api.example.com/v1/chat",
		"method":     "POST",
	}})
	if err == nil || !strings.Contains(err.Error(), "timeout_ms") {
		t.Fatalf("parseProxyRequest() error = %v, want timeout_ms error", err)
	}
}

func TestReadLimitedBody(t *testing.T) {
	body, err := readLimitedBody(strings.NewReader("12345"), 5)
	if err != nil {
		t.Fatalf("readLimitedBody() error = %v", err)
	}
	if string(body) != "12345" {
		t.Fatalf("body = %q, want 12345", body)
	}

	if _, err := readLimitedBody(strings.NewReader("123456"), 5); err == nil {
		t.Fatal("readLimitedBody() error = nil for oversized body")
	}
}

func TestAIHandlerRequestTimeout(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		<-request.Context().Done()
	}))
	defer server.Close()

	handler := NewAIHandler()
	ctx, active, err := handler.beginRequest("timeout", 20*time.Millisecond, nil)
	if err != nil {
		t.Fatalf("beginRequest() error = %v", err)
	}
	defer active.cancel()

	_, err = handler.doRequest(ctx, proxyRequest{
		id:     "timeout",
		url:    server.URL,
		method: http.MethodGet,
	})
	if err == nil {
		t.Fatal("doRequest() error = nil, want timeout")
	}
	if ctx.Err() != context.DeadlineExceeded {
		t.Fatalf("context error = %v, want deadline exceeded", ctx.Err())
	}
}

func TestAIHandlerCancel(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		<-request.Context().Done()
	}))
	defer server.Close()

	handler := NewAIHandler()
	ctx, active, err := handler.beginRequest("cancel", time.Second, nil)
	if err != nil {
		t.Fatalf("beginRequest() error = %v", err)
	}
	requestDone := make(chan error, 1)
	go func() {
		_, requestErr := handler.doRequest(ctx, proxyRequest{
			id:     "cancel",
			url:    server.URL,
			method: http.MethodGet,
		})
		requestDone <- requestErr
	}()

	active.cancel()
	select {
	case requestErr := <-requestDone:
		if requestErr == nil {
			t.Fatal("doRequest() error = nil after cancel")
		}
	case <-time.After(time.Second):
		t.Fatal("doRequest() did not return after cancel")
	}
}

func TestScanStream(t *testing.T) {
	var chunks []string
	err := scanStream(context.Background(), strings.NewReader("data: one\n\ndata: two\n"), func(chunk string) error {
		chunks = append(chunks, chunk)
		return nil
	})
	if err != nil {
		t.Fatalf("scanStream() error = %v", err)
	}
	want := []string{"data: one\n", "\n", "data: two\n"}
	if !reflect.DeepEqual(chunks, want) {
		t.Fatalf("chunks = %q, want %q", chunks, want)
	}
}

func TestBeginRequestRejectsDuplicateID(t *testing.T) {
	handler := NewAIHandler()
	_, active, err := handler.beginRequest("duplicate", time.Second, nil)
	if err != nil {
		t.Fatalf("first beginRequest() error = %v", err)
	}
	defer active.cancel()

	if _, _, err := handler.beginRequest("duplicate", time.Second, nil); err == nil {
		t.Fatal("second beginRequest() error = nil, want duplicate error")
	}
}
