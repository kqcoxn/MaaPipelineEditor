package ai

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

const (
	maxRequestBodySize  int64 = 16 * 1024 * 1024
	maxResponseBodySize int64 = 16 * 1024 * 1024
	maxErrorBodySize    int64 = 64 * 1024
	maxStreamLineSize         = 1024 * 1024
	minRequestTimeout         = time.Minute
	maxRequestTimeout         = 120 * time.Minute
)

type activeRequest struct {
	cancel context.CancelFunc
}

type proxyRequest struct {
	id      string
	url     string
	method  string
	body    string
	headers map[string]string
	timeout time.Duration
}

// AIHandler 只负责 AI HTTP 代理的传输，不包含 Provider 或业务逻辑。
type AIHandler struct {
	httpClient      *http.Client
	activeRequests  map[string]*activeRequest
	activeRequestMu sync.Mutex
}

// NewAIHandler 创建 AI 代理协议处理器。
func NewAIHandler() *AIHandler {
	httpClient := &http.Client{}
	httpClient.CheckRedirect = func(request *http.Request, _ []*http.Request) error {
		if err := validateProxyURL(request.URL.String()); err != nil {
			return fmt.Errorf("重定向目标不允许: %w", err)
		}
		return nil
	}

	return &AIHandler{
		httpClient:     httpClient,
		activeRequests: make(map[string]*activeRequest),
	}
}

// GetRoutePrefix 返回处理的路由前缀。
func (h *AIHandler) GetRoutePrefix() []string {
	return []string{"/etl/ai/"}
}

// Handle 处理 AI 代理消息。
func (h *AIHandler) Handle(msg models.Message, conn *server.Connection) *models.Message {
	logger.Debug("AI", "处理 AI 代理消息: %s", msg.Path)

	switch msg.Path {
	case "/etl/ai/proxy":
		go h.handleProxy(conn, msg)
	case "/etl/ai/proxy_stream":
		go h.handleStreamProxy(conn, msg)
	case "/etl/ai/proxy_cancel":
		h.handleCancel(msg)
	default:
		logger.Warn("AI", "未知的 AI 路由: %s", msg.Path)
	}

	return nil
}

func parseProxyRequest(msg models.Message) (proxyRequest, error) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		return proxyRequest{}, fmt.Errorf("请求数据格式错误")
	}

	requestID, _ := dataMap["request_id"].(string)
	requestURL, _ := dataMap["url"].(string)
	method, _ := dataMap["method"].(string)
	body, _ := dataMap["body"].(string)
	timeoutMS, _ := dataMap["timeout_ms"].(float64)
	request := proxyRequest{id: requestID, url: requestURL, method: method, body: body}
	if requestID == "" {
		return request, fmt.Errorf("request_id 不能为空")
	}
	if method == "" {
		return request, fmt.Errorf("Method 不能为空")
	}
	if err := validateProxyURL(requestURL); err != nil {
		return request, err
	}
	if int64(len(body)) > maxRequestBodySize {
		return request, fmt.Errorf("请求体超过限制（最大 %d bytes）", maxRequestBodySize)
	}
	timeout := time.Duration(timeoutMS) * time.Millisecond
	if timeout < minRequestTimeout || timeout > maxRequestTimeout {
		return request, fmt.Errorf(
			"timeout_ms 必须在 %d 到 %d 之间",
			minRequestTimeout.Milliseconds(),
			maxRequestTimeout.Milliseconds(),
		)
	}

	headers := make(map[string]string)
	if rawHeaders, ok := dataMap["headers"].(map[string]interface{}); ok {
		for key, value := range rawHeaders {
			if stringValue, ok := value.(string); ok {
				headers[key] = stringValue
			}
		}
	}

	request.headers = headers
	request.timeout = timeout
	return request, nil
}

func validateProxyURL(rawURL string) error {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return fmt.Errorf("URL 无效: %w", err)
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return fmt.Errorf("仅支持 http/https URL")
	}
	if parsed.Host == "" || parsed.Hostname() == "" {
		return fmt.Errorf("URL 必须包含有效主机")
	}
	if parsed.User != nil {
		return fmt.Errorf("URL 不允许包含用户信息")
	}

	hostname := strings.ToLower(strings.TrimSuffix(parsed.Hostname(), "."))
	if isMetadataHost(hostname) {
		return fmt.Errorf("禁止访问云实例元数据地址")
	}

	return nil
}

func isMetadataHost(hostname string) bool {
	if hostname == "metadata.google.internal" ||
		hostname == "metadata" ||
		hostname == "instance-data.ec2.internal" ||
		hostname == "metadata.azure.internal" {
		return true
	}

	ip := net.ParseIP(hostname)
	if ip == nil {
		return false
	}
	if ip.IsUnspecified() || ip.IsLinkLocalUnicast() {
		return true
	}

	// AWS/GCP/Azure/Alibaba 常用的元数据地址。
	return ip.Equal(net.ParseIP("169.254.169.254")) ||
		ip.Equal(net.ParseIP("100.100.100.200")) ||
		ip.Equal(net.ParseIP("fd00:ec2::254"))
}

func (h *AIHandler) beginRequest(
	requestID string,
	timeout time.Duration,
	conn *server.Connection,
) (context.Context, *activeRequest, error) {
	h.activeRequestMu.Lock()
	defer h.activeRequestMu.Unlock()

	if _, exists := h.activeRequests[requestID]; exists {
		return nil, nil, fmt.Errorf("request_id 已在使用中")
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	if conn != nil {
		go func() {
			select {
			case <-conn.Done():
				cancel()
			case <-ctx.Done():
			}
		}()
	}
	request := &activeRequest{cancel: cancel}
	h.activeRequests[requestID] = request
	return ctx, request, nil
}

func (h *AIHandler) finishRequest(requestID string, request *activeRequest) {
	h.activeRequestMu.Lock()
	defer h.activeRequestMu.Unlock()

	if current, exists := h.activeRequests[requestID]; exists && current == request {
		delete(h.activeRequests, requestID)
	}
}

func (h *AIHandler) handleProxy(conn *server.Connection, msg models.Message) {
	request, err := parseProxyRequest(msg)
	if err != nil {
		h.sendError(conn, request.id, err.Error())
		return
	}

	ctx, active, err := h.beginRequest(request.id, request.timeout, conn)
	if err != nil {
		h.sendError(conn, request.id, err.Error())
		return
	}
	defer func() {
		active.cancel()
		h.finishRequest(request.id, active)
	}()

	logger.Debug("AI", "代理请求: %s %s (ID: %s)", request.method, request.url, request.id)
	resp, err := h.doRequest(ctx, request)
	if err != nil {
		if ctx.Err() == context.Canceled {
			return
		}
		if ctx.Err() == context.DeadlineExceeded {
			h.sendError(conn, request.id, "请求超时")
			return
		}
		h.sendError(conn, request.id, "请求失败: "+err.Error())
		return
	}
	defer resp.Body.Close()

	responseBodyLimit := maxResponseBodySize
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		responseBodyLimit = maxErrorBodySize
	}
	respBody, err := readLimitedBody(resp.Body, responseBodyLimit)
	if err != nil {
		h.sendError(conn, request.id, "读取响应失败: "+err.Error())
		return
	}

	respHeaders := make(map[string]string)
	for key, values := range resp.Header {
		if len(values) > 0 {
			respHeaders[key] = values[0]
		}
	}

	logger.Debug("AI", "代理响应: %d (ID: %s, 大小: %d bytes)", resp.StatusCode, request.id, len(respBody))
	if err := conn.Send(models.Message{
		Path: "/lte/ai/proxy_response",
		Data: map[string]interface{}{
			"request_id": request.id,
			"status":     resp.StatusCode,
			"headers":    respHeaders,
			"body":       string(respBody),
		},
	}); err != nil {
		logger.Warn("AI", "发送代理响应失败 (ID: %s): %v", request.id, err)
	}
}

func (h *AIHandler) handleStreamProxy(conn *server.Connection, msg models.Message) {
	request, err := parseProxyRequest(msg)
	if err != nil {
		h.sendStreamError(conn, request.id, err.Error())
		return
	}

	ctx, active, err := h.beginRequest(request.id, request.timeout, conn)
	if err != nil {
		h.sendStreamError(conn, request.id, err.Error())
		return
	}
	defer func() {
		active.cancel()
		h.finishRequest(request.id, active)
	}()

	logger.Debug("AI", "流式代理请求: %s %s (ID: %s)", request.method, request.url, request.id)
	resp, err := h.doRequest(ctx, request)
	if err != nil {
		if ctx.Err() == context.Canceled {
			return
		}
		if ctx.Err() == context.DeadlineExceeded {
			h.sendStreamError(conn, request.id, "请求超时")
			return
		}
		h.sendStreamError(conn, request.id, "请求失败: "+err.Error())
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		errBody, readErr := readLimitedBody(resp.Body, maxErrorBodySize)
		if readErr != nil {
			h.sendStreamError(conn, request.id, fmt.Sprintf("HTTP %s: %v", resp.Status, readErr))
			return
		}
		h.sendStreamError(conn, request.id, fmt.Sprintf("HTTP %s: %s", resp.Status, string(errBody)))
		return
	}

	var sendErr error
	var streamSize int64
	err = scanStream(ctx, resp.Body, func(line string) error {
		streamSize += int64(len(line))
		if streamSize > maxResponseBodySize {
			return fmt.Errorf("流式响应超过限制（最大 %d bytes）", maxResponseBodySize)
		}
		sendErr = conn.Send(models.Message{
			Path: "/lte/ai/proxy_stream",
			Data: map[string]interface{}{
				"request_id": request.id,
				"chunk":      line,
				"done":       false,
			},
		})
		return sendErr
	})
	if err != nil {
		if ctx.Err() == context.Canceled {
			return
		}
		if ctx.Err() == context.DeadlineExceeded {
			h.sendStreamError(conn, request.id, "流式请求超时")
			return
		}
		if sendErr != nil {
			logger.Warn("AI", "发送流式代理数据失败 (ID: %s): %v", request.id, sendErr)
			return
		}
		logger.Warn("AI", "流式读取错误 (ID: %s): %v", request.id, err)
		h.sendStreamError(conn, request.id, "读取流式响应失败: "+err.Error())
		return
	}

	if err := conn.Send(models.Message{
		Path: "/lte/ai/proxy_stream",
		Data: map[string]interface{}{
			"request_id": request.id,
			"done":       true,
		},
	}); err != nil {
		logger.Warn("AI", "发送流式完成标记失败 (ID: %s): %v", request.id, err)
		return
	}

	logger.Debug("AI", "流式代理完成 (ID: %s)", request.id)
}

func (h *AIHandler) doRequest(ctx context.Context, request proxyRequest) (*http.Response, error) {
	req, err := http.NewRequestWithContext(
		ctx,
		request.method,
		request.url,
		bytes.NewBufferString(request.body),
	)
	if err != nil {
		return nil, fmt.Errorf("构建请求失败: %w", err)
	}

	for key, value := range request.headers {
		req.Header.Set(key, value)
	}

	return h.httpClient.Do(req)
}

func readLimitedBody(reader io.Reader, limit int64) ([]byte, error) {
	body, err := io.ReadAll(io.LimitReader(reader, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(body)) > limit {
		return nil, fmt.Errorf("响应体超过限制（最大 %d bytes）", limit)
	}
	return body, nil
}

func scanStream(ctx context.Context, reader io.Reader, emit func(string) error) error {
	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, 64*1024), maxStreamLineSize)
	for scanner.Scan() {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if err := emit(scanner.Text() + "\n"); err != nil {
			return err
		}
	}
	return scanner.Err()
}

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
	request, exists := h.activeRequests[requestID]
	h.activeRequestMu.Unlock()
	if exists {
		request.cancel()
		logger.Debug("AI", "取消请求 (ID: %s)", requestID)
	}
}

func (h *AIHandler) sendError(conn *server.Connection, requestID, errMsg string) {
	logger.Error("AI", "代理错误 (ID: %s): %s", requestID, errMsg)
	if err := conn.Send(models.Message{
		Path: "/lte/ai/proxy_response",
		Data: map[string]interface{}{
			"request_id": requestID,
			"error":      errMsg,
		},
	}); err != nil {
		logger.Warn("AI", "发送代理错误失败 (ID: %s): %v", requestID, err)
	}
}

func (h *AIHandler) sendStreamError(conn *server.Connection, requestID, errMsg string) {
	logger.Error("AI", "流式代理错误 (ID: %s): %s", requestID, errMsg)
	if err := conn.Send(models.Message{
		Path: "/lte/ai/proxy_stream",
		Data: map[string]interface{}{
			"request_id": requestID,
			"error":      errMsg,
		},
	}); err != nil {
		logger.Warn("AI", "发送流式代理错误失败 (ID: %s): %v", requestID, err)
	}
}
