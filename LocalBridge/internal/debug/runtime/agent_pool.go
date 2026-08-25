package runtime

import (
	"fmt"
	"strings"
	"sync"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
)

// AgentPool 缓存 AgentClient 实例及其绑定的 Resource。
// Pool 拥有 Resource 的生命周期，确保 agent 连接不会因 Runtime 销毁而断开。
type AgentPool struct {
	mu      sync.Mutex
	clients map[string]*agentEntry
	// piIdentifiers keeps the dynamically generated identifier stable between
	// the explicit connection test and the subsequent debug run.
	piIdentifiers map[string]string
	resources     map[string]*mfw.MaaFWAdapter
}

type agentEntry struct {
	client          *maa.AgentClient
	resourceAdapter *mfw.MaaFWAdapter
	resourceKey     string
}

func NewAgentPool() *AgentPool {
	return &AgentPool{
		clients:       make(map[string]*agentEntry),
		piIdentifiers: make(map[string]string),
		resources:     make(map[string]*mfw.MaaFWAdapter),
	}
}

// Acquire 获取或创建一个 AgentClient 实例（不做 Resource 绑定）。
func (p *AgentPool) Acquire(agent protocol.AgentProfile) (*maa.AgentClient, error) {
	key, err := agentPoolKey(agent)
	if err != nil {
		return nil, err
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	entry := p.clients[key]
	if entry != nil && entry.client != nil {
		return entry.client, nil
	}

	client, err := createAgentClient(agent)
	if err != nil {
		return nil, err
	}
	p.clients[key] = &agentEntry{client: client}
	return client, nil
}

// EnsureBound 确保 agent 已绑定到指定 resourcePaths 对应的 Resource 上。
// Pool 拥有该 Resource 的生命周期，不会随 Runtime 销毁。
func (p *AgentPool) EnsureBound(agent protocol.AgentProfile, resourcePaths []string) (*maa.AgentClient, error) {
	key, err := agentPoolKey(agent)
	if err != nil {
		return nil, err
	}
	resourceKey, resolutions, err := resolveResourceBinding(resourcePaths)
	if err != nil {
		return nil, err
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	entry := p.clients[key]
	if entry == nil || entry.client == nil {
		client, err := createAgentClient(agent)
		if err != nil {
			return nil, err
		}
		entry = &agentEntry{client: client}
		p.clients[key] = entry
	}

	if entry.resourceAdapter != nil {
		if entry.resourceKey == resourceKey {
			return entry.client, nil
		}
		if entry.client.Connected() {
			return nil, fmt.Errorf("agent 已绑定其他资源，保持连接时不支持切换资源")
		}
		entry.resourceAdapter = nil
		entry.resourceKey = ""
	}

	adapter, err := p.sharedAdapterLocked(resourceKey, resolutions)
	if err != nil {
		return nil, err
	}
	resource := adapter.GetResource()
	if resource == nil {
		return nil, fmt.Errorf("加载资源后资源实例为空")
	}
	if err := entry.client.BindResource(resource); err != nil {
		return nil, err
	}

	entry.resourceAdapter = adapter
	entry.resourceKey = resourceKey
	return entry.client, nil
}

// PreparePIAgent 创建（必要时由 MaaFramework 自动生成 identifier）、启动并绑定 PI Agent。
// starter 必须在 Connect 前启动 AgentServer 子进程。
func (p *AgentPool) PreparePIAgent(agent protocol.AgentProfile, resourcePaths []string, starter func(identifier string) error, scope ...string) (protocol.AgentProfile, error) {
	resourceKey, resolutions, err := resolveResourceBinding(resourcePaths)
	if err != nil {
		return agent, err
	}
	prepared := agent
	prepared.Transport = "identifier"

	p.mu.Lock()
	defer p.mu.Unlock()

	var client *maa.AgentClient
	identifier := strings.TrimSpace(prepared.Identifier)
	profileKey := piAgentProfileKey(prepared, resourceKey, scope...)
	if identifier == "" {
		identifier = p.piIdentifiers[profileKey]
	}
	if identifier != "" {
		if entry := p.clients["identifier:"+identifier]; entry != nil {
			client = entry.client
		}
	}
	if client == nil {
		client, err = maa.NewAgentClient(maa.WithIdentifier(identifier))
		if err != nil {
			return agent, err
		}
		identifier, err = client.Identifier()
		if err != nil {
			client.Destroy()
			return agent, err
		}
	}
	prepared.Identifier = identifier
	key := "identifier:" + identifier
	entry := p.clients[key]
	if entry == nil {
		entry = &agentEntry{client: client}
	}
	if err := starter(identifier); err != nil {
		if p.clients[key] == nil {
			client.Destroy()
		}
		return agent, err
	}

	if entry.resourceAdapter == nil || entry.resourceKey != resourceKey {
		if entry.resourceAdapter != nil {
			if entry.client.Connected() {
				return agent, fmt.Errorf("agent 已绑定其他资源，保持连接时不支持切换资源")
			}
		}
		adapter, err := p.sharedAdapterLocked(resourceKey, resolutions)
		if err != nil {
			return agent, err
		}
		resource := adapter.GetResource()
		if resource == nil {
			return agent, fmt.Errorf("加载资源后资源实例为空")
		}
		if err := entry.client.BindResource(resource); err != nil {
			return agent, err
		}
		entry.resourceAdapter = adapter
		entry.resourceKey = resourceKey
	}
	p.clients[key] = entry
	p.piIdentifiers[profileKey] = identifier
	return prepared, nil
}

func (p *AgentPool) Close() {
	p.mu.Lock()
	defer p.mu.Unlock()
	for key, entry := range p.clients {
		if entry.client != nil {
			if entry.client.Connected() {
				_ = entry.client.Disconnect()
			}
			entry.client.Destroy()
		}
		delete(p.clients, key)
	}
	for key, adapter := range p.resources {
		adapter.Destroy()
		delete(p.resources, key)
	}
	clear(p.piIdentifiers)
}

func piAgentProfileKey(agent protocol.AgentProfile, resourceKey string, scope ...string) string {
	profileScope := ""
	if len(scope) > 0 {
		profileScope = strings.TrimSpace(scope[0])
	}
	return strings.Join([]string{
		strings.TrimSpace(agent.ID),
		resourceKey,
		profileScope,
	}, "\x00")
}

func (p *AgentPool) sharedAdapterLocked(resourceKey string, resolutions []mfw.ResourceBundleResolution) (*mfw.MaaFWAdapter, error) {
	if adapter := p.resources[resourceKey]; adapter != nil {
		return adapter, nil
	}
	adapter := mfw.NewMaaFWAdapter()
	if err := adapter.LoadResolvedResources(resolutions); err != nil {
		adapter.Destroy()
		return nil, fmt.Errorf("加载资源失败: %w", err)
	}
	if adapter.GetResource() == nil {
		adapter.Destroy()
		return nil, fmt.Errorf("加载资源后资源实例为空")
	}
	p.resources[resourceKey] = adapter
	return adapter, nil
}

// GetResource 获取指定 agent 在 Pool 中绑定的 Resource。
// 如果 agent 未绑定 Resource，返回 nil。
func (p *AgentPool) GetResource(agent protocol.AgentProfile) *maa.Resource {
	key, err := agentPoolKey(agent)
	if err != nil {
		return nil
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	entry := p.clients[key]
	if entry == nil || entry.resourceAdapter == nil {
		return nil
	}
	return entry.resourceAdapter.GetResource()
}

func normalizeAgentProfile(agent protocol.AgentProfile) (protocol.AgentProfile, error) {
	prepared := agent
	prepared.Transport = strings.TrimSpace(prepared.Transport)
	switch prepared.Transport {
	case "tcp":
		if prepared.TCPPort <= 0 {
			return prepared, fmt.Errorf("tcp agent 缺少 tcpPort: %s", prepared.ID)
		}
		return prepared, nil
	case "", "identifier":
		identifier := strings.TrimSpace(prepared.Identifier)
		if identifier == "" {
			return prepared, fmt.Errorf("identifier agent 缺少 identifier: %s", prepared.ID)
		}
		prepared.Transport = "identifier"
		prepared.Identifier = identifier
		return prepared, nil
	default:
		return prepared, fmt.Errorf("不支持的 agent transport: %s", prepared.Transport)
	}
}

func agentPoolKey(agent protocol.AgentProfile) (string, error) {
	prepared, err := normalizeAgentProfile(agent)
	if err != nil {
		return "", err
	}
	if prepared.Transport == "tcp" {
		return fmt.Sprintf("tcp:%d", prepared.TCPPort), nil
	}
	return "identifier:" + prepared.Identifier, nil
}

func resolveResourceBinding(resourcePaths []string) (string, []mfw.ResourceBundleResolution, error) {
	resolutions, err := mfw.ResolveResourceBundlePaths(resourcePaths)
	if err != nil {
		return "", nil, err
	}
	if len(resolutions) == 0 {
		return "", nil, fmt.Errorf("profile.resourcePaths 不能为空")
	}
	return resourceBindingKeyFromResolutions(resolutions), resolutions, nil
}

func resourceBindingKeyFromResolutions(resolutions []mfw.ResourceBundleResolution) string {
	normalized := make([]string, 0, len(resolutions))
	for _, resolution := range resolutions {
		normalized = append(normalized, resolution.ResolvedPath)
	}
	return strings.Join(normalized, "\n")
}
