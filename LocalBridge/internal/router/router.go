package router

import (
	"strings"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/errors"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

// Handler 协议处理器接口
type Handler interface {
	// GetRoutePrefix 返回处理的路由前缀
	GetRoutePrefix() []string

	// Handle 处理消息
	Handle(msg models.Message, conn *server.Connection) *models.Message
}

// Router 路由分发器
type Router struct {
	handlers map[string]Handler // key: route prefix
}

// New 创建路由分发器
func New() *Router {
	return &Router{
		handlers: make(map[string]Handler),
	}
}

// RegisterHandler 注册处理器
func (r *Router) RegisterHandler(handler Handler) {
	prefixes := handler.GetRoutePrefix()
	for _, prefix := range prefixes {
		r.handlers[prefix] = handler
		logger.Info("Router", "注册路由处理器: %s", prefix)
	}
}

// Route 路由分发
func (r *Router) Route(msg models.Message, conn *server.Connection) {
	path := msg.Path

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

// findHandler 查找匹配的处理器
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

// sendError 发送错误消息
func (r *Router) sendError(conn *server.Connection, err *errors.LBError) {
	errorMsg := models.Message{
		Path: "/error",
		Data: err.ToErrorData(),
	}

	if sendErr := conn.Send(errorMsg); sendErr != nil {
		logger.Error("Router", "发送错误消息失败: %v", sendErr)
	}
}
