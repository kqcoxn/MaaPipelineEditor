package mfw

import (
	"sync"

	"github.com/google/uuid"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
)

// 资源管理器
type ResourceManager struct {
	resources map[string]*ResourceInfo
	mu        sync.RWMutex
}

// 创建资源管理器
func NewResourceManager() *ResourceManager {
	return &ResourceManager{
		resources: make(map[string]*ResourceInfo),
	}
}

// 加载资源
func (rm *ResourceManager) LoadResource(path string) (string, string, error) {
	logger.Info("MFW", "加载资源: %s", path)

	resourceID := uuid.New().String()

	// TODO: 实际调用
	// res := maa.NewResource()
	// res.PostBundle(path).Wait()
	// hash, _ := res.GetHash()

	info := &ResourceInfo{
		ResourceID: resourceID,
		Path:       path,
		Loaded:     true,
		Hash:       "", // TODO: 实际哈希值
	}

	rm.mu.Lock()
	rm.resources[resourceID] = info
	rm.mu.Unlock()

	logger.Info("MFW", "资源加载成功: %s", resourceID)
	return resourceID, "", nil
}

// 获取资源
func (rm *ResourceManager) GetResource(resourceID string) (*ResourceInfo, error) {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	info, exists := rm.resources[resourceID]
	if !exists {
		return nil, ErrResourceNotFound
	}

	return info, nil
}

// 卸载资源
func (rm *ResourceManager) UnloadResource(resourceID string) error {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	_, exists := rm.resources[resourceID]
	if !exists {
		return ErrResourceNotFound
	}

	// TODO: 调用resource.Destroy()

	delete(rm.resources, resourceID)

	logger.Info("MFW", "资源已卸载: %s", resourceID)
	return nil
}
