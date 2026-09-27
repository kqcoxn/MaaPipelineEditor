package projectinterface

import (
	"context"
	"fmt"
	"time"
)

// Startup includes dependency installation and project initialization. Only after
// the transport is writable do we start the bounded MaaFramework handshake.
const AgentStartupTimeout = 3 * time.Minute
const AgentHandshakeTimeout = 10 * time.Second

type AgentConnection interface {
	Alive() bool
	Connected() bool
	Connect() error
	Disconnect() error
	SetTimeout(time.Duration) error
}

func (s *Supervisor) ConnectAgent(ctx context.Context, contextID, agentID string, client AgentConnection, requestTimeout time.Duration) error {
	s.mu.Lock()
	var process *supervisedProcess
	for _, candidate := range s.processes {
		if candidate.contexts[contextID] && candidate.agentID == agentID {
			process = candidate
			break
		}
	}
	s.mu.Unlock()
	if process == nil {
		return fmt.Errorf("Agent %s 已退出或已停止，请查看进程输出", agentID)
	}
	processError := func() error {
		s.mu.Lock()
		defer s.mu.Unlock()
		if process.stopped {
			return context.Canceled
		}
		if !process.running {
			return fmt.Errorf("Agent %s 已退出（退出码 %d），请查看进程输出", agentID, process.exitCode)
		}
		if !process.contexts[contextID] {
			return context.Canceled
		}
		return nil
	}
	s.publish(process, "waiting", nil, "等待 Agent 初始化（最多 3 分钟），可在此期间下载依赖")
	err := waitForAgentReady(ctx, client.Alive, processError, AgentStartupTimeout, 100*time.Millisecond)
	if err != nil {
		return err
	}
	s.mu.Lock()
	alreadyConnected := process.connected
	s.mu.Unlock()
	if alreadyConnected && client.Connected() {
		return nil
	}
	s.publish(process, "connecting", nil, "Agent 通信端已就绪，正在握手")
	if err := client.SetTimeout(AgentHandshakeTimeout); err != nil {
		return err
	}
	// Do not detach Connect into an abandoned goroutine: cleanup or a retry must
	// never use/destroy the native client while the old handshake is still active.
	err = client.Connect()
	restoreErr := client.SetTimeout(requestTimeout)
	processErr := processError()
	if ctx.Err() != nil || processErr != nil {
		if client.Connected() {
			_ = client.Disconnect()
		}
		if ctx.Err() != nil {
			return ctx.Err()
		}
		return processErr
	}
	if err != nil {
		return fmt.Errorf("Agent 握手失败: %w", err)
	}
	if restoreErr != nil {
		return restoreErr
	}
	s.MarkConnected(contextID, agentID)
	return nil
}

func waitForAgentReady(ctx context.Context, ready func() bool, processError func() error, timeout, interval time.Duration) error {
	deadline := time.NewTimer(timeout)
	defer deadline.Stop()
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		if err := ctx.Err(); err != nil {
			return err
		}
		if err := processError(); err != nil {
			return err
		}
		if ready() {
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-deadline.C:
			return fmt.Errorf("Agent 启动准备超时（%s），请检查依赖下载或启动日志后重试", timeout)
		case <-ticker.C:
		}
	}
}
