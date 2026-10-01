package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestInterfaceEntryIsScopedToProject(t *testing.T) {
	configPath := filepath.Join(t.TempDir(), "config.json")
	// A former global entry must not select another project's resources.
	if err := os.WriteFile(configPath, []byte(`{"interface":{"path":"other/interface.json"}}`), 0o644); err != nil {
		t.Fatal(err)
	}
	a, b := t.TempDir(), t.TempDir()
	load := func(root, override string, specified bool) *Config {
		t.Helper()
		cfg, err := Load(configPath)
		if err != nil {
			t.Fatal(err)
		}
		if err := cfg.OverrideFromFlags(root, override, "", "", 0, true, specified); err != nil {
			t.Fatal(err)
		}
		return cfg
	}
	first := load(a, "", false)
	if first.Interface.Path != "" {
		t.Fatal("global entry leaked into project")
	}
	if err := first.SetInterfacePath("test/interface.json"); err != nil {
		t.Fatal(err)
	}
	second := load(b, "", false)
	if second.Interface.Path != "" {
		t.Fatal("project A entry leaked into B")
	}
	if err := second.SetInterfacePath("actual/interface.json"); err != nil {
		t.Fatal(err)
	}
	if got := load(a, "", false).Interface.Path; got != "test/interface.json" {
		t.Fatalf("A entry = %q", got)
	}
	overridden := load(b, "temporary/interface.json", true)
	if overridden.Interface.Path != "temporary/interface.json" {
		t.Fatal("CLI override ignored")
	}
	if err := overridden.Save(); err != nil {
		t.Fatal(err)
	}
	if got := load(b, "", false).Interface.Path; got != "actual/interface.json" {
		t.Fatalf("CLI override persisted: %q", got)
	}
	if err := load(a, "", false).SetInterfacePath(""); err != nil {
		t.Fatal(err)
	}
	if got := load(a, "", false).Interface.Path; got != "" {
		t.Fatalf("clear did not restore discovery: %q", got)
	}
	if got := load(b, "", false).Interface.Path; got != "actual/interface.json" {
		t.Fatalf("clearing A changed B: %q", got)
	}
}
