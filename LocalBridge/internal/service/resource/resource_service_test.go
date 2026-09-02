package resource

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
)

func TestServiceDiscoversNestedResourceBundle(t *testing.T) {
	root := t.TempDir()
	imagePath := filepath.Join(root, "assets", "resource", "base", "image", "global", "back.png")
	if err := os.MkdirAll(filepath.Dir(imagePath), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(imagePath, []byte("png"), 0o644); err != nil {
		t.Fatal(err)
	}

	service := NewService(root, eventbus.New(), 3)
	if err := service.Scan(); err != nil {
		t.Fatal(err)
	}

	list := service.GetBundleList()
	if len(list.Bundles) != 1 {
		t.Fatalf("bundle count = %d, want 1: %#v", len(list.Bundles), list.Bundles)
	}
	wantBundle := filepath.Join(root, "assets", "resource", "base")
	if list.Bundles[0].AbsPath != wantBundle {
		t.Fatalf("bundle path = %q, want %q", list.Bundles[0].AbsPath, wantBundle)
	}
	if len(list.ImageDirs) != 1 || list.ImageDirs[0] != filepath.Dir(filepath.Dir(imagePath)) {
		t.Fatalf("image dirs = %#v, want [%q]", list.ImageDirs, filepath.Dir(filepath.Dir(imagePath)))
	}

	gotPath, gotBundle, found := service.FindImage("global/back.png")
	if !found {
		t.Fatal("FindImage returned found=false")
	}
	if gotPath != imagePath || gotBundle != "base" {
		t.Fatalf("FindImage = (%q, %q), want (%q, %q)", gotPath, gotBundle, imagePath, "base")
	}
}

func TestServiceUnlimitedResourceScanDepth(t *testing.T) {
	root := t.TempDir()
	imagePath := filepath.Join(root, "one", "two", "three", "four", "image", "menu.png")
	if err := os.MkdirAll(filepath.Dir(imagePath), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(imagePath, []byte("png"), 0o644); err != nil {
		t.Fatal(err)
	}

	service := NewService(root, eventbus.New(), 0)
	if err := service.Scan(); err != nil {
		t.Fatal(err)
	}
	if _, _, found := service.FindImage("menu.png"); !found {
		t.Fatal("unlimited scan did not find deeply nested image")
	}
}
