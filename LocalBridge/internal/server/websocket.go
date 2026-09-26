package server

import (
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

// 通信协议版本
const ProtocolVersion = "2.0.1"

// 版本握手路由
const (
	PathHandshake         = "/system/handshake"
	PathHandshakeResponse = "/system/handshake/response"
)

// 消息处理函数类型
type MessageHandler func(msg models.Message, conn *Connection)

// WebSocket 服务器
type WebSocketServer struct {
	host           string
	port           int
	connections    map[*Connection]bool
	register       chan *Connection
	unregister     chan *Connection
	done           chan struct{}
	stopOnce       sync.Once
	messageHandler MessageHandler
	eventBus       *eventbus.EventBus
	mu             sync.RWMutex
	server         *http.Server
	allowedOrigins []string
}

// 创建 WebSocket 服务器
func NewWebSocketServer(
	host string,
	port int,
	eventBus *eventbus.EventBus,
	allowedOrigins []string,
) *WebSocketServer {
	server := &WebSocketServer{
		host:           host,
		port:           port,
		connections:    make(map[*Connection]bool),
		register:       make(chan *Connection),
		unregister:     make(chan *Connection),
		done:           make(chan struct{}),
		eventBus:       eventBus,
		allowedOrigins: append([]string(nil), allowedOrigins...),
	}
	return server
}

// 设置消息处理器
func (s *WebSocketServer) SetMessageHandler(handler MessageHandler) {
	s.messageHandler = handler
}

// 启动服务器
func (s *WebSocketServer) Start() error { return s.StartWithReady(nil) }

func (s *WebSocketServer) StartWithReady(ready func(string)) error {
	defer s.Stop()

	// 设置 HTTP 路由
	mux := http.NewServeMux()
	mux.HandleFunc("/", s.handleWebSocket)

	// 创建 HTTP 服务器
	server := &http.Server{
		Addr:         fmt.Sprintf("%s:%d", s.host, s.port),
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}
	s.mu.Lock()
	s.server = server
	s.mu.Unlock()

	// 启动服务器
	listener, err := net.Listen("tcp", server.Addr)
	if err != nil {
		return err
	}
	select {
	case <-s.done:
		listener.Close()
		return nil
	default:
	}
	go s.run()
	logger.Info("WebSocket", "服务器已启动，监听地址: %s", listener.Addr())
	onlineURL := fmt.Sprintf("https://mpe.codax.site/stable/?link_lb=true&port=%d", listener.Addr().(*net.TCPAddr).Port)
	logger.Info("Main", "在线服务地址: %s", onlineURL)
	if ready != nil {
		ready("ws://" + listener.Addr().String())
	}
	if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("服务器启动失败: %w", err)
	}

	return nil
}

func (s *WebSocketServer) originAllowed(origin string) bool {
	if strings.TrimSpace(origin) == "" {
		// 非浏览器客户端通常不会发送 Origin。
		return true
	}

	parsedOrigin, err := url.Parse(origin)
	if err != nil || parsedOrigin.Scheme == "" || parsedOrigin.Hostname() == "" {
		return false
	}

	for _, allowedOrigin := range s.allowedOrigins {
		parsedAllowed, err := url.Parse(strings.TrimSpace(allowedOrigin))
		if err != nil || parsedAllowed.Scheme == "" || parsedAllowed.Hostname() == "" {
			continue
		}
		if parsedOrigin.Scheme != parsedAllowed.Scheme ||
			!strings.EqualFold(parsedOrigin.Hostname(), parsedAllowed.Hostname()) {
			continue
		}

		// 未指定端口的本机 Origin 允许开发服务器使用任意端口。
		if parsedAllowed.Port() == "" && isLoopbackHost(parsedAllowed.Hostname()) {
			return true
		}
		if parsedOrigin.Port() == parsedAllowed.Port() {
			return true
		}
	}

	return false
}

func isLoopbackHost(hostname string) bool {
	ip := net.ParseIP(hostname)
	return strings.EqualFold(hostname, "localhost") || (ip != nil && ip.IsLoopback())
}

// 停止服务器
func (s *WebSocketServer) Stop() error {
	s.stopOnce.Do(func() { close(s.done) })
	logger.Info("WebSocket", "正在关闭服务器...")

	// 关闭所有连接
	s.mu.Lock()
	for conn := range s.connections {
		conn.closeSend()
		conn.closeDone()
		_ = conn.conn.Close()
	}
	server := s.server
	s.mu.Unlock()

	// 关闭 HTTP 服务器
	if server != nil {
		return server.Close()
	}

	return nil
}

// 运行连接管理
func (s *WebSocketServer) run() {
	for {
		select {
		case <-s.done:
			return
		case conn := <-s.register:
			s.mu.Lock()
			select {
			case <-s.done:
				s.mu.Unlock()
				_ = conn.conn.Close()
				continue
			default:
			}
			s.connections[conn] = true
			s.mu.Unlock()

			logger.Info("WebSocket", "客户端已连接: %s", conn.ID)

			// 发布连接建立事件，传递 Connection 对象
			s.eventBus.Publish(eventbus.EventConnectionEstablished, conn)

		case conn := <-s.unregister:
			s.mu.Lock()
			if _, ok := s.connections[conn]; ok {
				delete(s.connections, conn)
				conn.closeSend()
			}
			s.mu.Unlock()

			logger.Info("WebSocket", "客户端已断开: %s", conn.ID)

			// 发布连接关闭事件
			s.eventBus.Publish(eventbus.EventConnectionClosed, conn.ID)
		}
	}
}

// 处理WebSocket连接请求
func (s *WebSocketServer) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	upgrader := websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(request *http.Request) bool {
			return s.originAllowed(request.Header.Get("Origin"))
		},
	}
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		logger.Error("WebSocket", "升级连接失败: %v", err)
		return
	}

	// 创建连接对象
	connection := newConnection(r.RemoteAddr, conn, s)

	// 注册连接
	select {
	case s.register <- connection:
	case <-s.done:
		_ = conn.Close()
		return
	}

	// 启动读写协程
	go connection.writePump()
	go connection.readPump()
}

// 广播消息给所有连接
func (s *WebSocketServer) Broadcast(msg models.Message) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for conn := range s.connections {
		conn.Send(msg)
	}
}

// 获取活跃连接数
func (s *WebSocketServer) GetActiveConnections() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.connections)
}
