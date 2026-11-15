package mfw

import (
	"encoding/json"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

func (h *MFWHandler) handleRefreshIOSDevices(conn *server.Connection, msg models.Message) {
	var options mfw.IOSControllerOptions
	raw, err := json.Marshal(msg.Data)
	if err == nil {
		err = json.Unmarshal(raw, &options)
	}
	if err != nil {
		conn.Send(models.Message{Path: "/lte/mfw/ios_devices", Data: map[string]any{"success": false, "error": err.Error()}})
		return
	}
	devices, warnings, err := h.service.DeviceManager().RefreshIOSDevices(options)
	data := map[string]any{"success": err == nil, "devices": devices, "warnings": warnings}
	if err != nil {
		data["error"] = err.Error()
	}
	conn.Send(models.Message{Path: "/lte/mfw/ios_devices", Data: data})
}

func (h *MFWHandler) handleCreateIOSController(conn *server.Connection, msg models.Message) {
	release, err := h.service.AcquireControllerSetup()
	if err != nil {
		h.sendMFWError(conn, "controller_busy", err.Error(), "")
		return
	}
	defer release()
	var options mfw.IOSControllerOptions
	raw, err := json.Marshal(msg.Data)
	if err == nil {
		err = json.Unmarshal(raw, &options)
	}
	if err != nil {
		h.sendMFWError(conn, mfw.ErrCodeInvalidParameter, "iOS 连接参数无效", err.Error())
		return
	}
	id, err := h.service.ControllerManager().CreateIOSController(options)
	if err != nil {
		h.sendMFWError(conn, mfw.ErrCodeControllerCreateFail, "iOS 控制器创建失败", err.Error())
		return
	}
	if err = h.service.ControllerManager().ConnectController(id); err != nil {
		h.sendMFWError(conn, mfw.ErrCodeControllerConnectFail, "iOS 连接失败，请检查 xdb Server、配对和 DDI 准备状态", err.Error())
		return
	}
	conn.Send(models.Message{Path: "/lte/mfw/controller_created", Data: map[string]any{"success": true, "controller_id": id, "type": "ios"}})
}
