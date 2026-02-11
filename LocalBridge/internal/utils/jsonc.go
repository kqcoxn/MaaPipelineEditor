package utils

import (
	"encoding/json"

	"github.com/tailscale/hujson"
)

// ParseJSONC 解析带注释的JSON (JSONC)
// 支持:
// - 行注释 (// ...)
// - 块注释 (/* ... */)
// - 尾随逗号
func ParseJSONC(data []byte, v interface{}) error {
	// 使用 hujson 标准化 JSON
	standardized, err := hujson.Standardize(data)
	if err != nil {
		return err
	}

	// 使用标准 JSON 解析器解析标准化后的数据
	return json.Unmarshal(standardized, v)
}

// IsValidJSONC 检查数据是否为有效的 JSONC 格式
func IsValidJSONC(data []byte) bool {
	_, err := hujson.Standardize(data)
	return err == nil
}
