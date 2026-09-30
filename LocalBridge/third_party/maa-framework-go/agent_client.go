package maa

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/MaaXYZ/maa-framework-go/v4/internal/buffer"
	"github.com/MaaXYZ/maa-framework-go/v4/internal/native"
)

// AgentClient is used to connect to AgentServer, delegating custom recognition and
// action execution to a separate process. This allows separating MaaFW core from
// custom logic into independent processes.
type AgentClient struct {
	handle         uintptr
	state          *handleState
	refsMu         sync.Mutex
	resource       *handleState
	resourceSink   *handleState
	controllerSink *handleState
	taskerSink     *handleState
}

var (
	ErrInvalidAgentClient = errors.New("invalid agent client")
	ErrInvalidResource    = errors.New("invalid resource")
	ErrInvalidController  = errors.New("invalid controller")
	ErrInvalidTasker      = errors.New("invalid tasker")
	ErrInvalidTimeout     = errors.New("timeout must be non-negative")
)

const (
	agentClientCreationModeIdentifier = "identifier"
	agentClientCreationModeTcp        = "tcp"
)

type agentClientConfig struct {
	identifier string
	tcpPort    uint16
	lastSet    string
}

// AgentClientOption configures how an Agent client is created.
type AgentClientOption func(*agentClientConfig)

// WithIdentifier sets the client identifier for creating an agent client.
// The identifier is used to identify this specific client instance.
// The identifier creation mode uses IPC, and will fall back to TCP on older
// Windows versions that do not support AF_UNIX (builds prior to 17063).
// If empty, an identifier will be automatically generated.
//
// Priority: This option takes precedence for creation mode if specified
// after WithTcpPort. If specified before WithTcpPort, WithTcpPort will
// override it.
func WithIdentifier(identifier string) AgentClientOption {
	return func(cfg *agentClientConfig) {
		cfg.identifier = identifier
		cfg.lastSet = agentClientCreationModeIdentifier
	}
}

// WithTcpPort sets the TCP port for creating a TCP-based agent client.
// The client will connect to the agent server at the specified port.
//
// Priority: This option takes precedence for creation mode if specified
// after WithIdentifier. If specified before WithIdentifier, WithIdentifier
// will override it.
func WithTcpPort(port uint16) AgentClientOption {
	return func(cfg *agentClientConfig) {
		cfg.tcpPort = port
		cfg.lastSet = agentClientCreationModeTcp
	}
}

// NewAgentClient creates an Agent client instance with specified options.
// At least one creation option (WithIdentifier or WithTcpPort) should be provided.
// If none is provided, it defaults to identifier mode with an empty identifier.
//
// See WithIdentifier and WithTcpPort for priority rules when both are specified.
func NewAgentClient(opts ...AgentClientOption) (*AgentClient, error) {
	cfg := &agentClientConfig{lastSet: agentClientCreationModeIdentifier}
	for _, opt := range opts {
		opt(cfg)
	}

	var handle uintptr
	if cfg.lastSet == agentClientCreationModeTcp {
		handle = native.MaaAgentClientCreateTcp(cfg.tcpPort)
	} else {
		identifierStrBuf := buffer.NewStringBuffer()
		defer identifierStrBuf.Destroy()
		identifierStrBuf.Set(cfg.identifier)
		handle = native.MaaAgentClientCreateV2(identifierStrBuf.Handle())
	}

	if handle == 0 {
		return nil, errors.New("failed to create agent client")
	}
	return newAgentClientByHandle(handle), nil
}

func newAgentClientByHandle(handle uintptr) *AgentClient {
	client := &AgentClient{handle: handle}
	client.state = newHandleState(handle, func(handle uintptr) {
		client.refsMu.Lock()
		native.MaaAgentClientDestroy(handle)
		for _, ref := range []*handleState{client.resource, client.resourceSink, client.controllerSink, client.taskerSink} {
			if ref != nil {
				ref.removeBinding()
			}
		}
		client.refsMu.Unlock()
	})
	return client
}

func (ac *AgentClient) ensureValid() error {
	if ac == nil || ac.handle == 0 {
		return ErrInvalidAgentClient
	}
	return nil
}

func (ac *AgentClient) begin() (uintptr, func(), error) {
	if ac == nil || ac.state == nil {
		return 0, nil, ErrInvalidAgentClient
	}
	return ac.state.begin()
}

func agentClientOpError(op string) error {
	return fmt.Errorf("agent client %s failed", op)
}

// Destroy releases the client and its references to native objects once.
// It returns ErrInUse while a client call is active; retry after the call ends.
func (ac *AgentClient) Destroy() error {
	if ac == nil {
		return nil
	}
	return ac.state.close()
}

// Identifier returns the identifier of the current agent client.
func (ac *AgentClient) Identifier() (string, error) {
	_, done, useErr := ac.begin()
	if useErr != nil {
		return "", useErr
	}
	defer done()

	if err := ac.ensureValid(); err != nil {
		return "", err
	}

	buf := buffer.NewStringBuffer()
	defer buf.Destroy()
	if !native.MaaAgentClientIdentifier(ac.handle, buf.Handle()) {
		return "", agentClientOpError("get identifier")
	}
	return buf.Get(), nil
}

// BindResource links the Agent client to the specified resource.
func (ac *AgentClient) BindResource(res *Resource) error {
	_, done, useErr := ac.begin()
	if useErr != nil {
		return useErr
	}
	defer done()

	if err := ac.ensureValid(); err != nil {
		return err
	}
	if res == nil {
		return ErrInvalidResource
	}
	handle, err := res.state.addBinding()
	if err != nil {
		return err
	}
	ac.refsMu.Lock()
	defer ac.refsMu.Unlock()
	if !native.MaaAgentClientBindResource(ac.handle, handle) {
		res.state.removeBinding()
		return agentClientOpError("bind resource")
	}
	if ac.resource != nil {
		ac.resource.removeBinding()
	}
	ac.resource = res.state
	return nil
}

// RegisterResourceSink registers resource events for the resource.
func (ac *AgentClient) RegisterResourceSink(res *Resource) error {
	_, done, useErr := ac.begin()
	if useErr != nil {
		return useErr
	}
	defer done()

	if err := ac.ensureValid(); err != nil {
		return err
	}
	if res == nil {
		return ErrInvalidResource
	}
	handle, err := res.state.addBinding()
	if err != nil {
		return err
	}
	ac.refsMu.Lock()
	defer ac.refsMu.Unlock()
	if !native.MaaAgentClientRegisterResourceSink(ac.handle, handle) {
		res.state.removeBinding()
		return agentClientOpError("register resource sink")
	}
	if ac.resourceSink != nil {
		ac.resourceSink.removeBinding()
	}
	ac.resourceSink = res.state
	return nil
}

// RegisterControllerSink registers controller events for the controller.
func (ac *AgentClient) RegisterControllerSink(ctrl Controller) error {
	_, done, useErr := ac.begin()
	if useErr != nil {
		return useErr
	}
	defer done()

	if err := ac.ensureValid(); err != nil {
		return err
	}
	if ctrl.state == nil {
		return ErrInvalidController
	}
	handle, err := ctrl.state.addBinding()
	if err != nil {
		return err
	}
	ac.refsMu.Lock()
	defer ac.refsMu.Unlock()
	if !native.MaaAgentClientRegisterControllerSink(ac.handle, handle) {
		ctrl.state.removeBinding()
		return agentClientOpError("register controller sink")
	}
	if ac.controllerSink != nil {
		ac.controllerSink.removeBinding()
	}
	ac.controllerSink = ctrl.state
	return nil
}

// RegisterTaskerSink registers tasker events for the tasker.
func (ac *AgentClient) RegisterTaskerSink(tasker Tasker) error {
	_, done, useErr := ac.begin()
	if useErr != nil {
		return useErr
	}
	defer done()

	if err := ac.ensureValid(); err != nil {
		return err
	}
	if tasker.state == nil {
		return ErrInvalidTasker
	}
	handle, err := tasker.state.addBinding()
	if err != nil {
		return err
	}
	ac.refsMu.Lock()
	defer ac.refsMu.Unlock()
	if !native.MaaAgentClientRegisterTaskerSink(ac.handle, handle) {
		tasker.state.removeBinding()
		return agentClientOpError("register tasker sink")
	}
	if ac.taskerSink != nil {
		ac.taskerSink.removeBinding()
	}
	ac.taskerSink = tasker.state.handleState
	return nil
}

// Connect connects to the Agent server.
func (ac *AgentClient) Connect() error {
	_, done, useErr := ac.begin()
	if useErr != nil {
		return useErr
	}
	defer done()

	if err := ac.ensureValid(); err != nil {
		return err
	}
	if !native.MaaAgentClientConnect(ac.handle) {
		return agentClientOpError("connect")
	}
	return nil
}

// Disconnect disconnects from the Agent server.
func (ac *AgentClient) Disconnect() error {
	_, done, useErr := ac.begin()
	if useErr != nil {
		return useErr
	}
	defer done()

	if err := ac.ensureValid(); err != nil {
		return err
	}
	if !native.MaaAgentClientDisconnect(ac.handle) {
		return agentClientOpError("disconnect")
	}
	return nil
}

// Connected checks if the client is connected to the Agent server.
func (ac *AgentClient) Connected() bool {
	_, done, useErr := ac.begin()
	if useErr != nil {
		return false
	}
	defer done()

	if ac == nil || ac.handle == 0 {
		return false
	}
	return native.MaaAgentClientConnected(ac.handle)
}

// Alive checks if the Agent server is still responsive.
func (ac *AgentClient) Alive() bool {
	_, done, useErr := ac.begin()
	if useErr != nil {
		return false
	}
	defer done()

	if ac == nil || ac.handle == 0 {
		return false
	}
	return native.MaaAgentClientAlive(ac.handle)
}

// SetTimeout sets the timeout duration for the Agent server.
func (ac *AgentClient) SetTimeout(duration time.Duration) error {
	_, done, useErr := ac.begin()
	if useErr != nil {
		return useErr
	}
	defer done()

	if err := ac.ensureValid(); err != nil {
		return err
	}
	if duration < 0 {
		return ErrInvalidTimeout
	}

	milliseconds := duration.Milliseconds()

	if !native.MaaAgentClientSetTimeout(ac.handle, milliseconds) {
		return agentClientOpError("set timeout")
	}
	return nil
}

// GetCustomRecognitionList returns the custom recognition name list of the agent client.
func (ac *AgentClient) GetCustomRecognitionList() ([]string, error) {
	_, done, useErr := ac.begin()
	if useErr != nil {
		return nil, useErr
	}
	defer done()

	if err := ac.ensureValid(); err != nil {
		return nil, err
	}
	buf := buffer.NewStringListBuffer()
	defer buf.Destroy()

	if !native.MaaAgentClientGetCustomRecognitionList(ac.handle, buf.Handle()) {
		return nil, agentClientOpError("get custom recognition list")
	}
	return buf.GetAll(), nil
}

// GetCustomActionList returns the custom action name list of the agent client.
func (ac *AgentClient) GetCustomActionList() ([]string, error) {
	_, done, useErr := ac.begin()
	if useErr != nil {
		return nil, useErr
	}
	defer done()

	if err := ac.ensureValid(); err != nil {
		return nil, err
	}
	buf := buffer.NewStringListBuffer()
	defer buf.Destroy()

	if !native.MaaAgentClientGetCustomActionList(ac.handle, buf.Handle()) {
		return nil, agentClientOpError("get custom action list")
	}
	return buf.GetAll(), nil
}
