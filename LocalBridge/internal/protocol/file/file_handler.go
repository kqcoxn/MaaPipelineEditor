package file

import (
	"encoding/json"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/errors"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	fileService "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/service/file"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

// Handler 文件协议处理器
type Handler struct {
	fileService *fileService.Service
	eventBus    *eventbus.EventBus
	wsServer    *server.WebSocketServer
	root        string
}

// NewHandler 创建文件协议处理器
func NewHandler(fileService *fileService.Service, eventBus *eventbus.EventBus, wsServer *server.WebSocketServer, root string) *Handler {
	h := &Handler{
		fileService: fileService,
		eventBus:    eventBus,
		wsServer:    wsServer,
		root:        root,
	}

	// 订阅事件
	h.subscribeEvents()

	return h
}

// GetRoutePrefix 返回处理的路由前缀
func (h *Handler) GetRoutePrefix() []string {
	return []string{
		"/etl/open_file",
		"/etl/save_file",
		"/etl/create_file",
	}
}

// Handle 处理消息
func (h *Handler) Handle(msg models.Message, conn *server.Connection) *models.Message {
	switch msg.Path {
	case "/etl/open_file":
		return h.handleOpenFile(msg, conn)
	case "/etl/save_file":
		return h.handleSaveFile(msg, conn)
	case "/etl/create_file":
		return h.handleCreateFile(msg, conn)
	default:
		return nil
	}
}

// handleOpenFile 处理打开文件请求
func (h *Handler) handleOpenFile(msg models.Message, conn *server.Connection) *models.Message {
	// 解析请求
	var req models.OpenFileRequest
	if err := h.parseData(msg.Data, &req); err != nil {
		h.sendError(conn, err)
		return nil
	}

	// 读取文件
	content, err := h.fileService.ReadFile(req.FilePath)
	if err != nil {
		if lbErr, ok := err.(*errors.LBError); ok {
			h.sendError(conn, lbErr)
		} else {
			h.sendError(conn, errors.Wrap(errors.ErrFileReadError, "读取文件失败", err))
		}
		return nil
	}

	// 返回文件内容
	return &models.Message{
		Path: "/lte/file_content",
		Data: models.FileContentData{
			FilePath: req.FilePath,
			Content:  content,
		},
	}
}

// handleSaveFile 处理保存文件请求
func (h *Handler) handleSaveFile(msg models.Message, conn *server.Connection) *models.Message {
	// 解析请求
	var req models.SaveFileRequest
	if err := h.parseData(msg.Data, &req); err != nil {
		h.sendError(conn, err)
		return nil
	}

	// 保存文件
	if err := h.fileService.SaveFile(req.FilePath, req.Content); err != nil {
		if lbErr, ok := err.(*errors.LBError); ok {
			h.sendError(conn, lbErr)
		} else {
			h.sendError(conn, errors.Wrap(errors.ErrFileWriteError, "保存文件失败", err))
		}
		return nil
	}

	// 返回确认
	return &models.Message{
		Path: "/ack/save_file",
		Data: models.SaveFileAckData{
			FilePath: req.FilePath,
			Status:   "ok",
		},
	}
}

// handleCreateFile 处理创建文件请求
func (h *Handler) handleCreateFile(msg models.Message, conn *server.Connection) *models.Message {
	// 解析请求
	var req models.CreateFileRequest
	if err := h.parseData(msg.Data, &req); err != nil {
		h.sendError(conn, err)
		return nil
	}

	// 创建文件
	if err := h.fileService.CreateFile(req.Directory, req.FileName, req.Content); err != nil {
		if lbErr, ok := err.(*errors.LBError); ok {
			h.sendError(conn, lbErr)
		} else {
			h.sendError(conn, errors.Wrap(errors.ErrFileWriteError, "创建文件失败", err))
		}
		return nil
	}

	// 重新推送文件列表
	h.pushFileList()

	return nil
}

// subscribeEvents 订阅事件
func (h *Handler) subscribeEvents() {
	// 订阅连接建立事件，推送文件列表
	h.eventBus.Subscribe(eventbus.EventConnectionEstablished, func(event eventbus.Event) {
		h.pushFileList()
	})

	// 订阅文件变化事件，推送变化通知
	h.eventBus.Subscribe(eventbus.EventFileChanged, func(event eventbus.Event) {
		if data, ok := event.Data.(map[string]interface{}); ok {
			changeType, _ := data["type"].(string)
			filePath, _ := data["file_path"].(string)

			h.wsServer.Broadcast(models.Message{
				Path: "/lte/file_changed",
				Data: models.FileChangedData{
					Type:     changeType,
					FilePath: filePath,
				},
			})

			logger.Info("FileProtocol", "推送文件变化通知: %s - %s", changeType, filePath)
		}
	})
}

// pushFileList 推送文件列表
func (h *Handler) pushFileList() {
	fileList := h.fileService.GetFileList()

	h.wsServer.Broadcast(models.Message{
		Path: "/lte/file_list",
		Data: models.FileListData{
			Root:  h.root,
			Files: fileList,
		},
	})

	logger.Info("FileProtocol", "推送文件列表，共 %d 个文件", len(fileList))
}

// parseData 解析消息数据
func (h *Handler) parseData(data interface{}, target interface{}) *errors.LBError {
	// 将data转为JSON，再解析到target
	jsonData, err := json.Marshal(data)
	if err != nil {
		return errors.NewInvalidJSONError(err)
	}

	if err := json.Unmarshal(jsonData, target); err != nil {
		return errors.NewInvalidJSONError(err)
	}

	return nil
}

// sendError 发送错误消息
func (h *Handler) sendError(conn *server.Connection, err *errors.LBError) {
	logger.Error("FileProtocol", err.Error())

	errorMsg := models.Message{
		Path: "/error",
		Data: err.ToErrorData(),
	}

	conn.Send(errorMsg)
}
