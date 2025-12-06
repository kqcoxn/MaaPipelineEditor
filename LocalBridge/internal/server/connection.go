package server

import (
	"encoding/json"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

// Connection WebSocket连接
type Connection struct {
	ID     string
	conn   *websocket.Conn
	send   chan []byte
	server *WebSocketServer
	mu     sync.Mutex
}

// newConnection 创建新连接
func newConnection(id string, conn *websocket.Conn, server *WebSocketServer) *Connection {
	return &Connection{
		ID:     id,
		conn:   conn,
		send:   make(chan []byte, 256),
		server: server,
	}
}

// readPump 读取客户端消息
func (c *Connection) readPump() {
	defer func() {
		c.server.unregister <- c
		c.conn.Close()
	}()

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				logger.Error("WebSocket", "读取消息错误: %v", err)
			}
			break
		}

		// 解析消息
		var msg models.Message
		if err := json.Unmarshal(message, &msg); err != nil {
			logger.Error("WebSocket", "消息解析失败: %v", err)
			continue
		}

		// 传递给路由器处理
		if c.server.messageHandler != nil {
			c.server.messageHandler(msg, c)
		}
	}
}

// writePump 向客户端发送消息
func (c *Connection) writePump() {
	defer func() {
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				logger.Error("WebSocket", "发送消息失败: %v", err)
				return
			}
		}
	}
}

// Send 发送消息到客户端
func (c *Connection) Send(msg models.Message) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	select {
	case c.send <- data:
		return nil
	default:
		logger.Warn("WebSocket", "发送队列已满，消息被丢弃")
		return nil
	}
}
