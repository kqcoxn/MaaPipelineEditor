package router

import (
	"strings"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/errors"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

// 系统路由常量
const (
	PathHandshake         = "/system/handshake"
	PathHandshakeResponse = "/system/handshake/response"
)

// 协议处理器接口
type Handler interface {
	// 返回处理的路由前缀
	GetRoutePrefix() []string

	// 处理消息
	Handle(msg models.Message, conn *server.Connection) *models.Message
}

// 路由分发器
type Router struct {
	handlers map[string]Handler // key: 路由前缀
}

// 创建路由分发器
func New() *Router {
	return &Router{
		handlers: make(map[string]Handler),
	}
}

// 注册处理器
func (r *Router) RegisterHandler(handler Handler) {
	prefixes := handler.GetRoutePrefix()
	for _, prefix := range prefixes {
		r.handlers[prefix] = handler
		logger.Debug("Router", "注册路由处理器: %s", prefix)
	}
}

// 路由分发
func (r *Router) Route(msg models.Message, conn *server.Connection) {
	path := msg.Path

	// 处理版本握手
	if path == PathHandshake {
		r.handleHandshake(msg, conn)
		return
	}

	// 查找匹配的处理器
	handler := r.findHandler(path)
	if handler == nil {
		logger.Warn("Router", "未找到路由处理器: %s", path)
		r.sendError(conn, errors.NewInvalidRequestError("未知的路由: "+path))
		return
	}

	// 调用处理器
	response := handler.Handle(msg, conn)

	// 如果有响应消息，发送给客户端
	if response != nil {
		if err := conn.Send(*response); err != nil {
			logger.Error("Router", "发送响应失败: %v", err)
		}
	}
}

// 查找匹配的处理器
func (r *Router) findHandler(path string) Handler {
	// 精确匹配
	if handler, ok := r.handlers[path]; ok {
		return handler
	}

	// 前缀匹配
	for prefix, handler := range r.handlers {
		if strings.HasPrefix(path, prefix) {
			return handler
		}
	}

	return nil
}

// 发送错误消息
func (r *Router) sendError(conn *server.Connection, err *errors.LBError) {
	errorMsg := models.Message{
		Path: "/error",
		Data: err.ToErrorData(),
	}

	if sendErr := conn.Send(errorMsg); sendErr != nil {
		logger.Error("Router", "发送错误消息失败: %v", sendErr)
	}
}

// 处理版本握手请求
func (r *Router) handleHandshake(msg models.Message, conn *server.Connection) {
	// 解析客户端版本
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		logger.Error("Router", "握手消息格式错误")
		r.sendHandshakeResponse(conn, false, "握手消息格式错误")
		return
	}

	clientVersion, _ := dataMap["protocol_version"].(string)
	logger.Debug("Router", "收到客户端握手请求，协议版本: %s", clientVersion)

	// 版本验证
	if clientVersion != server.ProtocolVersion {
		logger.Warn("Router", "协议版本不匹配，客户端: %s，服务端: %s", clientVersion, server.ProtocolVersion)
		r.sendHandshakeResponse(conn, false, "协议版本不匹配")
		return
	}

	// 版本匹配
	logger.Debug("Router", "协议版本验证成功: %s", clientVersion)
	r.sendHandshakeResponse(conn, true, "连接成功")
}

// 发送握手响应
func (r *Router) sendHandshakeResponse(conn *server.Connection, success bool, message string) {
	response := models.Message{
		Path: PathHandshakeResponse,
		Data: models.HandshakeResponse{
			Success:         success,
			ServerVersion:   server.ProtocolVersion,
			RequiredVersion: server.ProtocolVersion,
			Message:         message,
		},
	}

	if err := conn.Send(response); err != nil {
		logger.Error("Router", "发送握手响应失败: %v", err)
	}
}
