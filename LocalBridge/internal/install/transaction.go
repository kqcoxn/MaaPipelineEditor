package install

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/managed"
	"io"
	"os"
	"path/filepath"
	"slices"
)

type journalItem struct {
	Name        string `json:"name"`
	HadOriginal bool   `json:"hadOriginal"`
}
type journal struct {
	Items     []journalItem `json:"items"`
	Committed bool          `json:"committed"`
}

func exists(path string) bool { _, err := os.Lstat(path); return err == nil }
func writeJSON(path string, v any) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	_, err = f.Write(data)
	if err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err != nil {
		return err
	}
	return closeErr
}

// recoverLocked is idempotent, including interruption while restoring a backup.
func recoverLocked(dir string) error {
	txn := filepath.Join(dir, ".mpe-transaction")
	if !exists(txn) {
		return nil
	}
	data, err := os.ReadFile(filepath.Join(txn, "journal.json"))
	if os.IsNotExist(err) {
		return os.RemoveAll(txn)
	}
	if err != nil {
		return err
	}
	var j journal
	if err = json.Unmarshal(data, &j); err != nil {
		return fmt.Errorf("安装日志损坏，保留恢复文件: %w", err)
	}
	if !j.Committed && !exists(filepath.Join(txn, "commit")) {
		for _, item := range j.Items {
			switch item.Name {
			case BinaryName(), "editor", "runtime", "mpe-install.json", "runtime/maafw", "runtime/resource/model/ocr":
			default:
				return fmt.Errorf("无效的恢复路径")
			}
			target := filepath.Join(dir, item.Name)
			backup := filepath.Join(txn, "backup", item.Name)
			stage := filepath.Join(txn, "stage", item.Name)
			if exists(backup) {
				if err = os.RemoveAll(target); err != nil {
					return err
				}
				if err = os.Rename(backup, target); err != nil {
					return err
				}
			} else if !item.HadOriginal && !exists(stage) {
				if err = os.RemoveAll(target); err != nil {
					return err
				}
			}
		}
	}
	return os.RemoveAll(txn)
}
func Recover(dir string) error {
	lock, err := managed.InstallationLock(dir, false)
	if err != nil {
		return err
	}
	defer lock.Close()
	return recoverLocked(dir)
}
func Install(ctx context.Context, dir string, m Manifest, withEditor bool, output io.Writer) error {
	parts := []string{BinaryName(), "runtime", "mpe-install.json"}
	if withEditor {
		parts = append(parts, "editor")
	}
	return installParts(ctx, dir, m, output, parts)
}
func Repair(ctx context.Context, dir string, m Manifest, target string, output io.Writer) error {
	var parts []string
	switch target {
	case "all":
		parts = []string{"runtime"}
	case "mfw":
		parts = []string{"runtime/maafw"}
	case "ocr":
		parts = []string{"runtime/resource/model/ocr"}
	default:
		return fmt.Errorf("未知依赖 %q", target)
	}
	return installParts(ctx, dir, m, output, parts)
}
func installParts(ctx context.Context, dir string, m Manifest, output io.Writer, parts []string) error {
	return installPartsWith(ctx, dir, m, output, parts, download)
}
func installPartsWith(ctx context.Context, dir string, m Manifest, output io.Writer, parts []string, fetch func(context.Context, Artifact, string) error) (err error) {
	if !filepath.IsAbs(dir) {
		return fmt.Errorf("安装路径必须是绝对路径")
	}
	platform, ok := m.Platforms[PlatformKey()]
	if !ok {
		return fmt.Errorf("此版本不支持 %s", PlatformKey())
	}
	lock, err := managed.InstallationLock(dir, false)
	if err != nil {
		return err
	}
	defer lock.Close()
	if err = recoverLocked(dir); err != nil {
		return err
	}
	// Once installed, keep the desktop pair synchronized even on CLI updates.
	// Check under the installation lock, after recovering any interrupted change.
	if slices.Contains(parts, "mpe-install.json") && exists(filepath.Join(dir, "editor")) && !slices.Contains(parts, "editor") {
		parts = append(parts, "editor")
	}
	withEditor := slices.Contains(parts, "editor")
	emit := func(phase string) {
		_ = json.NewEncoder(output).Encode(map[string]string{"phase": phase, "version": m.Version})
	}
	txn := filepath.Join(dir, ".mpe-transaction")
	stage := filepath.Join(txn, "stage")
	if err = os.MkdirAll(stage, 0700); err != nil {
		return err
	}
	defer func() {
		if err != nil {
			if recovery := recoverLocked(dir); recovery != nil {
				err = fmt.Errorf("%w；恢复失败: %v", err, recovery)
			}
		}
	}()
	emit("downloading")
	archive := filepath.Join(txn, "bundle.zip")
	if err = fetch(ctx, platform.Bundle, archive); err != nil {
		return err
	}
	emit("verifying")
	if err = extract(archive, stage); err != nil {
		return err
	}
	if exists(filepath.Join(stage, "editor")) {
		return fmt.Errorf("基础环境包不应包含 Editor")
	}
	if withEditor {
		editorArchive := filepath.Join(txn, "editor.zip")
		if err = fetch(ctx, m.Editor, editorArchive); err != nil {
			return err
		}
		if err = extract(editorArchive, filepath.Join(stage, "editor")); err != nil {
			return err
		}
	}
	if err = writeJSON(filepath.Join(stage, "mpe-install.json"), m); err != nil {
		return err
	}
	environment := Inspect(stage, withEditor)
	if !environment.Ready {
		return fmt.Errorf("产物不完整: %v", environment.Problems)
	}
	if err = os.Chmod(filepath.Join(stage, BinaryName()), 0755); err != nil {
		return err
	}
	if err = os.MkdirAll(filepath.Join(txn, "backup"), 0700); err != nil {
		return err
	}
	j := journal{}
	for _, name := range parts {
		j.Items = append(j.Items, journalItem{name, exists(filepath.Join(dir, name))})
	}
	if err = writeJSON(filepath.Join(txn, "journal.next"), j); err != nil {
		return err
	}
	if err = os.Rename(filepath.Join(txn, "journal.next"), filepath.Join(txn, "journal.json")); err != nil {
		return err
	}
	binaryHash, hashErr := fileHash(filepath.Join(stage, BinaryName()))
	if hashErr != nil || binaryHash != platform.Binary.SHA256 {
		return fmt.Errorf("mpelb 与发布清单不一致")
	}
	emit("installing")
	for _, item := range j.Items {
		if err = os.MkdirAll(filepath.Dir(filepath.Join(txn, "backup", item.Name)), 0700); err != nil {
			return err
		}
		if err = os.MkdirAll(filepath.Dir(filepath.Join(dir, item.Name)), 0755); err != nil {
			return err
		}
		if err = ctx.Err(); err != nil {
			return err
		}
		if item.HadOriginal {
			if err = os.Rename(filepath.Join(dir, item.Name), filepath.Join(txn, "backup", item.Name)); err != nil {
				return err
			}
		}
		if err = os.Rename(filepath.Join(stage, item.Name), filepath.Join(dir, item.Name)); err != nil {
			return err
		}
	}
	emit("validating")
	if installed := inspect(dir, true, withEditor); !installed.Ready {
		return fmt.Errorf("替换后验证失败: %v", installed.Problems)
	}
	// Commit by atomic rename, never truncate the rollback journal.
	j.Committed = true
	if err = writeJSON(filepath.Join(txn, "committed.json"), j); err != nil {
		return err
	}
	// A separate durable marker avoids platform-specific rename-over-existing semantics.
	if err = os.Rename(filepath.Join(txn, "committed.json"), filepath.Join(txn, "commit")); err != nil {
		return err
	}
	emit("complete")
	return os.RemoveAll(txn)
}
