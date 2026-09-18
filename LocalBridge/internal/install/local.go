package install

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// InstallLocal prepares a source build through the same transaction as releases.
// This is an explicit developer command; it never runs on Desktop startup.
func InstallLocal(ctx context.Context, dir, binary, editor, runtimeDir, version, mfwVersion string, minimumDesktopRevision uint32, output io.Writer) error {
	if minimumDesktopRevision == 0 {
		return fmt.Errorf("缺少最低桌面修订号")
	}
	temp, err := os.MkdirTemp("", "mpe-source-build-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(temp)
	stage := filepath.Join(temp, "stage")
	if err = copyFile(binary, filepath.Join(stage, BinaryName()), 0755); err != nil {
		return err
	}
	if err = copyTree(runtimeDir, filepath.Join(stage, "runtime")); err != nil {
		return err
	}
	archive := filepath.Join(temp, "bundle.zip")
	if err = zipTree(stage, archive); err != nil {
		return err
	}
	editorArchive := filepath.Join(temp, "editor.zip")
	if err = zipTree(editor, editorArchive); err != nil {
		return err
	}
	editorHash, err := fileHash(editorArchive)
	if err != nil {
		return err
	}
	hash, err := fileHash(archive)
	if err != nil {
		return err
	}
	binaryHash, err := fileHash(binary)
	if err != nil {
		return err
	}
	m := Manifest{Version: version, ManagementProtocol: Protocol, MinimumDesktopRevision: minimumDesktopRevision, MFWVersion: mfwVersion, Editor: Artifact{URL: "local:editor", SHA256: editorHash}, Platforms: map[string]Platform{PlatformKey(): {Bundle: Artifact{SHA256: hash}, Binary: Artifact{SHA256: binaryHash}}}}
	return installPartsWith(ctx, dir, m, output, []string{BinaryName(), "editor", "runtime", "mpe-install.json"}, func(_ context.Context, a Artifact, destination string) error {
		source := archive
		if a.URL == "local:editor" {
			source = editorArchive
		}
		current, err := fileHash(source)
		if err != nil {
			return err
		}
		if current != a.SHA256 {
			return fmt.Errorf("本地产物已改变")
		}
		return copyFile(source, destination, 0600)
	})
}
