package api

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

func (h *Handler) handleAgentTest(conn *server.Connection, msg models.Message) {
	req, err := decodeData[protocol.AgentTestRequest](msg)
	if err != nil {
		h.sendError(conn, "debug_invalid_request", err.Error(), nil)
		return
	}
	ctx, finish, err := h.startups.begin("agent:"+req.ProjectContextID+":"+req.Agent.ID, connectionDone(conn))
	if err != nil {
		h.sendAgentTestFailure(conn, req.Agent.ID, err.Error(), "start")
		return
	}
	go func() {
		result := func() protocol.AgentTestResult {
			defer finish()
			return h.runAgentTest(ctx, req)
		}()
		h.send(conn, "/lte/debug/agent_tested", result)
	}()
}

func (h *Handler) runAgentTest(ctx context.Context, req protocol.AgentTestRequest) protocol.AgentTestResult {
	var piAgentID string
	if strings.TrimSpace(req.ProjectContextID) != "" {
		plan, contextErr := h.projectInterface.Context(req.ProjectContextID)
		if contextErr != nil {
			return agentTestFailure(req.Agent.ID, contextErr.Error(), "context")
		}
		if req.AgentIndex < 0 || req.AgentIndex >= len(plan.Agents) {
			return agentTestFailure(req.Agent.ID, "PI Agent 索引无效", "configuration")
		}
		agentPlan := plan.Agents[req.AgentIndex]
		if !agentPlan.Enabled {
			return agentTestFailure(agentPlan.ID, "PI Agent 已关闭", "configuration")
		}
		if req.AgentOverride != nil && strings.TrimSpace(req.AgentOverride.ChildExec) != "" {
			agentPlan.ChildExec = strings.TrimSpace(req.AgentOverride.ChildExec)
			agentPlan.ChildArgs = append([]string(nil), req.AgentOverride.ChildArgs...)
		}
		agent, prepareErr := h.preparePIAgent(ctx, plan, agentPlan)
		if prepareErr != nil {
			h.agentSupervisor.StopAgentIfRunning(req.ProjectContextID, agentPlan.ID)
			stage := "start"
			if errors.Is(prepareErr, context.Canceled) {
				stage = "canceled"
				prepareErr = fmt.Errorf("Agent 启动已取消")
			}
			return agentTestFailure(agentPlan.ID, prepareErr.Error(), stage)
		}
		req.Agent = agent
		req.ResourcePaths = plan.ResourcePaths
		piAgentID = plan.Agents[req.AgentIndex].ID
	}
	result := h.testAgentConnection(req.Agent, req.ResourcePaths)
	if piAgentID != "" && !result.Success {
		h.agentSupervisor.StopAgentIfRunning(req.ProjectContextID, piAgentID)
	}
	return result
}

func (h *Handler) sendAgentTestFailure(conn *server.Connection, agentID, message, failureStage string) {
	h.send(conn, "/lte/debug/agent_tested", agentTestFailure(agentID, message, failureStage))
}

func agentTestFailure(agentID, message, failureStage string) protocol.AgentTestResult {
	return protocol.AgentTestResult{AgentID: strings.TrimSpace(agentID), CheckedAt: time.Now().UTC().Format(time.RFC3339Nano), Message: message, FailureStage: failureStage}
}

func (h *Handler) handleAgentStop(conn *server.Connection, msg models.Message) {
	req, err := decodeData[protocol.AgentStopRequest](msg)
	if err != nil || strings.TrimSpace(req.ProjectContextID) == "" || req.AgentIndex < 0 {
		h.sendError(conn, "debug_invalid_request", "停止 PI Agent 请求格式错误", nil)
		return
	}
	plan, err := h.projectInterface.Context(req.ProjectContextID)
	if err != nil {
		h.sendError(conn, "debug_pi_context_failed", err.Error(), nil)
		return
	}
	if req.AgentIndex >= len(plan.Agents) {
		h.sendError(conn, "debug_invalid_request", "PI Agent 索引无效", nil)
		return
	}
	if h.startups.cancel("agent:"+req.ProjectContextID+":"+plan.Agents[req.AgentIndex].ID, nil) {
		// Startup owns cleanup; acknowledge only after its process has stopped.
		return
	}
	h.agentSupervisor.StopAgentIfRunning(req.ProjectContextID, plan.Agents[req.AgentIndex].ID)
}

func (h *Handler) testAgentConnection(agent protocol.AgentProfile, resourcePaths []string) protocol.AgentTestResult {
	result := protocol.AgentTestResult{
		AgentID:   strings.TrimSpace(agent.ID),
		CheckedAt: time.Now().UTC().Format(time.RFC3339Nano),
	}
	logger.Debug("DebugVNext", "开始测试 agent 连接: %s", agentProfileLogLabel(agent))
	paths := nonEmptyStrings(resourcePaths)
	if len(paths) == 0 {
		result.Message = "Agent 连接测试需要先配置资源路径"
		result.FailureStage = "resource"
		return result
	}
	if !h.service.IsInitialized() {
		result.Message = "MaaFramework 未初始化，无法加载资源"
		result.FailureStage = "resource"
		return result
	}

	agentPool := h.runner.AgentPool()
	var client *maa.AgentClient
	var err error
	if agentPool != nil {
		client, err = agentPool.EnsureBound(agent, paths)
	} else {
		client, err = createAgentClient(agent)
	}
	if err != nil {
		result.Message = err.Error()
		result.FailureStage = "resource"
		logger.Warn("DebugVNext", "创建 agent client 失败: %s, err=%v", agentProfileLogLabel(agent), err)
		return result
	}
	if agent.TimeoutMS > 0 {
		if err := client.SetTimeout(time.Duration(agent.TimeoutMS) * time.Millisecond); err != nil {
			result.Message = err.Error()
			result.FailureStage = "connect"
			logger.Warn("DebugVNext", "设置 agent timeout 失败: %s, err=%v", agentProfileLogLabel(agent), err)
			return result
		}
	}
	if !client.Connected() {
		connectTimeout := time.Duration(agent.TimeoutMS) * time.Millisecond
		if connectTimeout <= 0 || connectTimeout > 10*time.Second {
			connectTimeout = 10 * time.Second
		}
		connectErr := make(chan error, 1)
		go func() { connectErr <- client.Connect() }()
		select {
		case err := <-connectErr:
			if err != nil {
				result.Message = err.Error()
				result.FailureStage = "connect"
				logger.Warn("DebugVNext", "agent client connect 失败: %s, err=%v", agentProfileLogLabel(agent), err)
				return result
			}
		case <-time.After(connectTimeout):
			result.Message = fmt.Sprintf("Agent 连接超时（%s）", connectTimeout)
			result.FailureStage = "connect"
			logger.Warn("DebugVNext", "agent client connect 超时: %s", agentProfileLogLabel(agent))
			go func() {
				if err := <-connectErr; err == nil {
					_ = client.Disconnect()
				}
			}()
			return result
		}
	} else if !client.Alive() {
		result.Message = "agent 已连接但未响应"
		result.FailureStage = "connect"
		logger.Warn("DebugVNext", "agent 已连接但未响应: %s", agentProfileLogLabel(agent))
		return result
	}
	effectiveIdentifier, err := client.Identifier()
	if err != nil {
		logger.Warn("DebugVNext", "读取 agent identifier 失败: %s, err=%v", agentProfileLogLabel(agent), err)
	} else {
		logger.Debug("DebugVNext", "agent client 已连接: %s, effectiveIdentifier=%s", agentProfileLogLabel(agent), effectiveIdentifier)
	}
	if !client.Connected() || !client.Alive() {
		result.Message = "agent 已连接但状态检查失败"
		result.FailureStage = "connect"
		logger.Warn("DebugVNext", "agent 连接状态检查失败: %s, connected=%v, alive=%v", agentProfileLogLabel(agent), client.Connected(), client.Alive())
		return result
	}
	result.Success = true
	result.Message = "agent 连接测试通过"
	result.CustomRecognitions, _ = client.GetCustomRecognitionList()
	result.CustomActions, _ = client.GetCustomActionList()
	return result
}
