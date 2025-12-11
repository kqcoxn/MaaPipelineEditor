package mfw

import (
	"sync"

	maa "github.com/MaaXYZ/maa-framework-go/v3"
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

	// 创建资源对象
	res := maa.NewResource()
	if res == nil {
		return "", "", NewMFWError(ErrCodeResourceLoadFailed, "failed to create resource", nil)
	}

	// 加载资源包
	job := res.PostBundle(path)
	if job == nil {
		res.Destroy()
		return "", "", NewMFWError(ErrCodeResourceLoadFailed, "failed to post bundle", nil)
	}
	job.Wait()

	if !job.Success() {
		res.Destroy()
		return "", "", NewMFWError(ErrCodeResourceLoadFailed, "resource bundle load failed", nil)
	}

	// 获取资源哈希
	hash := ""
	if h, ok := res.GetHash(); ok {
		hash = h
	}

	info := &ResourceInfo{
		ResourceID: resourceID,
		Resource:   res,
		Path:       path,
		Loaded:     res.Loaded(),
		Hash:       hash,
	}

	rm.mu.Lock()
	rm.resources[resourceID] = info
	rm.mu.Unlock()

	logger.Info("MFW", "资源加载成功: %s, hash: %s", resourceID, hash)
	return resourceID, hash, nil
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

	info, exists := rm.resources[resourceID]
	if !exists {
		return ErrResourceNotFound
	}

	// 销毁资源实例
	if res, ok := info.Resource.(*maa.Resource); ok && res != nil {
		res.Destroy()
	}

	delete(rm.resources, resourceID)

	logger.Info("MFW", "资源已卸载: %s", resourceID)
	return nil
}

// 卸载所有资源
func (rm *ResourceManager) UnloadAll() {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	for id, info := range rm.resources {
		// 销毁资源实例
		if res, ok := info.Resource.(*maa.Resource); ok && res != nil {
			res.Destroy()
		}
		logger.Info("MFW", "卸载资源: %s", id)
	}

	// 清空资源列表
	rm.resources = make(map[string]*ResourceInfo)
	logger.Info("MFW", "所有资源已卸载")
}
