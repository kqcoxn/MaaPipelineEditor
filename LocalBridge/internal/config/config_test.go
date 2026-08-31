package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestResolveFileRootPrecedence(t *testing.T) {
	configDir := t.TempDir()
	cwd := t.TempDir()
	configuredRoot := filepath.Join(configDir, "configured")
	cliRoot := filepath.Join(cwd, "cli")
	for _, dir := range []string{configuredRoot, cliRoot} {
		if err := os.Mkdir(dir, 0o755); err != nil {
			t.Fatalf("create test directory: %v", err)
		}
	}
	configPath := filepath.Join(configDir, "config.json")

	tests := []struct {
		name           string
		configuredRoot string
		cliRoot        string
		cliSpecified   bool
		wantRoot       string
		wantSource     RootSource
	}{
		{
			name:           "configured root wins over cwd",
			configuredRoot: "configured",
			wantRoot:       configuredRoot,
			wantSource:     RootSourceConfig,
		},
		{
			name:           "cli root wins over configured root",
			configuredRoot: filepath.Join(configDir, "missing"),
			cliRoot:        "cli",
			cliSpecified:   true,
			wantRoot:       cliRoot,
			wantSource:     RootSourceCLI,
		},
		{
			name:           "legacy dot root falls back to cwd",
			configuredRoot: "./",
			wantRoot:       cwd,
			wantSource:     RootSourceCWD,
		},
		{
			name:       "missing root falls back to cwd",
			wantRoot:   cwd,
			wantSource: RootSourceCWD,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := resolveFileRoot(
				tt.configuredRoot,
				tt.cliRoot,
				tt.cliSpecified,
				configPath,
				cwd,
			)
			if err != nil {
				t.Fatalf("resolveFileRoot() error = %v", err)
			}
			if got.FileRoot != tt.wantRoot {
				t.Fatalf("resolveFileRoot() root = %q, want %q", got.FileRoot, tt.wantRoot)
			}
			if got.RootSource != tt.wantSource {
				t.Fatalf("resolveFileRoot() source = %q, want %q", got.RootSource, tt.wantSource)
			}
		})
	}
}

func TestResolveFileRootRejectsSelectedInvalidConfigRoot(t *testing.T) {
	configDir := t.TempDir()
	_, err := resolveFileRoot(
		"missing",
		"",
		false,
		filepath.Join(configDir, "config.json"),
		t.TempDir(),
	)
	if err == nil {
		t.Fatal("resolveFileRoot() error = nil, want invalid configured root error")
	}
}

func TestSaveDoesNotPersistRuntimeRoot(t *testing.T) {
	configPath := filepath.Join(t.TempDir(), "config.json")
	cfg := &Config{
		File: FileConfig{
			Exclude:    []string{"node_modules"},
			Extensions: []string{".json"},
		},
		configFilePath: configPath,
		runtime: RuntimeConfig{
			FileRoot:   t.TempDir(),
			RootSource: RootSourceCWD,
		},
	}

	if err := cfg.Save(); err != nil {
		t.Fatalf("Save() error = %v", err)
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("read saved config: %v", err)
	}
	var saved map[string]any
	if err := json.Unmarshal(data, &saved); err != nil {
		t.Fatalf("decode saved config: %v", err)
	}
	fileConfig, ok := saved["file"].(map[string]any)
	if !ok {
		t.Fatalf("saved file config = %#v", saved["file"])
	}
	if root, exists := fileConfig["root"]; exists {
		t.Fatalf("saved runtime root = %#v, want root omitted", root)
	}
}

func TestSavingAfterCLIOverrideDoesNotPersistRuntimeRoot(t *testing.T) {
	configPath := filepath.Join(t.TempDir(), "config.json")
	if err := os.WriteFile(configPath, []byte("{}"), 0o644); err != nil {
		t.Fatalf("write config: %v", err)
	}
	cfg, err := Load(configPath)
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	runtimeRoot := t.TempDir()
	if err := cfg.OverrideFromFlags(runtimeRoot, "", "", "", 0, true, false); err != nil {
		t.Fatalf("OverrideFromFlags() error = %v", err)
	}
	if err := cfg.SetMaaFWLibDir(filepath.Join(t.TempDir(), "lib")); err != nil {
		t.Fatalf("SetMaaFWLibDir() error = %v", err)
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("read saved config: %v", err)
	}
	var saved struct {
		File FileConfig `json:"file"`
	}
	if err := json.Unmarshal(data, &saved); err != nil {
		t.Fatalf("decode saved config: %v", err)
	}
	if saved.File.Root != "" {
		t.Fatalf("saved root = %q, want omitted runtime root", saved.File.Root)
	}
}
