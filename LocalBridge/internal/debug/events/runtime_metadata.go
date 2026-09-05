package events

import (
	"encoding/json"
	"time"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
)

// 从正在执行的 Context 读取有效参数，避免把编辑器草稿或未合并的默认值当成运行值。
func attachRuntimeMetadata(ctx *maa.Context, event *protocol.Event, name string) {
	if ctx == nil || name == "" || event.Phase != "starting" {
		return
	}
	content, err := ctx.GetNodeJSON(name)
	if err != nil {
		return
	}
	metadata := summarizeRuntimeMetadata(content)
	if len(metadata) > 0 {
		event.Data["runtime"] = metadata
	}
}

func summarizeRuntimeMetadata(content string) map[string]interface{} {
	var node map[string]interface{}
	if json.Unmarshal([]byte(content), &node) != nil {
		return nil
	}
	result := make(map[string]interface{})
	for _, key := range []string{"timeout", "rate_limit"} {
		if value, ok := node[key].(float64); ok {
			result[key] = value
		}
	}
	for _, kind := range []string{"recognition", "action"} {
		component, ok := node[kind].(map[string]interface{})
		if !ok {
			continue
		}
		if name, ok := component["type"].(string); ok {
			result[kind] = name
		}
		param, _ := component["param"].(map[string]interface{})
		if name, ok := param["custom_"+kind].(string); ok {
			key := "customRecognition"
			if kind == "action" {
				key = "customAction"
			}
			result[key] = name
		}
	}
	return result
}

func eventTimestamp() string { return time.Now().UTC().Format(time.RFC3339Nano) }
