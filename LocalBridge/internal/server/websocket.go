package server

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

// 通信协议版本
const ProtocolVersion = "0.3.1"

// 版本握手路由
const (
	PathHandshake         = "/system/handshake"
	PathHandshakeResponse = "/system/handshake/response"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// 消息处理函数类型
type MessageHandler func(msg models.Message, conn *Connection)

// WebSocket 服务器
type WebSocketServer struct {
	host           string
	port           int
	connections    map[*Connection]bool
	register       chan *Connection
	unregister     chan *Connection
	messageHandler MessageHandler
	eventBus       *eventbus.EventBus
	mu             sync.RWMutex
	server         *http.Server
}

// 创建 WebSocket 服务器
func NewWebSocketServer(host string, port int, eventBus *eventbus.EventBus) *WebSocketServer {
	return &WebSocketServer{
		host:        host,
		port:        port,
		connections: make(map[*Connection]bool),
		register:    make(chan *Connection),
		unregister:  make(chan *Connection),
		eventBus:    eventBus,
	}
}

// 设置消息处理器
func (s *WebSocketServer) SetMessageHandler(handler MessageHandler) {
	s.messageHandler = handler
}

// 启动服务器
func (s *WebSocketServer) Start() error {
	// 启动连接管理协程
	go s.run()

	// 设置 HTTP 路由
	mux := http.NewServeMux()
	mux.HandleFunc("/", s.handleWebSocket)

	// 创建 HTTP 服务器
	s.server = &http.Server{
		Addr:         fmt.Sprintf("%s:%d", s.host, s.port),
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	logger.Info("WebSocket", "服务器已启动，监听地址: %s:%d", s.host, s.port)
	// 根据端口动态生成在线服务地址
	onlineURL := fmt.Sprintf("https://mpe.codax.site/stable/?link_lb=true&port=%d", s.port)
	logger.Info("Main", "在线服务地址: %s", onlineURL)

	// 启动服务器
	if err := s.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("服务器启动失败: %w", err)
	}

	return nil
}

// 停止服务器
func (s *WebSocketServer) Stop() error {
	logger.Info("WebSocket", "正在关闭服务器...")

	// 关闭所有连接
	s.mu.Lock()
	for conn := range s.connections {
		close(conn.send)
	}
	s.mu.Unlock()

	// 关闭 HTTP 服务器
	if s.server != nil {
		return s.server.Close()
	}

	return nil
}

// 运行连接管理
func (s *WebSocketServer) run() {
	for {
		select {
		case conn := <-s.register:
			s.mu.Lock()
			s.connections[conn] = true
			s.mu.Unlock()

			logger.Info("WebSocket", "客户端已连接: %s", conn.ID)

			// 发布连接建立事件
			s.eventBus.Publish(eventbus.EventConnectionEstablished, conn.ID)

		case conn := <-s.unregister:
			s.mu.Lock()
			if _, ok := s.connections[conn]; ok {
				delete(s.connections, conn)
				close(conn.send)
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
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		logger.Error("WebSocket", "升级连接失败: %v", err)
		return
	}

	// 创建连接对象
	connection := newConnection(r.RemoteAddr, conn, s)

	// 注册连接
	s.register <- connection

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
