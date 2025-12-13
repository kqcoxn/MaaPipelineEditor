package updater

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
)

// 当前版本号
var Version = "dev"

// GitHub 仓库信息
const (
	GitHubOwner = "kqcoxn"
	GitHubRepo  = "MaaPipelineEditor"
	ModuleName  = "Updater"
)

// GitHub Release 信息
type GitHubRelease struct {
	TagName     string         `json:"tag_name"`
	Name        string         `json:"name"`
	Body        string         `json:"body"`
	Prerelease  bool           `json:"prerelease"`
	Draft       bool           `json:"draft"`
	PublishedAt time.Time      `json:"published_at"`
	Assets      []ReleaseAsset `json:"assets"`
}

// Release Asset 信息
type ReleaseAsset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
	Size               int64  `json:"size"`
}

// 更新信息
type UpdateInfo struct {
	HasUpdate      bool
	CurrentVersion string
	LatestVersion  string
	ReleaseNotes   string
	DownloadURL    string
	AssetName      string
}

// 自动更新器
type Updater struct {
	httpClient *http.Client
}

// 创建更新器实例
func New() *Updater {
	return &Updater{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// 创建带代理的更新器实例
func NewWithProxy(proxyURL string) (*Updater, error) {
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	// 配置代理
	if proxyURL != "" {
		proxyURLParsed, err := url.Parse(proxyURL)
		if err != nil {
			return nil, fmt.Errorf("解析代理地址失败: %w", err)
		}
		client.Transport = &http.Transport{
			Proxy: http.ProxyURL(proxyURLParsed),
		}
		logger.Info(ModuleName, "使用代理: %s", proxyURL)
	} else {
		// 使用系统代理设置
		client.Transport = &http.Transport{
			Proxy: http.ProxyFromEnvironment,
		}
	}

	return &Updater{
		httpClient: client,
	}, nil
}

// 检查是否有新版本
func (u *Updater) CheckForUpdate() (*UpdateInfo, error) {
	logger.Info(ModuleName, "正在检查更新... 当前版本: %s", Version)

	// 获取最新 Release
	release, err := u.getLatestRelease()
	if err != nil {
		return nil, fmt.Errorf("获取最新版本失败: %w", err)
	}

	latestVersion := strings.TrimPrefix(release.TagName, "v")
	currentVersion := strings.TrimPrefix(Version, "v")

	info := &UpdateInfo{
		CurrentVersion: currentVersion,
		LatestVersion:  latestVersion,
		ReleaseNotes:   release.Body,
	}

	// 对比版本号
	if !u.isNewerVersion(currentVersion, latestVersion) {
		logger.Info(ModuleName, "当前已是最新版本")
		return info, nil
	}

	// 查找适合当前平台的资源
	assetName := u.getAssetName()
	for _, asset := range release.Assets {
		if strings.Contains(strings.ToLower(asset.Name), strings.ToLower(assetName)) {
			info.HasUpdate = true
			info.DownloadURL = asset.BrowserDownloadURL
			info.AssetName = asset.Name
			break
		}
	}

	if info.HasUpdate {
		logger.Info(ModuleName, "发现新版本: %s -> %s", currentVersion, latestVersion)
	} else {
		logger.Warn(ModuleName, "发现新版本 %s，但未找到适合当前平台的安装包", latestVersion)
	}

	return info, nil
}

// 获取最新 Release
func (u *Updater) getLatestRelease() (*GitHubRelease, error) {
	// 获取所有 releases
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/releases", GitHubOwner, GitHubRepo)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "LocalBridge-Updater")

	resp, err := u.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API 返回状态码: %d", resp.StatusCode)
	}

	var releases []GitHubRelease
	if err := json.NewDecoder(resp.Body).Decode(&releases); err != nil {
		return nil, err
	}

	// 过滤 prerelease 和 draft
	for _, release := range releases {
		if !release.Prerelease && !release.Draft {
			return &release, nil
		}
	}

	return nil, fmt.Errorf("未找到正式版本")
}

// 根据当前系统获取资源名称
func (u *Updater) getAssetName() string {
	goos := runtime.GOOS
	arch := runtime.GOARCH

	// 与 workflow 中的命名保持一致: mpelb-{os}-{arch}
	switch goos {
	case "windows":
		if arch == "amd64" {
			return "mpelb-windows-amd64"
		} else if arch == "arm64" {
			return "mpelb-windows-arm64"
		}
		return "mpelb-windows"
	case "darwin":
		if arch == "arm64" {
			return "mpelb-darwin-arm64"
		}
		return "mpelb-darwin-amd64"
	case "linux":
		if arch == "arm64" {
			return "mpelb-linux-arm64"
		}
		return "mpelb-linux-amd64"
	default:
		return fmt.Sprintf("mpelb-%s-%s", goos, arch)
	}
}

// 比较版本号
func (u *Updater) isNewerVersion(current, latest string) bool {
	// 开发版本始终认为需要更新
	if current == "dev" || current == "" {
		return true
	}

	// 版本比较
	currentParts := strings.Split(current, ".")
	latestParts := strings.Split(latest, ".")

	maxLen := len(currentParts)
	if len(latestParts) > maxLen {
		maxLen = len(latestParts)
	}

	for i := 0; i < maxLen; i++ {
		var cv, lv int
		if i < len(currentParts) {
			fmt.Sscanf(currentParts[i], "%d", &cv)
		}
		if i < len(latestParts) {
			fmt.Sscanf(latestParts[i], "%d", &lv)
		}

		if lv > cv {
			return true
		} else if lv < cv {
			return false
		}
	}

	return false
}

// 执行更新
func (u *Updater) PerformUpdate(info *UpdateInfo) error {
	if !info.HasUpdate || info.DownloadURL == "" {
		return fmt.Errorf("没有可用的更新")
	}

	logger.Info(ModuleName, "开始下载更新: %s", info.AssetName)

	// 创建临时目录
	tempDir, err := os.MkdirTemp("", "localbridge-update-*")
	if err != nil {
		return fmt.Errorf("创建临时目录失败: %w", err)
	}
	defer os.RemoveAll(tempDir)

	// 下载文件
	downloadPath := filepath.Join(tempDir, info.AssetName)
	if err := u.downloadFile(info.DownloadURL, downloadPath); err != nil {
		return fmt.Errorf("下载更新失败: %w", err)
	}

	logger.Info(ModuleName, "下载完成，正在安装更新...")

	// 根据平台执行更新
	if runtime.GOOS == "windows" {
		return u.updateWindows(downloadPath, tempDir)
	}
	return u.updateUnix(downloadPath, tempDir)
}

// 下载文件
func (u *Updater) downloadFile(url, destPath string) error {
	resp, err := u.httpClient.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("下载失败，状态码: %d", resp.StatusCode)
	}

	out, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, resp.Body)
	return err
}

// Windows 平台更新
func (u *Updater) updateWindows(downloadPath, tempDir string) error {
	// 获取当前可执行文件路径
	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("获取可执行文件路径失败: %w", err)
	}
	exePath, _ = filepath.Abs(exePath)

	var newExePath string

	// 如果是 zip 文件，解压
	if strings.HasSuffix(strings.ToLower(downloadPath), ".zip") {
		extractDir := filepath.Join(tempDir, "extracted")
		if err := u.unzip(downloadPath, extractDir); err != nil {
			return fmt.Errorf("解压失败: %w", err)
		}
		// 查找解压后的可执行文件
		newExePath = u.findExecutable(extractDir)
		if newExePath == "" {
			return fmt.Errorf("未找到可执行文件")
		}
	} else {
		newExePath = downloadPath
	}

	// 创建更新批处理脚本
	batPath := filepath.Join(tempDir, "update.bat")
	batContent := fmt.Sprintf(`@echo off
timeout /t 2 /nobreak > nul
copy /Y "%s" "%s"
start "" "%s"
del "%%~f0"
`, newExePath, exePath, exePath)

	if err := os.WriteFile(batPath, []byte(batContent), 0755); err != nil {
		return fmt.Errorf("创建更新脚本失败: %w", err)
	}

	// 执行批处理并退出当前程序
	cmd := exec.Command("cmd", "/C", batPath)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("启动更新脚本失败: %w", err)
	}

	logger.Info(ModuleName, "更新脚本已启动，程序将重启...")
	os.Exit(0)
	return nil
}

// Unix 平台更新 (Linux/macOS)
func (u *Updater) updateUnix(downloadPath, tempDir string) error {
	// 获取当前可执行文件路径
	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("获取可执行文件路径失败: %w", err)
	}
	exePath, _ = filepath.Abs(exePath)

	var newExePath string

	// 如果是压缩包，解压
	if strings.HasSuffix(strings.ToLower(downloadPath), ".zip") {
		extractDir := filepath.Join(tempDir, "extracted")
		if err := u.unzip(downloadPath, extractDir); err != nil {
			return fmt.Errorf("解压失败: %w", err)
		}
		newExePath = u.findExecutable(extractDir)
		if newExePath == "" {
			return fmt.Errorf("未找到可执行文件")
		}
	} else {
		newExePath = downloadPath
	}

	// 创建更新 shell 脚本
	shPath := filepath.Join(tempDir, "update.sh")
	shContent := fmt.Sprintf(`#!/bin/bash
sleep 2
cp -f "%s" "%s"
chmod +x "%s"
"%s" &
rm -f "$0"
`, newExePath, exePath, exePath, exePath)

	if err := os.WriteFile(shPath, []byte(shContent), 0755); err != nil {
		return fmt.Errorf("创建更新脚本失败: %w", err)
	}

	// 执行脚本并退出
	cmd := exec.Command("bash", shPath)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("启动更新脚本失败: %w", err)
	}

	logger.Info(ModuleName, "更新脚本已启动，程序将重启...")
	os.Exit(0)
	return nil
}

// 解压 zip 文件
func (u *Updater) unzip(src, dest string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer r.Close()

	os.MkdirAll(dest, 0755)

	for _, f := range r.File {
		fpath := filepath.Join(dest, f.Name)

		// 安全检查：防止 zip slip 漏洞
		if !strings.HasPrefix(filepath.Clean(fpath), filepath.Clean(dest)+string(os.PathSeparator)) {
			return fmt.Errorf("非法文件路径: %s", fpath)
		}

		if f.FileInfo().IsDir() {
			os.MkdirAll(fpath, 0755)
			continue
		}

		if err := os.MkdirAll(filepath.Dir(fpath), 0755); err != nil {
			return err
		}

		outFile, err := os.OpenFile(fpath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			return err
		}

		rc, err := f.Open()
		if err != nil {
			outFile.Close()
			return err
		}

		_, err = io.Copy(outFile, rc)
		outFile.Close()
		rc.Close()

		if err != nil {
			return err
		}
	}

	return nil
}

// 查找可执行文件
func (u *Updater) findExecutable(dir string) string {
	var exePath string
	filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}

		name := strings.ToLower(info.Name())
		// 查找 mpelb 可执行文件
		if strings.Contains(name, "mpelb") {
			if runtime.GOOS == "windows" {
				if strings.HasSuffix(name, ".exe") {
					exePath = path
					return filepath.SkipAll
				}
			} else {
				if info.Mode()&0111 != 0 || !strings.Contains(name, ".") {
					exePath = path
					return filepath.SkipAll
				}
			}
		}
		return nil
	})
	return exePath
}

// 检查并执行更新
func CheckAndUpdate(autoUpdate bool, proxyURL string) {
	var updater *Updater
	var err error

	// 根据是否有代理配置创建更新器
	if proxyURL != "" {
		updater, err = NewWithProxy(proxyURL)
		if err != nil {
			logger.Warn(ModuleName, "创建代理配置失败，使用默认配置: %v", err)
			updater = New()
		}
	} else {
		// 使用系统代理
		updater, err = NewWithProxy("")
		if err != nil {
			updater = New()
		}
	}

	info, err := updater.CheckForUpdate()
	if err != nil {
		logger.Warn(ModuleName, "检查更新失败（将继续正常运行）: %v", err)
		return
	}

	if !info.HasUpdate {
		return
	}

	if autoUpdate {
		logger.Info(ModuleName, "发现新版本 %s，正在自动更新...", info.LatestVersion)
		if err := updater.PerformUpdate(info); err != nil {
			logger.Warn(ModuleName, "自动更新失败（将继续正常运行）: %v", err)
		}
	} else {
		logger.Info(ModuleName, "发现新版本 %s，可使用 --update 参数启动以执行更新", info.LatestVersion)
	}
}

// 获取当前版本号
func GetVersion() string {
	return Version
}
