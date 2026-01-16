package resource

import (
	"encoding/base64"
	"encoding/json"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"os"
	"path/filepath"
	"strings"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/errors"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	resourceService "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/service/resource"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

// 资源协议处理器
type Handler struct {
	resourceService *resourceService.Service
	eventBus        *eventbus.EventBus
	wsServer        *server.WebSocketServer
	root            string
}

// 创建资源协议处理器
func NewHandler(resourceService *resourceService.Service, eventBus *eventbus.EventBus, wsServer *server.WebSocketServer, root string) *Handler {
	h := &Handler{
		resourceService: resourceService,
		eventBus:        eventBus,
		wsServer:        wsServer,
		root:            root,
	}

	// 订阅事件
	h.subscribeEvents()

	return h
}

// 返回处理的路由前缀
func (h *Handler) GetRoutePrefix() []string {
	return []string{
		"/etl/get_image",
		"/etl/get_images",
		"/etl/get_image_list",
		"/etl/refresh_resources",
	}
}

// 处理消息
func (h *Handler) Handle(msg models.Message, conn *server.Connection) *models.Message {
	switch msg.Path {
	case "/etl/get_image":
		return h.handleGetImage(msg, conn)
	case "/etl/get_images":
		return h.handleGetImages(msg, conn)
	case "/etl/get_image_list":
		return h.handleGetImageList(msg, conn)
	case "/etl/refresh_resources":
		return h.handleRefreshResources(msg, conn)
	default:
		return nil
	}
}

// 处理获取单张图片请求
func (h *Handler) handleGetImage(msg models.Message, conn *server.Connection) *models.Message {
	var req models.GetImageRequest
	if err := h.parseData(msg.Data, &req); err != nil {
		h.sendError(conn, err)
		return nil
	}

	resp := h.getImageData(req.RelativePath)
	return &models.Message{
		Path: "/lte/image",
		Data: resp,
	}
}

// 处理批量获取图片请求
func (h *Handler) handleGetImages(msg models.Message, conn *server.Connection) *models.Message {
	var req models.GetImagesRequest
	if err := h.parseData(msg.Data, &req); err != nil {
		h.sendError(conn, err)
		return nil
	}

	images := make([]models.GetImageResponse, 0, len(req.RelativePaths))
	for _, relPath := range req.RelativePaths {
		images = append(images, h.getImageData(relPath))
	}

	return &models.Message{
		Path: "/lte/images",
		Data: models.GetImagesResponse{
			Images: images,
		},
	}
}

// 处理刷新资源列表请求
func (h *Handler) handleRefreshResources(msg models.Message, conn *server.Connection) *models.Message {
	if err := h.resourceService.Scan(); err != nil {
		logger.Error("ResourceProtocol", "刷新资源失败: %v", err)
	}
	h.pushResourceBundles()
	return nil
}

// 处理获取图片列表请求
func (h *Handler) handleGetImageList(msg models.Message, conn *server.Connection) *models.Message {
	var req models.GetImageListRequest
	if err := h.parseData(msg.Data, &req); err != nil {
		h.sendError(conn, err)
		return nil
	}

	images, bundleName, isFiltered := h.resourceService.GetImageList(req.PipelinePath)

	logger.Debug("ResourceProtocol", "获取图片列表：pipelinePath=%s, 匹配资源包=%s, 图片数=%d",
		req.PipelinePath, bundleName, len(images))

	return &models.Message{
		Path: "/lte/image_list",
		Data: models.GetImageListResponse{
			Images:     images,
			BundleName: bundleName,
			IsFiltered: isFiltered,
		},
	}
}

// 获取图片数据
func (h *Handler) getImageData(relativePath string) models.GetImageResponse {
	// 查找图片
	absPath, bundleName, found := h.resourceService.FindImage(relativePath)
	if !found {
		return models.GetImageResponse{
			Success:      false,
			RelativePath: relativePath,
			Message:      "图片未找到",
		}
	}

	// 读取图片文件
	data, err := os.ReadFile(absPath)
	if err != nil {
		return models.GetImageResponse{
			Success:      false,
			RelativePath: relativePath,
			AbsolutePath: absPath,
			BundleName:   bundleName,
			Message:      "读取图片失败: " + err.Error(),
		}
	}

	// 获取 MIME 类型
	mimeType := h.getMimeType(absPath)

	// 获取图片尺寸
	width, height := h.getImageSize(absPath)

	// Base64 编码
	base64Data := base64.StdEncoding.EncodeToString(data)

	return models.GetImageResponse{
		Success:      true,
		RelativePath: relativePath,
		AbsolutePath: absPath,
		BundleName:   bundleName,
		Base64:       base64Data,
		MimeType:     mimeType,
		Width:        width,
		Height:       height,
	}
}

// 获取 MIME 类型
func (h *Handler) getMimeType(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	case ".bmp":
		return "image/bmp"
	default:
		return "application/octet-stream"
	}
}

// 获取图片尺寸
func (h *Handler) getImageSize(path string) (int, int) {
	file, err := os.Open(path)
	if err != nil {
		return 0, 0
	}
	defer file.Close()

	config, _, err := image.DecodeConfig(file)
	if err != nil {
		return 0, 0
	}

	return config.Width, config.Height
}

// 订阅事件
func (h *Handler) subscribeEvents() {
	// 订阅连接建立事件
	h.eventBus.Subscribe(eventbus.EventConnectionEstablished, func(event eventbus.Event) {
		// 推送资源包列表
		h.pushResourceBundles()
	})

	// 订阅资源扫描完成事件
	h.eventBus.Subscribe(eventbus.EventResourceScanCompleted, func(event eventbus.Event) {
		// 推送资源包列表
		h.pushResourceBundles()
	})
}

// 推送资源包列表
func (h *Handler) pushResourceBundles() {
	bundleList := h.resourceService.GetBundleList()

	h.wsServer.Broadcast(models.Message{
		Path: "/lte/resource_bundles",
		Data: bundleList,
	})

	logger.Debug("ResourceProtocol", "推送资源包列表，共 %d 个资源包，%d 个 image 目录",
		len(bundleList.Bundles), len(bundleList.ImageDirs))
}

// 解析消息数据
func (h *Handler) parseData(data interface{}, target interface{}) *errors.LBError {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return errors.NewInvalidJSONError(err)
	}

	if err := json.Unmarshal(jsonData, target); err != nil {
		return errors.NewInvalidJSONError(err)
	}

	return nil
}

// 发送错误消息
func (h *Handler) sendError(conn *server.Connection, err *errors.LBError) {
	logger.Error("ResourceProtocol", err.Error())

	errorMsg := models.Message{
		Path: "/error",
		Data: err.ToErrorData(),
	}

	conn.Send(errorMsg)
}
