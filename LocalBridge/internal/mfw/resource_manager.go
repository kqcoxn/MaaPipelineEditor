package mfw

import (
	"os"
	"runtime"
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
func (rm *ResourceManager) LoadResource(path string) (string, string, error) {
	logger.Info("MFW", "加载资源: %s", path)

	// Windows 下处理中文路径
	actualPath := path
	useWorkDirSwitch := false
	var originalDir string
	if runtime.GOOS == "windows" && ContainsNonASCII(path) {
		logger.Debug("MFW", "资源路径包含非 ASCII 字符，尝试转换为短路径...")
		shortPath, err := GetShortPathName(path)
		if err == nil && shortPath != path && !ContainsNonASCII(shortPath) {
			logger.Debug("MFW", "资源路径已转换为短路径: %s", shortPath)
			actualPath = shortPath
		} else {
			// 工作目录切换方案
			logger.Debug("MFW", "短路径无效，使用工作目录切换方案...")
			originalDir, err = os.Getwd()
			if err == nil {
				if err := os.Chdir(path); err == nil {
					logger.Debug("MFW", "已切换工作目录到: %s", path)
					actualPath = "."
					useWorkDirSwitch = true
				}
			}
		}
	}

	resourceID := uuid.New().String()

	// 创建资源对象
	res, err := maa.NewResource()
	if err != nil {
		return "", "", NewMFWError(ErrCodeResourceLoadFailed, "failed to create resource: "+err.Error(), nil)
	}

	// 加载资源包
	job := res.PostBundle(actualPath)
	if job == nil {
		if useWorkDirSwitch && originalDir != "" {
			os.Chdir(originalDir)
		}
		res.Destroy()
		return "", "", NewMFWError(ErrCodeResourceLoadFailed, "failed to post bundle", nil)
	}
	job.Wait()

	// 恢复工作目录
	if useWorkDirSwitch && originalDir != "" {
		if err := os.Chdir(originalDir); err != nil {
			logger.Warn("MFW", "恢复工作目录失败: %v", err)
		}
	}

	if !job.Success() {
		res.Destroy()
		return "", "", NewMFWError(ErrCodeResourceLoadFailed, "resource bundle load failed", nil)
	}

	// 获取资源哈希
	hash := ""
	if h, err := res.GetHash(); err == nil {
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
