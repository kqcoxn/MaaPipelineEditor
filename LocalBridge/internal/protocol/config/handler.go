package config

import (
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/config"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/errors"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

// Config协议处理器
type ConfigHandler struct{}

// 创建Config协议处理器
func NewConfigHandler() *ConfigHandler {
	return &ConfigHandler{}
}

// 返回处理的路由前缀
func (h *ConfigHandler) GetRoutePrefix() []string {
	return []string{"/etl/config/"}
}

// 处理消息
func (h *ConfigHandler) Handle(msg models.Message, conn *server.Connection) *models.Message {
	path := msg.Path
	logger.Info("Config", "处理Config消息: %s", path)

	// 根据路由分发到不同的处理器
	switch path {
	case "/etl/config/get":
		h.handleGetConfig(conn, msg)

	case "/etl/config/set":
		h.handleSetConfig(conn, msg)

	default:
		logger.Warn("Config", "未知的Config路由: %s", path)
		h.sendError(conn, errors.NewInvalidRequestError("未知的Config路由: "+path))
	}

	return nil
}

// 获取配置
func (h *ConfigHandler) handleGetConfig(conn *server.Connection, msg models.Message) {
	cfg := config.GetGlobal()
	if cfg == nil {
		h.sendConfigError(conn, "CONFIG_NOT_LOADED", "配置未加载", nil)
		return
	}

	logger.Info("Config", "返回当前配置")

	// 返回配置
	conn.Send(models.Message{
		Path: "/lte/config/data",
		Data: map[string]interface{}{
			"success":     true,
			"config":      cfg,
			"config_path": config.GetConfigFilePath(),
		},
	})
}

// 设置配置
func (h *ConfigHandler) handleSetConfig(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendError(conn, errors.NewInvalidRequestError("请求数据格式错误"))
		return
	}

	cfg := config.GetGlobal()
	if cfg == nil {
		h.sendConfigError(conn, "CONFIG_NOT_LOADED", "配置未加载", nil)
		return
	}

	// 更新配置字段
	updated := false

	// 更新服务器配置
	if serverConfig, ok := dataMap["server"].(map[string]interface{}); ok {
		if port, ok := serverConfig["port"].(float64); ok {
			cfg.Server.Port = int(port)
			updated = true
		}
		if host, ok := serverConfig["host"].(string); ok {
			cfg.Server.Host = host
			updated = true
		}
	}

	// 更新文件配置
	if fileConfig, ok := dataMap["file"].(map[string]interface{}); ok {
		if root, ok := fileConfig["root"].(string); ok {
			cfg.File.Root = root
			updated = true
		}
		if exclude, ok := fileConfig["exclude"].([]interface{}); ok {
			cfg.File.Exclude = toStringSlice(exclude)
			updated = true
		}
		if extensions, ok := fileConfig["extensions"].([]interface{}); ok {
			cfg.File.Extensions = toStringSlice(extensions)
			updated = true
		}
	}

	// 更新日志配置
	if logConfig, ok := dataMap["log"].(map[string]interface{}); ok {
		if level, ok := logConfig["level"].(string); ok {
			cfg.Log.Level = level
			updated = true
		}
		if dir, ok := logConfig["dir"].(string); ok {
			cfg.Log.Dir = dir
			updated = true
		}
		if pushToClient, ok := logConfig["push_to_client"].(bool); ok {
			cfg.Log.PushToClient = pushToClient
			updated = true
		}
	}

	// 更新 MaaFramework 配置
	if maafwConfig, ok := dataMap["maafw"].(map[string]interface{}); ok {
		if enabled, ok := maafwConfig["enabled"].(bool); ok {
			cfg.MaaFW.Enabled = enabled
			updated = true
		}
		if libDir, ok := maafwConfig["lib_dir"].(string); ok {
			cfg.MaaFW.LibDir = libDir
			updated = true
		}
		if resourceDir, ok := maafwConfig["resource_dir"].(string); ok {
			cfg.MaaFW.ResourceDir = resourceDir
			updated = true
		}
	}

	if !updated {
		h.sendConfigError(conn, "NO_CHANGES", "没有有效的配置更新", nil)
		return
	}

	// 保存配置
	if err := cfg.Save(); err != nil {
		logger.Error("Config", "保存配置失败: %v", err)
		h.sendConfigError(conn, "SAVE_FAILED", "保存配置失败", err.Error())
		return
	}

	logger.Info("Config", "配置已更新并保存")

	// 返回更新后的配置
	conn.Send(models.Message{
		Path: "/lte/config/data",
		Data: map[string]interface{}{
			"success":     true,
			"config":      cfg,
			"config_path": config.GetConfigFilePath(),
			"message":     "配置已保存，部分配置可能需要重启服务才能生效",
		},
	})
}

// 辅助方法: 将 interface{} 切片转换为 string 切片
func toStringSlice(slice []interface{}) []string {
	result := make([]string, 0, len(slice))
	for _, v := range slice {
		if s, ok := v.(string); ok {
			result = append(result, s)
		}
	}
	return result
}

// 发送错误
func (h *ConfigHandler) sendError(conn *server.Connection, err *errors.LBError) {
	errorMsg := models.Message{
		Path: "/error",
		Data: err.ToErrorData(),
	}
	conn.Send(errorMsg)
}

func (h *ConfigHandler) sendConfigError(conn *server.Connection, code, message string, detail interface{}) {
	errorMsg := models.Message{
		Path: "/error",
		Data: map[string]interface{}{
			"code":    code,
			"message": message,
			"detail":  detail,
		},
	}
	conn.Send(errorMsg)
}
