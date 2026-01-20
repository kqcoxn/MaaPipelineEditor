package updater

import (
	"encoding/json"
	"fmt"
	"net/http"
	"runtime"
	"strings"
	"time"

	goversion "github.com/hashicorp/go-version"
)

const (
	// GitHubAPIURL GitHub API 地址
	GitHubAPIURL = "https://api.github.com/repos/kqcoxn/MaaPipelineEditor/releases/latest"
	// RequestTimeout 请求超时时间
	RequestTimeout = 10 * time.Second
)

// UpdateInfo 更新信息
type UpdateInfo struct {
	HasUpdate      bool   `json:"hasUpdate"`
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	ReleaseNotes   string `json:"releaseNotes"`
	DownloadURL    string `json:"downloadURL"`
	PublishedAt    string `json:"publishedAt"`
}

// GitHubRelease GitHub Release 响应结构
type GitHubRelease struct {
	TagName     string `json:"tag_name"`
	Name        string `json:"name"`
	Body        string `json:"body"`
	PublishedAt string `json:"published_at"`
	Assets      []struct {
		Name               string `json:"name"`
		BrowserDownloadURL string `json:"browser_download_url"`
	} `json:"assets"`
}

// CheckUpdate 检查更新
func CheckUpdate(currentVersion string) (*UpdateInfo, error) {
	client := &http.Client{
		Timeout: RequestTimeout,
	}

	req, err := http.NewRequest("GET", GitHubAPIURL, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %v", err)
	}

	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "MaaPipelineEditor-Extremer")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求失败: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API 返回错误: %d", resp.StatusCode)
	}

	var release GitHubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return nil, fmt.Errorf("解析响应失败: %v", err)
	}

	// 解析版本号
	latestVersionStr := strings.TrimPrefix(release.TagName, "v")
	currentVersionStr := strings.TrimPrefix(currentVersion, "v")

	latestVer, err := goversion.NewVersion(latestVersionStr)
	if err != nil {
		return nil, fmt.Errorf("解析最新版本失败: %v", err)
	}

	currentVer, err := goversion.NewVersion(currentVersionStr)
	if err != nil {
		return nil, fmt.Errorf("解析当前版本失败: %v", err)
	}

	hasUpdate := latestVer.GreaterThan(currentVer)

	// 查找对应平台的下载链接
	downloadURL := findDownloadURL(release.Assets)

	return &UpdateInfo{
		HasUpdate:      hasUpdate,
		CurrentVersion: currentVersion,
		LatestVersion:  release.TagName,
		ReleaseNotes:   release.Body,
		DownloadURL:    downloadURL,
		PublishedAt:    release.PublishedAt,
	}, nil
}

// findDownloadURL 根据当前平台查找下载链接
func findDownloadURL(assets []struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
}) string {
	// 确定平台标识
	var platformPattern string
	switch runtime.GOOS {
	case "windows":
		platformPattern = "windows-amd64"
	case "darwin":
		if runtime.GOARCH == "arm64" {
			platformPattern = "darwin-arm64"
		} else {
			platformPattern = "darwin-amd64"
		}
	case "linux":
		platformPattern = "linux-amd64"
	default:
		return ""
	}

	// 查找 Extremer 包
	for _, asset := range assets {
		name := strings.ToLower(asset.Name)
		if strings.Contains(name, "extremer") && strings.Contains(name, platformPattern) {
			return asset.BrowserDownloadURL
		}
	}

	// 如果没有找到 Extremer 包，返回 Release 页面
	return "https://github.com/kqcoxn/MaaPipelineEditor/releases/latest"
}

// GetPlatformName 获取当前平台名称
func GetPlatformName() string {
	switch runtime.GOOS {
	case "windows":
		return "Windows"
	case "darwin":
		if runtime.GOARCH == "arm64" {
			return "macOS (Apple Silicon)"
		}
		return "macOS (Intel)"
	case "linux":
		return "Linux"
	default:
		return runtime.GOOS
	}
}
