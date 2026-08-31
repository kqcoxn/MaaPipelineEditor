package paths

import (
	"encoding/json"
	"testing"
)

func TestDefaultConfigDoesNotSetFileRoot(t *testing.T) {
	var config map[string]any
	if err := json.Unmarshal(GetDefaultConfigContent(), &config); err != nil {
		t.Fatalf("decode default config: %v", err)
	}
	fileConfig, ok := config["file"].(map[string]any)
	if !ok {
		t.Fatalf("default file config = %#v", config["file"])
	}
	if root, exists := fileConfig["root"]; exists {
		t.Fatalf("default root = %#v, want root omitted", root)
	}
}
