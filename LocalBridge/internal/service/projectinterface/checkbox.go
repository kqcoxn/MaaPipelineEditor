package projectinterface

import "fmt"

// ValidateCheckboxOptions runs before execution; an incomplete selection must
// still be resolvable so the editor can show the controls needed to complete it.
func ValidateCheckboxOptions(definitions, values map[string]any) error {
	for name, raw := range definitions {
		definition, ok := raw.(map[string]any)
		if !ok || definition["type"] != "checkbox" {
			continue
		}
		cases := objectArray(definition["cases"])
		min, max := 0, len(cases)
		for key, dest := range map[string]*int{"min_count": &min, "max_count": &max} {
			if value, exists := definition[key]; exists {
				number, err := convertInputValue(value, "int")
				if err != nil {
					return fmt.Errorf("Option %s 的 %s 必须为非负整数", name, key)
				}
				count := number.(int64)
				if count < 0 || count > int64(len(cases)) {
					return fmt.Errorf("Option %s 的 %s 超出可选项数量", name, key)
				}
				*dest = int(count)
			}
		}
		if min > max {
			return fmt.Errorf("Option %s 的 min_count 不能超过 max_count", name)
		}
		selected := toStringValues(values[name])
		unique := map[string]bool{}
		for _, item := range selected {
			if findNamed(cases, item) == nil || unique[item] {
				return fmt.Errorf("Option %s 包含未知或重复选项", name)
			}
			unique[item] = true
		}
		if len(unique) < min || len(unique) > max {
			return fmt.Errorf("Option %s 需要选择 %d 至 %d 项，当前 %d 项", name, min, max, len(unique))
		}
	}
	return nil
}
