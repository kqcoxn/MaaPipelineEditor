package mfw

import (
	"sync"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
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
func (rm *ResourceManager) LoadResource(path string) (string, string, ResourceBundleResolution, error) {
	resolution, err := ResolveResourceBundlePath(path)
	if err != nil {
		return "", "", ResourceBundleResolution{}, NewMFWError(ErrCodeResourceLoadFailed, err.Error(), nil)
	}
	logger.Info("MFW", "加载资源: %s", resolution.DisplayLabel())

	resourceID := uuid.New().String()

	// 创建资源对象
	res, err := maa.NewResource()
	if err != nil {
		return "", "", ResourceBundleResolution{}, NewMFWError(ErrCodeResourceLoadFailed, "failed to create resource: "+err.Error(), nil)
	}

	if err := loadResolvedResourceBundle(res, resolution); err != nil {
		res.Destroy()
		return "", "", ResourceBundleResolution{}, NewMFWError(ErrCodeResourceLoadFailed, err.Error(), nil)
	}

	// 获取资源哈希
	hash := ""
	if h, err := res.GetHash(); err == nil {
		hash = h
	}

	info := &ResourceInfo{
		ResourceID: resourceID,
		Resource:   res,
		Path:       resolution.ResolvedPath,
		Loaded:     res.Loaded(),
		Hash:       hash,
	}

	rm.mu.Lock()
	rm.resources[resourceID] = info
	rm.mu.Unlock()

	logger.Info("MFW", "资源加载成功: %s, path: %s, hash: %s", resourceID, resolution.DisplayLabel(), hash)
	return resourceID, hash, resolution, nil
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
		if err := res.Destroy(); err != nil {
			return err
		}
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
			if err := res.Destroy(); err != nil {
				logger.Warn("MFW", "卸载资源 %s 失败: %v", id, err)
				continue
			}
		}
		delete(rm.resources, id)
		logger.Info("MFW", "卸载资源: %s", id)
	}

	logger.Info("MFW", "资源清理完成，剩余 %d 个", len(rm.resources))
}
