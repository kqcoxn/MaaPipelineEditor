package managed

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type Status struct {
	ID      string `json:"id"`
	PID     int    `json:"pid"`
	Version string `json:"version"`
	Root    string `json:"root"`
	Address string `json:"address"`
	State   string `json:"state"`
	Managed bool   `json:"managed"`
}
type discovery struct {
	Endpoint string `json:"endpoint"`
	Token    string `json:"token"`
}
type Service struct {
	mu        sync.Mutex
	status    Status
	lock      *Lock
	server    *http.Server
	stop      chan struct{}
	once      sync.Once
	closed    chan struct{}
	closeOnce sync.Once
}

func discoveryPath() string { return filepath.Join(Directory(), "service.json") }
func Start(version, root string, managed bool) (*Service, error) {
	lock, err := Acquire(filepath.Join(Directory(), "service.lock"), false)
	if err != nil {
		return nil, err
	}
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		lock.Close()
		return nil, err
	}
	token := make([]byte, 32)
	if _, err = rand.Read(token); err != nil {
		listener.Close()
		lock.Close()
		return nil, err
	}
	secret := hex.EncodeToString(token)
	s := &Service{lock: lock, stop: make(chan struct{}), closed: make(chan struct{}), status: Status{ID: secret[:24], PID: os.Getpid(), Version: version, Root: root, State: "starting", Managed: managed}}
	mux := http.NewServeMux()
	mux.HandleFunc("/status", func(w http.ResponseWriter, r *http.Request) {
		s.mu.Lock()
		defer s.mu.Unlock()
		_ = json.NewEncoder(w).Encode(s.status)
	})
	mux.HandleFunc("/stop", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(405)
			return
		}
		s.mu.Lock()
		id := s.status.ID
		s.mu.Unlock()
		if r.URL.Query().Get("id") != id {
			w.WriteHeader(409)
			return
		}
		s.RequestStop()
		_ = json.NewEncoder(w).Encode(map[string]bool{"stopping": true})
	})
	mux.HandleFunc("/force", func(w http.ResponseWriter, r *http.Request) {
		s.mu.Lock()
		id := s.status.ID
		s.mu.Unlock()
		if r.Method != http.MethodPost || r.URL.Query().Get("id") != id {
			w.WriteHeader(409)
			return
		}
		w.WriteHeader(202)
		// This endpoint is only called after the user explicitly selected force stop.
		go func() { time.Sleep(100 * time.Millisecond); os.Exit(1) }()
	})
	s.server = &http.Server{ReadHeaderTimeout: 3 * time.Second, Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer "+secret || r.Header.Get("Origin") != "" {
			w.WriteHeader(403)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		mux.ServeHTTP(w, r)
	})}
	data, _ := json.Marshal(discovery{Endpoint: "http://" + listener.Addr().String(), Token: secret})
	// Remove first: stale discovery files must not retain permissions inherited elsewhere.
	_ = os.Remove(discoveryPath())
	if err = os.WriteFile(discoveryPath(), data, 0600); err != nil {
		listener.Close()
		lock.Close()
		return nil, err
	}
	go func() { _ = s.server.Serve(listener) }()
	return s, nil
}
func (s *Service) Ready(address string) {
	s.mu.Lock()
	s.status.Address = address
	s.status.State = "ready"
	s.mu.Unlock()
}
func (s *Service) RequestStop() {
	s.once.Do(func() { s.mu.Lock(); s.status.State = "stopping"; s.mu.Unlock(); close(s.stop) })
}
func (s *Service) Done() <-chan struct{}   { return s.stop }
func (s *Service) Closed() <-chan struct{} { return s.closed }
func (s *Service) Close() {
	s.closeOnce.Do(func() {
		_ = s.server.Close()
		_ = os.Remove(discoveryPath())
		s.lock.Close()
		close(s.closed)
	})
}

var ErrNotRunning = errors.New("没有正在运行的 mpelb")

func request(ctx context.Context, method, route string, result any) error {
	// A free kernel lock means that any discovery record is stale.
	if l, err := Acquire(filepath.Join(Directory(), "service.lock"), false); err == nil {
		l.Close()
		return ErrNotRunning
	}
	data, err := os.ReadFile(discoveryPath())
	if err != nil {
		return err
	}
	var d discovery
	if err = json.Unmarshal(data, &d); err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, method, d.Endpoint+route, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+d.Token)
	client := &http.Client{Timeout: 3 * time.Second, Transport: &http.Transport{Proxy: nil}}
	defer client.CloseIdleConnections()
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("服务控制失败: HTTP %d", resp.StatusCode)
	}
	if result != nil {
		return json.NewDecoder(resp.Body).Decode(result)
	}
	return nil
}
func Query(ctx context.Context) (Status, error) {
	var s Status
	err := request(ctx, "GET", "/status", &s)
	return s, err
}
func Stop(ctx context.Context, id string, force bool) error {
	route := "/stop"
	if force {
		route = "/force"
	}
	if err := request(ctx, "POST", route+"?id="+id, nil); err != nil {
		return err
	}
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return fmt.Errorf("停止超时，可选择强制结束: %w", ctx.Err())
		case <-ticker.C:
			if l, err := Acquire(filepath.Join(Directory(), "service.lock"), false); err == nil {
				l.Close()
				return nil
			}
		}
	}
}

func (s *Service) SetRoot(root string) { s.mu.Lock(); s.status.Root = root; s.mu.Unlock() }
