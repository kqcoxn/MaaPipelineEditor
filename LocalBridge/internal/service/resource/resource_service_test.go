package resource

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
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

func TestServicePublishesImageChanges(t *testing.T) {
	for _, replace := range []bool{false, true} {
		name := "overwrite"
		if replace {
			name = "replace via temporary file"
		}
		t.Run(name, func(t *testing.T) {
			testServicePublishesImageChanges(t, replace)
		})
	}
}

func testServicePublishesImageChanges(t *testing.T, replace bool) {
	_ = logger.Init("ERROR", "", false)
	root := t.TempDir()
	imagePath := filepath.Join(root, "assets", "resource", "base", "image", "menu.png")
	if err := os.MkdirAll(filepath.Dir(imagePath), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(imagePath, []byte("old"), 0o644); err != nil {
		t.Fatal(err)
	}

	bus := eventbus.New()
	changes := make(chan models.ResourceImageChangedData, 10)
	bus.Subscribe(eventbus.EventResourceImageChanged, func(event eventbus.Event) {
		change, ok := event.Data.(models.ResourceImageChangedData)
		if ok {
			changes <- change
		}
	})

	service := NewService(root, bus, 3)
	if err := service.Start(); err != nil {
		t.Fatal(err)
	}
	defer service.Stop()

	// 连续覆盖同一路径，确认替换文件后监听仍然有效。
	for _, content := range []string{"new", "newer"} {
		writePath := imagePath
		if replace {
			writePath += ".crswap"
		}
		if err := os.WriteFile(writePath, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
		if replace {
			if err := os.Rename(writePath, imagePath); err != nil {
				t.Fatal(err)
			}
		}

		select {
		case change := <-changes:
			if (!replace && change.Type != "modified") || (replace && change.Type != "created" && change.Type != "modified") {
				t.Fatalf("unexpected image change type: %q", change.Type)
			}
			if change.RelativePath != "menu.png" {
				t.Fatalf("relative path = %q, want menu.png", change.RelativePath)
			}
			path, _, found := service.FindImage(change.RelativePath)
			if !found {
				t.Fatal("changed image was not found")
			}
			data, err := os.ReadFile(path)
			if err != nil || string(data) != content {
				t.Fatalf("changed image = %q, error = %v, want %q", data, err, content)
			}
		case <-time.After(2 * time.Second):
			t.Fatal("timed out waiting for image change")
		}
	}
}
