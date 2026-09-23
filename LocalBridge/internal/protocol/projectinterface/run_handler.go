package projectinterface

import (
	"context"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	run "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/service/interfacerun"
	pi "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/service/projectinterface"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
	"sync"
	"time"
)

type RunHandler struct{ service *run.Service }

func NewRunHandler(service *run.Service, bus *eventbus.EventBus, ws *server.WebSocketServer) *RunHandler {

	var mu sync.Mutex
	var timer *time.Timer
	var last time.Time
	publish := func() { ws.Broadcast(models.Message{Path: "/lte/interface-run/state", Data: service.Snapshot()}) }
	bus.Subscribe(run.EventState, func(e eventbus.Event) {
		state := e.Data.(run.State)
		mu.Lock()
		if !run.Active(state.Status) || time.Since(last) >= 100*time.Millisecond {
			if timer != nil {
				timer.Stop()
				timer = nil
			}
			last = time.Now()
			mu.Unlock()
			publish()
			return
		}
		if timer == nil {
			timer = time.AfterFunc(100*time.Millisecond, func() { mu.Lock(); timer = nil; last = time.Now(); mu.Unlock(); publish() })
		}
		mu.Unlock()
	})
	return &RunHandler{service: service}
}
func (h *RunHandler) GetRoutePrefix() []string { return []string{"/etl/interface-run/"} }
func (h *RunHandler) Handle(msg models.Message, conn *server.Connection) *models.Message {
	var req struct {
		RequestID string `json:"requestId"`
		RunID     string `json:"runId"`
	}
	decode(msg.Data, &req)
	sendError := func(err error) {
		_ = conn.Send(models.Message{Path: "/lte/interface-run/error", Data: map[string]any{"requestId": req.RequestID, "message": err.Error()}})
	}
	switch msg.Path {
	case "/etl/interface-run/status":
		_ = conn.Send(models.Message{Path: "/lte/interface-run/state", Data: h.service.Snapshot()})
	case "/etl/interface-run/start":
		var request run.Request
		if !decode(msg.Data, &request) {
			return nil
		}
		if err := h.service.Start(request); err != nil {
			sendError(err)
		} else {
			_ = conn.Send(models.Message{Path: "/lte/interface-run/state", Data: h.service.Snapshot()})
		}
	case "/etl/interface-run/stop":
		if err := h.service.Stop(req.RunID); err != nil {
			sendError(err)
		} else {
			// Acknowledge even when completion won the race with this request.
			_ = conn.Send(models.Message{Path: "/lte/interface-run/state", Data: h.service.Snapshot()})
		}
	case "/etl/interface-run/prepare":
		var request pi.ContextRequest
		if !decode(msg.Data, &request) {
			return nil
		}
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()
			go func() {
				select {
				case <-conn.Done():
					cancel()
				case <-ctx.Done():
				}
			}()
			preparation, err := h.service.Prepare(ctx, request)
			if err != nil {
				sendError(err)
				return
			}
			_ = conn.Send(models.Message{Path: "/lte/interface-run/prepared", Data: map[string]any{"requestId": request.RequestID, "preparation": preparation}})
		}()
	}
	return nil
}
