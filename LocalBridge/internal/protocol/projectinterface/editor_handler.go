package projectinterface

import (
	"errors"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	service "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/service/projectinterface"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
	"strings"
)

func (h *Handler) handleEditor(msg models.Message, conn *server.Connection) {
	var req struct {
		service.EditorRequest
		RequestID string `json:"requestId"`
	}
	if !decode(msg.Data, &req) || req.RequestID == "" {
		h.sendError(conn, "pi_invalid_request", "缺少请求标识")
		return
	}
	var project *service.EditorProject
	var err error
	if strings.HasSuffix(msg.Path, "/save") {
		project, err = h.service.SaveEditor(req.EditorRequest)
	} else {
		project, err = h.service.ReadEditor(req.EditorRequest)
	}
	response := map[string]any{"requestId": req.RequestID, "project": project}
	if err != nil {
		response["error"] = err.Error()
		response["code"] = "pi_editor_failed"
		var conflict *service.EditorConflictError
		if errors.As(err, &conflict) {
			response["code"] = "pi_editor_conflict"
			response["path"] = conflict.Path
		}
	}
	h.send(conn, "/lte/interface/editor/result", response)
}
