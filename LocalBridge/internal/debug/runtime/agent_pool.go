package runtime

import (
	"fmt"
	"strings"
	"sync"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
)

type AgentPool struct {
	mu      sync.Mutex
	clients map[string]*agentEntry
}

type agentEntry struct {
	client          *maa.AgentClient
	resourceAdapter *mfw.MaaFWAdapter
	resourceKey     string
}

func NewAgentPool() *AgentPool {
	return &AgentPool{
		clients: make(map[string]*agentEntry),
	}
}

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

func (p *AgentPool) EnsureBound(agent protocol.AgentProfile, resourcePaths []string) (*maa.AgentClient, error) {
	key, err := agentPoolKey(agent)
	if err != nil {
		return nil, err
	}
	resourceKey, err := resourceBindingKey(resourcePaths)
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
		entry.resourceAdapter.Destroy()
		entry.resourceAdapter = nil
		entry.resourceKey = ""
	}

	adapter := mfw.NewMaaFWAdapter()
	if err := adapter.LoadResources(resourcePaths); err != nil {
		adapter.Destroy()
		return nil, fmt.Errorf("加载资源失败: %w", err)
	}
	resource := adapter.GetResource()
	if resource == nil {
		adapter.Destroy()
		return nil, fmt.Errorf("加载资源后资源实例为空")
	}
	if err := entry.client.BindResource(resource); err != nil {
		adapter.Destroy()
		return nil, err
	}

	entry.resourceAdapter = adapter
	entry.resourceKey = resourceKey
	return entry.client, nil
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

func resourceBindingKey(resourcePaths []string) (string, error) {
	normalized := normalizeResourcePaths(resourcePaths)
	if len(normalized) == 0 {
		return "", fmt.Errorf("profile.resourcePaths 不能为空")
	}
	return strings.Join(normalized, "\n"), nil
}
