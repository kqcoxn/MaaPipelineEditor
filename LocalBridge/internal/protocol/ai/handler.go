package ai

import (
	"bufio"
	"bytes"
	"io"
	"net/http"
	"strings"
	"sync"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

// AI代理协议处理器
type AIHandler struct {
	httpClient      *http.Client
	activeRequests  map[string]*http.Response
	activeRequestMu sync.Mutex
}

// 创建AI代理协议处理器
func NewAIHandler() *AIHandler {
	return &AIHandler{
		httpClient:     &http.Client{},
		activeRequests: make(map[string]*http.Response),
	}
}

// 返回处理的路由前缀
func (h *AIHandler) GetRoutePrefix() []string {
	return []string{"/etl/ai/"}
}

// 处理消息
func (h *AIHandler) Handle(msg models.Message, conn *server.Connection) *models.Message {
	path := msg.Path
	logger.Debug("AI", "处理AI代理消息: %s", path)

	switch path {
	case "/etl/ai/proxy":
		go h.handleProxy(conn, msg)
	case "/etl/ai/proxy_stream":
		go h.handleStreamProxy(conn, msg)
	case "/etl/ai/proxy_cancel":
		h.handleCancel(msg)
	default:
		logger.Warn("AI", "未知的AI路由: %s", path)
	}

	return nil
}

// 处理非流式代理请求
func (h *AIHandler) handleProxy(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendError(conn, "", "请求数据格式错误")
		return
	}

	requestID, _ := dataMap["request_id"].(string)
	url, _ := dataMap["url"].(string)
	method, _ := dataMap["method"].(string)
	body, _ := dataMap["body"].(string)
	headers, _ := dataMap["headers"].(map[string]interface{})

	if url == "" || method == "" {
		h.sendError(conn, requestID, "URL 或 Method 不能为空")
		return
	}

	logger.Debug("AI", "代理请求: %s %s (ID: %s)", method, url, requestID)

	// 构建 HTTP 请求
	req, err := http.NewRequest(method, url, bytes.NewBufferString(body))
	if err != nil {
		h.sendError(conn, requestID, "构建请求失败: "+err.Error())
		return
	}

	// 设置请求头
	for k, v := range headers {
		if strVal, ok := v.(string); ok {
			req.Header.Set(k, strVal)
		}
	}

	// 执行请求
	resp, err := h.httpClient.Do(req)
	if err != nil {
		h.sendError(conn, requestID, "请求失败: "+err.Error())
		return
	}
	defer resp.Body.Close()

	// 读取响应体
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		h.sendError(conn, requestID, "读取响应失败: "+err.Error())
		return
	}

	// 转换响应头
	respHeaders := make(map[string]string)
	for k, v := range resp.Header {
		if len(v) > 0 {
			respHeaders[k] = v[0]
		}
	}

	logger.Debug("AI", "代理响应: %d (ID: %s, 大小: %d bytes)", resp.StatusCode, requestID, len(respBody))

	conn.Send(models.Message{
		Path: "/lte/ai/proxy_response",
		Data: map[string]interface{}{
			"request_id": requestID,
			"status":     resp.StatusCode,
			"headers":    respHeaders,
			"body":       string(respBody),
		},
	})
}

// 处理流式代理请求
func (h *AIHandler) handleStreamProxy(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendStreamError(conn, "", "请求数据格式错误")
		return
	}

	requestID, _ := dataMap["request_id"].(string)
	url, _ := dataMap["url"].(string)
	method, _ := dataMap["method"].(string)
	body, _ := dataMap["body"].(string)
	headers, _ := dataMap["headers"].(map[string]interface{})

	if url == "" || method == "" {
		h.sendStreamError(conn, requestID, "URL 或 Method 不能为空")
		return
	}

	logger.Debug("AI", "流式代理请求: %s %s (ID: %s)", method, url, requestID)

	// 构建 HTTP 请求
	req, err := http.NewRequest(method, url, bytes.NewBufferString(body))
	if err != nil {
		h.sendStreamError(conn, requestID, "构建请求失败: "+err.Error())
		return
	}

	for k, v := range headers {
		if strVal, ok := v.(string); ok {
			req.Header.Set(k, strVal)
		}
	}

	// 执行请求
	resp, err := h.httpClient.Do(req)
	if err != nil {
		h.sendStreamError(conn, requestID, "请求失败: "+err.Error())
		return
	}

	// 注册活跃请求（用于取消）
	h.activeRequestMu.Lock()
	h.activeRequests[requestID] = resp
	h.activeRequestMu.Unlock()

	defer func() {
		resp.Body.Close()
		h.activeRequestMu.Lock()
		delete(h.activeRequests, requestID)
		h.activeRequestMu.Unlock()
	}()

	// 如果响应不是 2xx，直接返回错误
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		errBody, _ := io.ReadAll(resp.Body)
		h.sendStreamError(conn, requestID, "HTTP "+resp.Status+": "+string(errBody))
		return
	}

	// 逐行读取 SSE 流
	scanner := bufio.NewScanner(resp.Body)
	// 增大缓冲区以支持长行
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	for scanner.Scan() {
		line := scanner.Text()

		// 检查是否已被取消
		h.activeRequestMu.Lock()
		_, exists := h.activeRequests[requestID]
		h.activeRequestMu.Unlock()
		if !exists {
			logger.Debug("AI", "流式请求已取消 (ID: %s)", requestID)
			return
		}

		// 发送每一行（包括空行，用于保持 SSE 格式）
		conn.Send(models.Message{
			Path: "/lte/ai/proxy_stream",
			Data: map[string]interface{}{
				"request_id": requestID,
				"chunk":      line + "\n",
				"done":       false,
			},
		})
	}

	if err := scanner.Err(); err != nil {
		// 检查是否是客户端主动取消
		if strings.Contains(err.Error(), "closed") {
			return
		}
		logger.Warn("AI", "流式读取错误 (ID: %s): %v", requestID, err)
	}

	// 发送完成标记
	conn.Send(models.Message{
		Path: "/lte/ai/proxy_stream",
		Data: map[string]interface{}{
			"request_id": requestID,
			"done":       true,
		},
	})

	logger.Debug("AI", "流式代理完成 (ID: %s)", requestID)
}

// 处理取消请求
func (h *AIHandler) handleCancel(msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		return
	}

	requestID, _ := dataMap["request_id"].(string)
	if requestID == "" {
		return
	}

	h.activeRequestMu.Lock()
	if resp, exists := h.activeRequests[requestID]; exists {
		resp.Body.Close()
		delete(h.activeRequests, requestID)
		logger.Debug("AI", "取消请求 (ID: %s)", requestID)
	}
	h.activeRequestMu.Unlock()
}

// 发送错误响应
func (h *AIHandler) sendError(conn *server.Connection, requestID, errMsg string) {
	logger.Error("AI", "代理错误 (ID: %s): %s", requestID, errMsg)
	conn.Send(models.Message{
		Path: "/lte/ai/proxy_response",
		Data: map[string]interface{}{
			"request_id": requestID,
			"error":      errMsg,
		},
	})
}

// 发送流式错误响应
func (h *AIHandler) sendStreamError(conn *server.Connection, requestID, errMsg string) {
	logger.Error("AI", "流式代理错误 (ID: %s): %s", requestID, errMsg)
	conn.Send(models.Message{
		Path: "/lte/ai/proxy_stream",
		Data: map[string]interface{}{
			"request_id": requestID,
			"error":      errMsg,
			"done":       true,
		},
	})
}
