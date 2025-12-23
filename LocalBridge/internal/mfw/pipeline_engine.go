package mfw

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
)

// PipelineEngine 流水线执行引擎
type PipelineEngine struct {
	pipelineConfig map[string]interface{} // 完整的 Pipeline 配置
	resourcePath   string                 // 资源路径
}

// NewPipelineEngine 创建 Pipeline 执行引擎
func NewPipelineEngine(resourcePath string) (*PipelineEngine, error) {
	pe := &PipelineEngine{
		pipelineConfig: make(map[string]interface{}),
		resourcePath:   resourcePath,
	}

	// 加载 Pipeline 配置
	if err := pe.loadPipelineConfig(); err != nil {
		return nil, fmt.Errorf("加载 Pipeline 配置失败: %w", err)
	}

	return pe, nil
}

// loadPipelineConfig 从资源路径加载 Pipeline 配置
func (pe *PipelineEngine) loadPipelineConfig() error {
	pipelinePath := filepath.Join(pe.resourcePath, "pipeline")

	logger.Debug("PipelineEngine", "加载 Pipeline 配置: %s", pipelinePath)

	// 检查 pipeline 目录是否存在
	if _, err := os.Stat(pipelinePath); os.IsNotExist(err) {
		return fmt.Errorf("pipeline 目录不存在: %s", pipelinePath)
	}

	// 读取所有 JSON 文件
	files, err := os.ReadDir(pipelinePath)
	if err != nil {
		return fmt.Errorf("读取 pipeline 目录失败: %w", err)
	}

	// 合并所有 Pipeline 文件
	for _, file := range files {
		if file.IsDir() {
			continue
		}

		if filepath.Ext(file.Name()) != ".json" {
			continue
		}

		filePath := filepath.Join(pipelinePath, file.Name())
		data, err := os.ReadFile(filePath)
		if err != nil {
			logger.Warn("PipelineEngine", "读取文件失败: %s, %v", filePath, err)
			continue
		}

		var config map[string]interface{}
		if err := json.Unmarshal(data, &config); err != nil {
			logger.Warn("PipelineEngine", "解析 JSON 失败: %s, %v", filePath, err)
			continue
		}

		// 合并到总配置中
		for key, value := range config {
			pe.pipelineConfig[key] = value
		}

		logger.Debug("PipelineEngine", "已加载配置文件: %s, 节点数: %d", file.Name(), len(config))
	}

	logger.Info("PipelineEngine", "Pipeline 配置加载完成, 总节点数: %d", len(pe.pipelineConfig))

	return nil
}

// BuildOverrideForBreakpoints 为断点构造 override 配置
func (pe *PipelineEngine) BuildOverrideForBreakpoints(breakpoints []string) map[string]interface{} {
	override := make(map[string]interface{})

	for _, nodeID := range breakpoints {
		// 检查节点是否存在
		if _, exists := pe.pipelineConfig[nodeID]; !exists {
			logger.Warn("PipelineEngine", "断点节点不存在于 Pipeline 中: %s", nodeID)
			continue
		}

		// 将 next 和 on_error 置为空数组
		override[nodeID] = map[string]interface{}{
			"next":     []string{},
			"on_error": []string{},
		}

		logger.Debug("PipelineEngine", "为节点 %s 设置断点 override", nodeID)
	}

	logger.Info("PipelineEngine", "构造断点 override 完成, 断点数: %d", len(override))

	return override
}

// BuildOverrideForContinue 为继续执行构造 override 配置
func (pe *PipelineEngine) BuildOverrideForContinue(breakpoints []string, currentNode string) map[string]interface{} {
	override := make(map[string]interface{})

	for _, nodeID := range breakpoints {
		// 跳过当前节点
		if nodeID == currentNode {
			logger.Debug("PipelineEngine", "移除当前节点 %s 的断点 override", currentNode)
			continue
		}

		// 检查节点是否存在
		if _, exists := pe.pipelineConfig[nodeID]; !exists {
			logger.Warn("PipelineEngine", "断点节点不存在于 Pipeline 中: %s", nodeID)
			continue
		}

		// 将 next 和 on_error 置为空数组
		override[nodeID] = map[string]interface{}{
			"next":     []string{},
			"on_error": []string{},
		}

		logger.Debug("PipelineEngine", "为节点 %s 保留断点 override", nodeID)
	}

	logger.Info("PipelineEngine", "构造继续执行 override 完成, 活跃断点数: %d", len(override))

	return override
}

// BuildOverrideForStep 为单步执行构造 override 配置
func (pe *PipelineEngine) BuildOverrideForStep(breakpoints []string, currentNode string, nextNodes []string) map[string]interface{} {
	override := make(map[string]interface{})

	// 添加原有断点
	for _, nodeID := range breakpoints {
		// 跳过当前节点
		if nodeID == currentNode {
			continue
		}

		// 检查节点是否存在
		if _, exists := pe.pipelineConfig[nodeID]; !exists {
			logger.Warn("PipelineEngine", "断点节点不存在于 Pipeline 中: %s", nodeID)
			continue
		}

		override[nodeID] = map[string]interface{}{
			"next":     []string{},
			"on_error": []string{},
		}
	}

	// 添加临时断点
	for _, nodeID := range nextNodes {
		// 检查节点是否存在
		if _, exists := pe.pipelineConfig[nodeID]; !exists {
			logger.Warn("PipelineEngine", "下一个节点不存在于 Pipeline 中: %s", nodeID)
			continue
		}

		// 添加临时断点
		override[nodeID] = map[string]interface{}{
			"next":     []string{},
			"on_error": []string{},
		}

		logger.Debug("PipelineEngine", "为下一个节点 %s 添加临时断点 override", nodeID)
	}

	logger.Info("PipelineEngine", "构造单步执行 override 完成, 断点数: %d, 临时断点数: %d",
		len(breakpoints)-1, len(nextNodes))

	return override
}

// GetNodeConfig 获取指定节点的配置
func (pe *PipelineEngine) GetNodeConfig(nodeID string) (map[string]interface{}, bool) {
	config, exists := pe.pipelineConfig[nodeID]
	if !exists {
		return nil, false
	}

	nodeConfig, ok := config.(map[string]interface{})
	if !ok {
		return nil, false
	}

	return nodeConfig, true
}

// GetNodeNextList 获取节点的 next 列表
func (pe *PipelineEngine) GetNodeNextList(nodeID string) []string {
	nodeConfig, exists := pe.GetNodeConfig(nodeID)
	if !exists {
		return nil
	}

	nextValue, exists := nodeConfig["next"]
	if !exists {
		return nil
	}

	// 处理不同类型的 next
	switch v := nextValue.(type) {
	case string:
		return []string{v}
	case []interface{}:
		var nextList []string
		for _, item := range v {
			if str, ok := item.(string); ok {
				nextList = append(nextList, str)
			}
		}
		return nextList
	case []string:
		return v
	default:
		return nil
	}
}

// ValidateBreakpoints 验证断点列表的有效性
func (pe *PipelineEngine) ValidateBreakpoints(breakpoints []string) (valid []string, invalid []string) {
	for _, nodeID := range breakpoints {
		if _, exists := pe.pipelineConfig[nodeID]; exists {
			valid = append(valid, nodeID)
		} else {
			invalid = append(invalid, nodeID)
		}
	}

	if len(invalid) > 0 {
		logger.Warn("PipelineEngine", "发现无效断点: %v", invalid)
	}

	return valid, invalid
}
