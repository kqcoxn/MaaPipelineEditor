package projectinterface

import "fmt"

// Password values cannot be sent to the debugging runtime: native framework
// logs and exported pipeline snapshots are not secret-aware. Keep the value
// only in the caller's input control until a protected runtime is available.
func ValidateDebugPasswords(definitions, values map[string]any) error {
	for optionName, raw := range definitions {
		definition, ok := raw.(map[string]any)
		if !ok || definition["type"] != "input" {
			continue
		}
		provided, _ := values[optionName].(map[string]any)
		for _, field := range objectArray(definition["inputs"]) {
			if field["password"] != true {
				continue
			}
			name, _ := field["name"].(string)
			value := provided[name]
			if value != nil && fmt.Sprint(value) != "" {
				return fmt.Errorf("Option %s 的密码字段 %s 不支持在 MPE 中调试：框架日志与调试快照无法保证密码脱敏，请清空该字段或在支持密码保护的客户端运行", optionName, name)
			}
		}
	}
	return nil
}
