// Package install is the shared CLI/Desktop installation engine.
package install

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/updatehttp"
)

const Repository = "https://github.com/kqcoxn/MaaPipelineEditor/releases"
const Protocol = 1

type Artifact struct {
	URL    string `json:"url"`
	SHA256 string `json:"sha256"`
}
type Platform struct {
	Bundle Artifact `json:"bundle"`
	Binary Artifact `json:"binary"`
}
type Manifest struct {
	Editor                 Artifact            `json:"editor"`
	Version                string              `json:"version"`
	ManagementProtocol     int                 `json:"managementProtocol"`
	MinimumDesktopRevision uint32              `json:"minimumDesktopRevision"`
	MFWVersion             string              `json:"mfwVersion"`
	Platforms              map[string]Platform `json:"platforms"`
}
type Environment struct {
	MinimumDesktopRevision uint32   `json:"minimumDesktopRevision"`
	Version                string   `json:"version"`
	Directory              string   `json:"directory"`
	Binary                 string   `json:"binary"`
	Editor                 string   `json:"editor"`
	Ready                  bool     `json:"ready"`
	Problems               []string `json:"problems"`
}

func PlatformKey() string { return runtime.GOOS + "-" + runtime.GOARCH }
func BinaryName() string {
	if runtime.GOOS == "windows" {
		return "mpelb.exe"
	}
	return "mpelb"
}
func DefaultDirectory() string {
	if runtime.GOOS == "windows" {
		return filepath.Join(os.Getenv("LOCALAPPDATA"), "mpelb")
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".local", "bin")
}
func FetchManifest(ctx context.Context, version string) (Manifest, error) {
	address := Repository + "/latest/download/mpe-manifest.json"
	if version != "" && version != "latest" {
		for _, c := range version {
			if !(c >= '0' && c <= '9' || c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || strings.ContainsRune(".-", c)) {
				return Manifest{}, fmt.Errorf("无效版本号")
			}
		}
		address = Repository + "/download/v" + strings.TrimPrefix(version, "v") + "/mpe-manifest.json"
	}
	req, err := http.NewRequestWithContext(ctx, "GET", address, nil)
	if err != nil {
		return Manifest{}, err
	}
	client := updatehttp.NewClient(30 * time.Second)
	defer client.CloseIdleConnections()
	resp, err := client.Do(req)
	if err != nil {
		return Manifest{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return Manifest{}, fmt.Errorf("发布清单不可用: HTTP %d", resp.StatusCode)
	}
	var m Manifest
	err = json.NewDecoder(http.MaxBytesReader(nil, resp.Body, 2<<20)).Decode(&m)
	if err == nil && (m.Version == "" || m.ManagementProtocol != Protocol || m.MinimumDesktopRevision == 0) {
		err = fmt.Errorf("不支持的安装管理协议")
	}
	if err == nil && version != "" && version != "latest" && m.Version != strings.TrimPrefix(version, "v") {
		err = fmt.Errorf("清单版本与所选版本不符")
	}
	return m, err
}
func Inspect(dir string, withEditor bool) Environment {
	return inspect(dir, false, withEditor)
}

func inspect(dir string, duringTransaction, withEditor bool) Environment {
	e := Environment{Directory: dir, Binary: filepath.Join(dir, BinaryName()), Editor: filepath.Join(dir, "editor"), Problems: []string{}}
	data, err := os.ReadFile(filepath.Join(dir, "mpe-install.json"))
	var m Manifest
	if err != nil || json.Unmarshal(data, &m) != nil {
		e.Problems = append(e.Problems, "缺少完整安装记录")
	} else {
		e.Version = m.Version
		e.MinimumDesktopRevision = m.MinimumDesktopRevision
	}
	if platform, ok := m.Platforms[PlatformKey()]; ok {
		if actual, err := fileHash(filepath.Join(dir, BinaryName())); err != nil || actual != platform.Binary.SHA256 {
			e.Problems = append(e.Problems, "mpelb 与安装记录校验不一致")
		}
	} else {
		e.Problems = append(e.Problems, "安装记录缺少当前平台")
	}
	if m.ManagementProtocol != Protocol || m.Version == "" {
		e.Problems = append(e.Problems, "安装记录的版本或管理协议无效")
	}
	library := "libMaaFramework.so"
	if runtime.GOOS == "windows" {
		library = "MaaFramework.dll"
	} else if runtime.GOOS == "darwin" {
		library = "libMaaFramework.dylib"
	}
	if _, err := os.Stat(filepath.Join(dir, "runtime/maafw/bin", library)); err != nil {
		e.Problems = append(e.Problems, "缺少 MaaFramework 动态库")
	}
	paths := []string{BinaryName(), "runtime/maafw/bin", "runtime/maafw/share/MaaAgentBinary", "runtime/resource/model/ocr"}
	if withEditor {
		paths = append(paths, "editor/index.html")
	}
	for _, name := range paths {
		info, err := os.Stat(filepath.Join(dir, filepath.FromSlash(name)))
		if err != nil {
			e.Problems = append(e.Problems, "缺少 "+name)
			continue
		}
		if info.IsDir() {
			entries, _ := os.ReadDir(filepath.Join(dir, filepath.FromSlash(name)))
			if len(entries) == 0 {
				e.Problems = append(e.Problems, "空目录 "+name)
			}
		}
	}
	if withEditor {
		if err := validateEditor(filepath.Join(dir, "editor"), m.Version); err != nil {
			e.Problems = append(e.Problems, err.Error())
		}
	}
	runtimeVersion, runtimeErr := os.ReadFile(filepath.Join(dir, "runtime/maafw/.version"))
	if runtimeErr != nil || strings.TrimPrefix(strings.TrimSpace(string(runtimeVersion)), "v") != m.MFWVersion {
		e.Problems = append(e.Problems, "MaaFramework 版本不匹配")
	}
	for _, name := range []string{"runtime/resource/model/ocr/det.onnx", "runtime/resource/model/ocr/rec.onnx", "runtime/resource/model/ocr/keys.txt"} {
		if info, err := os.Stat(filepath.Join(dir, name)); err != nil || info.Size() == 0 {
			e.Problems = append(e.Problems, "缺少 OCR 资源 "+name)
		}
	}
	if _, err := os.Stat(filepath.Join(dir, ".mpe-transaction")); err == nil && !duringTransaction {
		e.Problems = append(e.Problems, "存在未完成安装，需要恢复")
	}
	e.Ready = len(e.Problems) == 0
	return e
}

func validateEditor(dir, version string) error {
	info, err := os.Stat(filepath.Join(dir, "index.html"))
	if err != nil || info.IsDir() || info.Size() == 0 {
		return fmt.Errorf("缺少 Editor 页面资源")
	}
	data, err := os.ReadFile(filepath.Join(dir, "mpe-build.json"))
	var build struct {
		Version string `json:"version"`
	}
	if err != nil || json.Unmarshal(data, &build) != nil || build.Version != version {
		return fmt.Errorf("Editor 与安装记录版本不一致")
	}
	return nil
}
