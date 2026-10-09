package recorder

import (
	"context"
	"encoding/json"
	"time"

	recorder "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/recorder"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

type Handler struct{ service *recorder.Service }

func NewHandler(s *recorder.Service) *Handler { return &Handler{service: s} }
func (h *Handler) GetRoutePrefix() []string   { return []string{"/mpe/recorder/"} }
func (h *Handler) Handle(msg models.Message, conn *server.Connection) *models.Message {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()
		go func() {
			select {
			case <-conn.Done():
				cancel()
			case <-ctx.Done():
			}
		}()
		raw, err := json.Marshal(msg.Data)
		var id struct {
			RequestID string `json:"request_id"`
		}
		_ = json.Unmarshal(raw, &id)
		response := models.Message{Path: "/lte/recorder/result"}
		switch msg.Path {
		case "/mpe/recorder/click":
			var req recorder.ClickRequest
			if err == nil {
				err = json.Unmarshal(raw, &req)
			}
			if err != nil {
				response.Data = recorder.Result{RequestID: id.RequestID, Error: "点击请求格式无效"}
			} else {
				response.Data = h.service.Click(ctx, req)
			}
		case "/mpe/recorder/run":
			var req recorder.Request
			if err == nil {
				err = json.Unmarshal(raw, &req)
			}
			if err != nil {
				response.Data = recorder.Result{RequestID: id.RequestID, Error: "Recorder 请求格式无效"}
			} else {
				response.Data = h.service.Run(ctx, req)
			}
		case "/mpe/recorder/save_assets":
			var req recorder.SaveRequest
			if err == nil {
				err = json.Unmarshal(raw, &req)
			}
			if err != nil {
				response.Data = recorder.SaveResult{RequestID: id.RequestID, Error: "模板请求格式无效"}
			} else {
				response.Data = h.service.Save(ctx, req)
			}
		default:
			response.Data = recorder.Result{RequestID: id.RequestID, Error: "未知的 Recorder 请求"}
		}
		_ = conn.Send(response)
	}()
	return nil
}
