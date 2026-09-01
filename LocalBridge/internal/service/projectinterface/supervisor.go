package projectinterface

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
)

type AgentProcessStatus struct {
	ContextID  string   `json:"contextId"`
	AgentID    string   `json:"agentId"`
	State      string   `json:"state"`
	PID        int      `json:"pid,omitempty"`
	ExitCode   *int     `json:"exitCode,omitempty"`
	Message    string   `json:"message,omitempty"`
	Output     []string `json:"output,omitempty"`
	OccurredAt string   `json:"occurredAt"`
}

type supervisedProcess struct {
	key               string
	contextID         string
	agentID           string
	identifier        string
	cmd               *exec.Cmd
	output            []string
	lastOutputPublish time.Time
	captureDone       sync.WaitGroup
	done              chan struct{}
	contexts          map[string]bool
	running           bool
}

type Supervisor struct {
	mu          sync.Mutex
	eventBus    *eventbus.EventBus
	processes   map[string]*supervisedProcess
	identifiers map[string]string
	canceled    map[string]bool
}

func NewSupervisor(eventBus *eventbus.EventBus) *Supervisor {
	return &Supervisor{eventBus: eventBus, processes: map[string]*supervisedProcess{}, identifiers: map[string]string{}, canceled: map[string]bool{}}
}

func (s *Supervisor) Ensure(plan *RuntimePlan, agent AgentPlan, identifier string, env map[string]string) error {
	key := agentReuseKey(plan, agent)
	cancelKey := plan.ContextID + "\x00" + agent.ID
	s.mu.Lock()
	if s.canceled[cancelKey] {
		delete(s.canceled, cancelKey)
		s.mu.Unlock()
		return fmt.Errorf("PI Agent 启动已取消")
	}
	if current := s.processes[key]; current != nil && current.running {
		current.contexts[plan.ContextID] = true
		current.contextID = plan.ContextID
		s.mu.Unlock()
		return nil
	}
	if owner := s.identifiers[identifier]; owner != "" && owner != key {
		s.mu.Unlock()
		return fmt.Errorf("agent_context_conflict: identifier %s 已被其他 PI context 使用", identifier)
	}
	s.mu.Unlock()

	workingDir := plan.InterfaceRoot
	if strings.TrimSpace(workingDir) == "" {
		// 保持直接构造 RuntimePlan 的调用方兼容；正式 PI plan 始终携带 InterfaceRoot。
		workingDir = plan.ProjectRoot
	}
	executable := agent.ChildExec
	if strings.ContainsAny(executable, `/\\`) && !filepath.IsAbs(executable) {
		executable = filepath.Join(workingDir, executable)
	}
	args := append(append([]string(nil), agent.ChildArgs...), identifier)
	cmd := exec.Command(executable, args...)
	cmd.Dir = workingDir
	cmd.Env = mergeEnvironment(env)
	prepareProcess(cmd)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}
	process := &supervisedProcess{key: key, contextID: plan.ContextID, agentID: agent.ID, identifier: identifier, cmd: cmd, done: make(chan struct{}), contexts: map[string]bool{plan.ContextID: true}}
	s.publish(process, "starting", nil, "")
	if err := cmd.Start(); err != nil {
		s.publish(process, "failed", nil, err.Error())
		return fmt.Errorf("启动 PI Agent 失败: %w", err)
	}

	s.mu.Lock()
	if s.canceled[cancelKey] {
		delete(s.canceled, cancelKey)
		s.mu.Unlock()
		terminateProcess(cmd)
		_ = cmd.Wait()
		s.publish(process, "failed", nil, "PI Agent 启动已取消")
		return fmt.Errorf("PI Agent 启动已取消")
	}
	process.running = true
	s.processes[key] = process
	s.identifiers[identifier] = key
	s.mu.Unlock()
	s.publish(process, "started", nil, "")
	process.captureDone.Add(2)
	go s.capture(process, "stdout", stdout)
	go s.capture(process, "stderr", stderr)
	go s.wait(process)
	return nil
}

func (s *Supervisor) StopContext(contextID string) {
	s.mu.Lock()
	var targets []*supervisedProcess
	for _, process := range s.processes {
		if process.contexts[contextID] {
			delete(process.contexts, contextID)
		}
		if len(process.contexts) == 0 {
			targets = append(targets, process)
		}
	}
	s.mu.Unlock()
	for _, process := range targets {
		terminateProcess(process.cmd)
		select {
		case <-process.done:
		case <-time.After(2 * time.Second):
			if process.cmd.Process != nil {
				_ = process.cmd.Process.Kill()
			}
		}
	}
}

// StopAgent terminates one PI Agent without releasing the rest of the context.
// It is used by explicit cancellation and connection timeout handling.
func (s *Supervisor) StopAgent(contextID, agentID string) {
	s.stopAgent(contextID, agentID, true)
}

// StopAgentIfRunning cleans up an existing process without canceling a future
// retry. Failed starts use this path because no pending launch remains.
func (s *Supervisor) StopAgentIfRunning(contextID, agentID string) {
	s.stopAgent(contextID, agentID, false)
}

func (s *Supervisor) stopAgent(contextID, agentID string, cancelPending bool) {
	s.mu.Lock()
	var target *supervisedProcess
	for key, process := range s.processes {
		if process.contexts[contextID] && process.agentID == agentID {
			target = process
			delete(s.processes, key)
			if s.identifiers[process.identifier] == key {
				delete(s.identifiers, process.identifier)
			}
			break
		}
	}
	if target == nil && cancelPending {
		s.canceled[contextID+"\x00"+agentID] = true
	}
	s.mu.Unlock()
	if target == nil {
		return
	}
	terminateProcess(target.cmd)
	select {
	case <-target.done:
	case <-time.After(2 * time.Second):
		if target.cmd.Process != nil {
			_ = target.cmd.Process.Kill()
		}
	}
}

// AdoptContext transfers a running agent lease before the previous context is
// disposed. Contexts that differ only by Option values share the same process.
func (s *Supervisor) AdoptContext(plan *RuntimePlan) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, agent := range plan.Agents {
		if !agent.Enabled {
			continue
		}
		if process := s.processes[agentReuseKey(plan, agent)]; process != nil && process.running {
			process.contexts[plan.ContextID] = true
			process.contextID = plan.ContextID
		}
	}
}

func (s *Supervisor) MarkConnected(contextID, agentID string) {
	s.mu.Lock()
	var process *supervisedProcess
	for _, candidate := range s.processes {
		if candidate.contexts[contextID] && candidate.agentID == agentID {
			process = candidate
			break
		}
	}
	s.mu.Unlock()
	if process != nil {
		s.publish(process, "connected", nil, "")
	}
}

func (s *Supervisor) StopAll() {
	s.mu.Lock()
	targets := make([]*supervisedProcess, 0, len(s.processes))
	for _, process := range s.processes {
		targets = append(targets, process)
	}
	s.mu.Unlock()
	for _, process := range targets {
		terminateProcess(process.cmd)
	}
	for _, process := range targets {
		select {
		case <-process.done:
		case <-time.After(2 * time.Second):
			if process.cmd.Process != nil {
				_ = process.cmd.Process.Kill()
			}
		}
	}
}

func (s *Supervisor) wait(process *supervisedProcess) {
	err := process.cmd.Wait()
	process.captureDone.Wait()
	exitCode := -1
	if process.cmd.ProcessState != nil {
		exitCode = process.cmd.ProcessState.ExitCode()
	}
	message := ""
	if err != nil {
		message = err.Error()
	}
	s.mu.Lock()
	process.running = false
	delete(s.processes, process.key)
	if s.identifiers[process.identifier] == process.key {
		delete(s.identifiers, process.identifier)
	}
	close(process.done)
	s.mu.Unlock()
	s.publish(process, "exited", &exitCode, message)
}

func (s *Supervisor) capture(process *supervisedProcess, stream string, reader interface{ Read([]byte) (int, error) }) {
	defer process.captureDone.Done()
	scanner := bufio.NewScanner(reader)
	buffer := make([]byte, 0, 64*1024)
	scanner.Buffer(buffer, 1024*1024)
	for scanner.Scan() {
		line := fmt.Sprintf("[%s] %s", stream, scanner.Text())
		s.mu.Lock()
		process.output = append(process.output, line)
		if len(process.output) > 200 {
			process.output = append([]string(nil), process.output[len(process.output)-200:]...)
		}
		shouldPublish := time.Since(process.lastOutputPublish) >= 100*time.Millisecond
		if shouldPublish {
			process.lastOutputPublish = time.Now()
		}
		s.mu.Unlock()
		if shouldPublish {
			s.publish(process, "output", nil, line)
		}
	}
}

func (s *Supervisor) publish(process *supervisedProcess, state string, exitCode *int, message string) {
	status := AgentProcessStatus{ContextID: process.contextID, AgentID: process.agentID, State: state, ExitCode: exitCode, Message: message, OccurredAt: time.Now().UTC().Format(time.RFC3339Nano)}
	if process.cmd != nil && process.cmd.Process != nil {
		status.PID = process.cmd.Process.Pid
	}
	s.mu.Lock()
	status.Output = append([]string(nil), process.output...)
	s.mu.Unlock()
	s.eventBus.Publish(eventbus.EventProjectInterfaceAgent, status)
}

func mergeEnvironment(values map[string]string) []string {
	result := os.Environ()
	for key, value := range values {
		result = append(result, key+"="+value)
	}
	return result
}

func agentReuseKey(plan *RuntimePlan, agent AgentPlan) string {
	return fmt.Sprintf("%s\x00%s\x00%s\x00%s\x00%s\x00%d\x00%s\x00%s", plan.ProjectID, plan.Revision, plan.Language, plan.ControllerName, plan.ResourceName, agent.Index, agent.ChildExec, strings.Join(agent.ChildArgs, "\x00"))
}
