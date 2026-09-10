package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestLegacyDependencyPathsAreIgnoredAndRemovedOnSave(t *testing.T) {
	external := t.TempDir()
	configPath := filepath.Join(t.TempDir(), "config.json")
	data, err := json.Marshal(map[string]any{"maafw": map[string]any{
		"enabled": true, "lib_dir": external, "resource_dir": external,
	}})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(configPath, data, 0600); err != nil {
		t.Fatal(err)
	}
	previous := globalConfig
	t.Cleanup(func() { globalConfig = previous })
	cfg, err := Load(configPath)
	if err != nil {
		t.Fatal(err)
	}
	for _, dir := range []string{cfg.ResolvedMaaFWLibDir(), cfg.ResolvedMaaFWResourceDir(), cfg.ResolvedMaaFWAgentDir()} {
		if dir == external {
			t.Fatal("loaded external dependency path")
		}
	}
	if err := cfg.Save(); err != nil {
		t.Fatal(err)
	}
	saved, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatal(err)
	}
	var result struct {
		MaaFW map[string]any `json:"maafw"`
	}
	if err := json.Unmarshal(saved, &result); err != nil {
		t.Fatal(err)
	}
	if len(result.MaaFW) != 1 || result.MaaFW["enabled"] != true {
		t.Fatalf("saved dependency config = %#v, want only enabled", result.MaaFW)
	}
}
