package config

import "testing"

func TestResolveExtendedFileRoot(t *testing.T) {
	root := t.TempDir()
	resolved, err := resolveFileRoot("", `\\?\`+root, true, "", root)
	if err != nil {
		t.Fatal(err)
	}
	if resolved.FileRoot != root || resolved.RootSource != RootSourceCLI {
		t.Fatalf("unexpected runtime root: %#v", resolved)
	}
	for _, input := range []string{`\\?\UNC\server\share\project`, `\\?\unc\server\share\project`} {
		got, err := resolvePathFromBase(input, root)
		if err != nil || got != `\\server\share\project` {
			t.Fatalf("UNC root %q resolved to %q: %v", input, got, err)
		}
	}
}
