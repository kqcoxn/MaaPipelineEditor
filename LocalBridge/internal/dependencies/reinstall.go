// Package dependencies runs the shared installer in dependency-only mode.
package dependencies

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"
)

const repository = "https://raw.githubusercontent.com/kqcoxn/MaaPipelineEditor/"

var versionPattern = regexp.MustCompile(`mfwVersion\s*:\s*"v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)"`)

// Reinstall always downloads the selected dependencies into the executable's runtime directory.
func Reinstall(ctx context.Context, version, target, exeDir string, output, errors io.Writer) error {
	if target != "all" && target != "mfw" && target != "ocr" {
		return fmt.Errorf("未知依赖 %q，可选 all、mfw、ocr", target)
	}
	if !filepath.IsAbs(exeDir) {
		return fmt.Errorf("安装目录必须是绝对路径")
	}
	scriptName := "install.sh"
	if runtime.GOOS == "windows" {
		scriptName = "install.ps1"
	} else if runtime.GOOS != "linux" && runtime.GOOS != "darwin" {
		return fmt.Errorf("不支持当前平台 %s", runtime.GOOS)
	}

	var readSource func(string) ([]byte, error)
	if version == "dev" {
		cwd, err := os.Getwd()
		if err != nil {
			return err
		}
		root, err := findSourceRoot(cwd, exeDir)
		if err != nil {
			return err
		}
		readSource = func(path string) ([]byte, error) { return os.ReadFile(filepath.Join(root, filepath.FromSlash(path))) }
	} else {
		ref := "v" + strings.TrimPrefix(version, "v")
		readSource = func(path string) ([]byte, error) { return fetch(ctx, repository+url.PathEscape(ref)+"/"+path) }
	}
	var requiredVersion string
	if target != "ocr" {
		config, err := readSource("Editor/src/stores/app/configStore.ts")
		if err != nil {
			return fmt.Errorf("读取当前 MPE 的 mfwVersion: %w", err)
		}
		matches := versionPattern.FindSubmatch(config)
		if len(matches) != 2 {
			return fmt.Errorf("当前 MPE 未声明有效 mfwVersion")
		}
		requiredVersion = "v" + string(matches[1])
	}
	script, err := readSource("scripts/install/" + scriptName)
	if err != nil {
		return fmt.Errorf("读取依赖安装脚本: %w", err)
	}
	if !strings.Contains(string(script), "MPELB_REINSTALL_V1") {
		return fmt.Errorf("该版本的安装脚本不支持依赖重装")
	}
	temp, err := os.MkdirTemp("", "mpelb-reinstall-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(temp)
	scriptPath := filepath.Join(temp, scriptName)
	// Windows PowerShell 5.1 requires a BOM to read UTF-8 scripts reliably.
	if runtime.GOOS == "windows" {
		script = append([]byte{0xef, 0xbb, 0xbf}, script...)
	}
	if err := os.WriteFile(scriptPath, script, 0600); err != nil {
		return err
	}
	var command *exec.Cmd
	if runtime.GOOS == "windows" {
		command = exec.CommandContext(ctx, "powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath)
	} else {
		command = exec.CommandContext(ctx, "bash", scriptPath)
	}
	command.Env = reinstallEnv(os.Environ(), target, exeDir, requiredVersion)
	command.Stdout, command.Stderr = output, errors
	fmt.Fprintf(output, "强制重装 %s，目录: %s\n", target, filepath.Join(exeDir, "runtime"))
	if requiredVersion != "" {
		fmt.Fprintf(output, "MaaFramework 指定版本: %s\n", requiredVersion)
	}
	if err := command.Run(); err != nil {
		return fmt.Errorf("依赖重装失败（如文件被占用，请停止其他 LocalBridge 进程后重试）: %w", err)
	}
	fmt.Fprintln(output, "自带依赖重装完成。")
	return nil
}

func reinstallEnv(base []string, target, dir, version string) []string {
	result := make([]string, 0, len(base)+3)
	for _, entry := range base {
		key, _, _ := strings.Cut(entry, "=")
		if strings.HasPrefix(strings.ToUpper(key), "MPELB_REINSTALL") || strings.EqualFold(key, "MPELB_MFW_VERSION") {
			continue
		}
		result = append(result, entry)
	}
	return append(result, "MPELB_REINSTALL="+target, "MPELB_REINSTALL_DIR="+dir, "MPELB_MFW_VERSION="+version)
}

func findSourceRoot(starts ...string) (string, error) {
	for _, start := range starts {
		for dir := start; ; dir = filepath.Dir(dir) {
			if _, err := os.Stat(filepath.Join(dir, "Editor", "src", "stores", "app", "configStore.ts")); err == nil {
				if _, err := os.Stat(filepath.Join(dir, "scripts", "install", "install.ps1")); err == nil {
					return dir, nil
				}
			}
			if filepath.Dir(dir) == dir {
				break
			}
		}
	}
	return "", fmt.Errorf("开发版请在 MPE 源码仓库中运行此命令，以读取本地 mfwVersion 和安装脚本")
}

func fetch(ctx context.Context, address string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, address, nil)
	if err != nil {
		return nil, err
	}
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, address)
	}
	return io.ReadAll(io.LimitReader(resp.Body, 2<<20))
}
