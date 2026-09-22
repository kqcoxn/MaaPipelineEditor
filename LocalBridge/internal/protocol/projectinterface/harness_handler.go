package projectinterface

import (
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	service "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/service/projectinterface"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

func (h *Handler) handleHarness(msg models.Message, conn *server.Connection) {
	var request struct {
		service.HarnessRequest
		RequestID string `json:"requestId"`
	}
	if !decode(msg.Data, &request) {
		h.sendError(conn, "pi_invalid_request", "请求格式错误")
		return
	}
	result, err := h.service.HarnessQuery(request.HarnessRequest, msg.Path == "/etl/interface/harness/resolve")
	if err != nil {
		h.send(conn, "/lte/interface/harness/result", map[string]any{"requestId": request.RequestID, "error": err.Error(), "code": "pi_harness_failed"})
		return
	}
	h.send(conn, "/lte/interface/harness/result", map[string]any{"requestId": request.RequestID, "result": result})
}
