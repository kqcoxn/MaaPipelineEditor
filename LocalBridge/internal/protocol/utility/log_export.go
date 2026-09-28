package utility

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/diagnostics"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

func (h *UtilityHandler) captureLogs(msg models.Message) (diagnostics.Snapshot, error) {
	var payload diagnostics.Payload
	data, err := json.Marshal(msg.Data)
	if err != nil {
		return diagnostics.Snapshot{}, err
	}
	if err = json.Unmarshal(data, &payload); err != nil {
		return diagnostics.Snapshot{}, err
	}
	return h.diagnostics.Capture(payload)
}

func (h *UtilityHandler) handleSnapshotLogs(msg models.Message) {
	if _, err := h.captureLogs(msg); err != nil {
		logger.Warn("Diagnostics", "保存前端诊断快照失败: %v", err)
	}
}

func (h *UtilityHandler) handleExportLogs(conn *server.Connection, msg models.Message) {
	snapshot, err := h.captureLogs(msg)
	var downloadPath string
	filename := fmt.Sprintf("mpe-logs-%s.zip", time.Now().Format("20060102-150405"))
	buildErr := err
	if err != nil {
		logger.Warn("Diagnostics", "保存诊断快照失败: %v", err)
		snapshot.Warnings = append(snapshot.Warnings, "无法保存供离线导出使用的快照: "+err.Error())
	}
	if err == nil || snapshot.CapturedAt != "" {
		downloadPath, buildErr = conn.PrepareDownload(filename, func(destination io.Writer) error {
			return diagnostics.Write(destination, snapshot)
		})
	}
	response := map[string]interface{}{"success": buildErr == nil}
	if buildErr != nil {
		response["message"] = "日志导出失败: " + buildErr.Error()
	} else {
		response["filename"] = filename
		response["download_path"] = downloadPath
		response["message"] = "日志导出成功"
	}
	route := "/lte/utility/logs_exported"
	if strings.HasSuffix(msg.Path, "/export_mfw_logs") {
		route = "/lte/utility/mfw_logs_exported"
	}
	conn.Send(models.Message{Path: route, Data: response})
}
