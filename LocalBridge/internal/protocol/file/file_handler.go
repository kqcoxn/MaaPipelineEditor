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

// 文件协议处理器
type Handler struct {
	fileService *fileService.Service
	eventBus    *eventbus.EventBus
	wsServer    *server.WebSocketServer
	root        string
}

// 创建文件协议处理器
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

// 返回处理的路由前缀
func (h *Handler) GetRoutePrefix() []string {
	return []string{
		"/etl/open_file",
		"/etl/save_file",
		"/etl/save_separated",
		"/etl/create_file",
		"/etl/refresh_file_list",
	}
}

// 处理消息
func (h *Handler) Handle(msg models.Message, conn *server.Connection) *models.Message {
	switch msg.Path {
	case "/etl/open_file":
		return h.handleOpenFile(msg, conn)
	case "/etl/save_file":
		return h.handleSaveFile(msg, conn)
	case "/etl/save_separated":
		return h.handleSaveSeparated(msg, conn)
	case "/etl/create_file":
		return h.handleCreateFile(msg, conn)
	case "/etl/refresh_file_list":
		return h.handleRefreshFileList(msg, conn)
	default:
		return nil
	}
}

// 处理打开文件请求
func (h *Handler) handleOpenFile(msg models.Message, conn *server.Connection) *models.Message {
	// 解析请求
	var req models.OpenFileRequest
	if err := h.parseData(msg.Data, &req); err != nil {
		h.sendError(conn, err)
		return nil
	}

	// 读取 Pipeline 文件
	content, err := h.fileService.ReadFile(req.FilePath)
	if err != nil {
		if lbErr, ok := err.(*errors.LBError); ok {
			h.sendError(conn, lbErr)
		} else {
			h.sendError(conn, errors.Wrap(errors.ErrFileReadError, "读取文件失败", err))
		}
		return nil
	}

	// 生成配置文件路径
	var configPath string
	var mpeConfig interface{}

	// 从完整路径中提取目录和文件名
	lastSlashIndex := -1
	for i := len(req.FilePath) - 1; i >= 0; i-- {
		if req.FilePath[i] == '/' || req.FilePath[i] == '\\' {
			lastSlashIndex = i
			break
		}
	}

	if lastSlashIndex >= 0 {
		directory := req.FilePath[:lastSlashIndex+1]
		fileName := req.FilePath[lastSlashIndex+1:]

		// 移除扩展名
		baseName := fileName
		if len(fileName) > 5 && (fileName[len(fileName)-5:] == ".json" || fileName[len(fileName)-6:] == ".jsonc") {
			if fileName[len(fileName)-5:] == ".json" {
				baseName = fileName[:len(fileName)-5]
			} else {
				baseName = fileName[:len(fileName)-6]
			}
		}

		configPath = directory + "." + baseName + ".mpe.json"

		// 尝试读取配置文件
		configContent, err := h.fileService.ReadFile(configPath)
		if err == nil {
			// 配置文件存在
			mpeConfig = configContent
			logger.Info("FileService", "找到并加载配置文件: %s", configPath)
		} else {
			// 配置文件不存在，清空路径
			configPath = ""
		}
	}

	// 返回文件内容
	return &models.Message{
		Path: "/lte/file_content",
		Data: models.FileContentData{
			FilePath:   req.FilePath,
			Content:    content,
			MpeConfig:  mpeConfig,
			ConfigPath: configPath,
		},
	}
}

// 处理保存文件请求
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

// 处理分离保存文件请求
func (h *Handler) handleSaveSeparated(msg models.Message, conn *server.Connection) *models.Message {
	// 解析请求
	var req models.SaveSeparatedRequest
	if err := h.parseData(msg.Data, &req); err != nil {
		h.sendError(conn, err)
		return nil
	}

	// 保存 Pipeline 文件
	if err := h.fileService.SaveFile(req.PipelinePath, req.Pipeline); err != nil {
		if lbErr, ok := err.(*errors.LBError); ok {
			h.sendError(conn, lbErr)
		} else {
			h.sendError(conn, errors.Wrap(errors.ErrFileWriteError, "保存 Pipeline 文件失败", err))
		}
		return nil
	}

	// 保存配置文件
	if err := h.fileService.SaveFile(req.ConfigPath, req.Config); err != nil {
		if lbErr, ok := err.(*errors.LBError); ok {
			h.sendError(conn, lbErr)
		} else {
			h.sendError(conn, errors.Wrap(errors.ErrFileWriteError, "保存配置文件失败", err))
		}
		return nil
	}

	logger.Debug("FileService", "分离模式保存成功: %s + %s", req.PipelinePath, req.ConfigPath)

	// 返回确认
	return &models.Message{
		Path: "/ack/save_separated",
		Data: models.SaveSeparatedAckData{
			PipelinePath: req.PipelinePath,
			ConfigPath:   req.ConfigPath,
			Status:       "ok",
		},
	}
}

// 处理创建文件请求
func (h *Handler) handleCreateFile(msg models.Message, conn *server.Connection) *models.Message {
	// 解析请求
	var req models.CreateFileRequest
	if err := h.parseData(msg.Data, &req); err != nil {
		h.sendError(conn, err)
		return nil
	}

	// 创建文件
	filePath, err := h.fileService.CreateFile(req.Directory, req.FileName, req.Content)
	if err != nil {
		if lbErr, ok := err.(*errors.LBError); ok {
			h.sendError(conn, lbErr)
		} else {
			h.sendError(conn, errors.Wrap(errors.ErrFileWriteError, "创建文件失败", err))
		}
		return nil
	}

	// 重新推送文件列表
	h.pushFileList()

	// 返回确认
	return &models.Message{
		Path: "/ack/create_file",
		Data: models.CreateFileAckData{
			FilePath: filePath,
			Status:   "ok",
		},
	}
}

// 处理刷新文件列表请求
func (h *Handler) handleRefreshFileList(msg models.Message, conn *server.Connection) *models.Message {
	h.pushFileList()
	return nil
}

// 订阅事件
func (h *Handler) subscribeEvents() {
	// 订阅连接建立事件
	h.eventBus.Subscribe(eventbus.EventConnectionEstablished, func(event eventbus.Event) {
		// 推送文件列表
		h.pushFileList()
	})

	// 订阅文件变化事件
	h.eventBus.Subscribe(eventbus.EventFileChanged, func(event eventbus.Event) {
		if data, ok := event.Data.(map[string]interface{}); ok {
			changeType, _ := data["type"].(string)
			filePath, _ := data["file_path"].(string)

			// 推送变化通知
			h.wsServer.Broadcast(models.Message{
				Path: "/lte/file_changed",
				Data: models.FileChangedData{
					Type:     changeType,
					FilePath: filePath,
				},
			})

			logger.Debug("FileProtocol", "推送文件变化通知: %s - %s", changeType, filePath)
		}
	})
}

// 推送文件列表
func (h *Handler) pushFileList() {
	fileList := h.fileService.GetFileList()

	h.wsServer.Broadcast(models.Message{
		Path: "/lte/file_list",
		Data: models.FileListData{
			Root:  h.root,
			Files: fileList,
		},
	})

	logger.Debug("FileProtocol", "推送文件列表，共 %d 个文件", len(fileList))
}

// 解析消息数据
func (h *Handler) parseData(data interface{}, target interface{}) *errors.LBError {
	// 将 data 转为 JSON
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
	logger.Error("FileProtocol", err.Error())

	errorMsg := models.Message{
		Path: "/error",
		Data: err.ToErrorData(),
	}

	conn.Send(errorMsg)
}
