package deps

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"golang.org/x/sys/windows/registry"
)

const (
	GitHubOwner = "kqcoxn"
	GitHubRepo  = "MaaPipelineEditor"
	ModuleName  = "DepsDownloader"
)

// 默认 deps 目录结构
const (
	DefaultDepsDir    = "./deps"
	MaafwSubDir       = "maafw"
	OcrModelResSubDir = "ocr_model_res"
)

// GitHub Release 信息
type GitHubRelease struct {
	TagName    string         `json:"tag_name"`
	Prerelease bool           `json:"prerelease"`
	Draft      bool           `json:"draft"`
	Assets     []ReleaseAsset `json:"assets"`
}

// Release Asset 信息
type ReleaseAsset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
	Size               int64  `json:"size"`
}

// 依赖下载器
type Downloader struct {
	httpClient *http.Client
	depsDir    string
}

// 创建下载器实例
func NewDownloader(depsDir string, proxyURL string) (*Downloader, error) {
	client := &http.Client{
		Timeout: 10 * time.Minute,
	}

	// 配置代理
	if proxyURL != "" {
		// 使用指定的代理地址
		proxyURLParsed, err := url.Parse(proxyURL)
		if err != nil {
			return nil, fmt.Errorf("解析代理地址失败: %w", err)
		}
		client.Transport = &http.Transport{
			Proxy: http.ProxyURL(proxyURLParsed),
		}
		logger.Info(ModuleName, "使用指定代理: %s", proxyURL)
	} else {
		// 优先使用环境变量代理，如果没有则尝试读取系统代理
		client.Transport = &http.Transport{
			Proxy: func(req *http.Request) (*url.URL, error) {
				// 先尝试环境变量
				proxyURL, err := http.ProxyFromEnvironment(req)
				if err == nil && proxyURL != nil {
					return proxyURL, nil
				}
				// Windows 下尝试读取系统代理
				if runtime.GOOS == "windows" {
					if systemProxy := getWindowsSystemProxy(); systemProxy != "" {
						logger.Info(ModuleName, "使用 Windows 系统代理: %s", systemProxy)
						return url.Parse(systemProxy)
					}
				}
				return nil, nil
			},
		}
	}

	// 如果未指定，使用默认目录
	if depsDir == "" {
		depsDir = DefaultDepsDir
	}

	return &Downloader{
		httpClient: client,
		depsDir:    depsDir,
	}, nil
}

// CheckDeps 检查依赖是否存在
// 返回 maafw 和 ocrModel 是否存在
func (d *Downloader) CheckDeps() (maafw, ocrModel bool) {
	maafwDir := filepath.Join(d.depsDir, MaafwSubDir)
	ocrModelDir := filepath.Join(d.depsDir, OcrModelResSubDir)

	// 检查目录是否存在且包含有效内容
	maafw = d.isDepsValid(maafwDir, []string{".dll", ".so", ".dylib"})
	ocrModel = d.isDepsValid(ocrModelDir, []string{})

	return
}

// 检查目录是否存在且包含有效依赖文件
func (d *Downloader) isDepsValid(dir string, requiredExts []string) bool {
	info, err := os.Stat(dir)
	if err != nil || !info.IsDir() {
		return false
	}

	// 检查目录是否为空
	entries, err := os.ReadDir(dir)
	if err != nil || len(entries) == 0 {
		return false
	}

	// 如果没有指定扩展名要求，只检查目录非空
	if len(requiredExts) == 0 {
		return true
	}

	// 检查是否包含所需扩展名的文件
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := strings.ToLower(entry.Name())
		for _, ext := range requiredExts {
			if strings.HasSuffix(name, ext) {
				return true
			}
		}
	}

	return false
}

// EnsureDeps 确保依赖存在，如不存在则下载
func (d *Downloader) EnsureDeps() error {
	maafw, ocrModel := d.CheckDeps()

	if maafw && ocrModel {
		logger.Info(ModuleName, "依赖检查通过")
		return nil
	}

	if !maafw {
		logger.Info(ModuleName, "检测到 MaaFramework 依赖缺失")
	}
	if !ocrModel {
		logger.Info(ModuleName, "检测到 OCR 模型资源缺失")
	}

	fmt.Println()
	fmt.Println("══════════════════════════════════════════════════")
	fmt.Println("📦 依赖下载")
	fmt.Println("══════════════════════════════════════════════════")
	fmt.Println("检测到缺失的依赖文件，正在从 GitHub Release 下载...")
	fmt.Println()

	// 获取最新 Release
	release, err := d.getLatestRelease()
	if err != nil {
		return fmt.Errorf("获取 Release 信息失败: %w", err)
	}

	// 查找 deps 包
	var depsAsset *ReleaseAsset
	for i := range release.Assets {
		name := strings.ToLower(release.Assets[i].Name)
		if strings.Contains(name, "deps") && strings.HasSuffix(name, ".zip") {
			depsAsset = &release.Assets[i]
			break
		}
	}

	if depsAsset == nil {
		return fmt.Errorf("未找到 deps 包\n请访问 https://github.com/%s/%s/releases 手动下载",
			GitHubOwner, GitHubRepo)
	}

	sizeMB := float64(depsAsset.Size) / 1024 / 1024
	logger.Info(ModuleName, "找到依赖包: %s (%.2f MB)", depsAsset.Name, sizeMB)
	fmt.Printf("📥 正在下载: %s (%.2f MB)\n", depsAsset.Name, sizeMB)

	// 下载并解压
	if err := d.downloadAndExtract(depsAsset.BrowserDownloadURL); err != nil {
		return fmt.Errorf("下载依赖失败: %w", err)
	}

	fmt.Println()
	fmt.Println("✅ 依赖下载完成")
	fmt.Println("══════════════════════════════════════════════════")
	fmt.Println()

	return nil
}

// 获取最新 Release
func (d *Downloader) getLatestRelease() (*GitHubRelease, error) {
	// 获取所有 releases
	apiURL := fmt.Sprintf("https://api.github.com/repos/%s/%s/releases", GitHubOwner, GitHubRepo)

	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "LocalBridge-DepsDownloader")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API 返回状态码: %d", resp.StatusCode)
	}

	var releases []GitHubRelease
	if err := json.NewDecoder(resp.Body).Decode(&releases); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w", err)
	}

	// 过滤 prerelease 和 draft
	for _, release := range releases {
		if !release.Prerelease && !release.Draft {
			return &release, nil
		}
	}

	return nil, fmt.Errorf("未找到正式版本")
}

// 下载并解压依赖包
func (d *Downloader) downloadAndExtract(downloadURL string) error {
	// 创建临时文件
	tmpFile, err := os.CreateTemp("", "mpelb-deps-*.zip")
	if err != nil {
		return fmt.Errorf("创建临时文件失败: %w", err)
	}
	tmpPath := tmpFile.Name()
	defer os.Remove(tmpPath)

	// 下载文件
	resp, err := d.httpClient.Get(downloadURL)
	if err != nil {
		tmpFile.Close()
		return fmt.Errorf("下载失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		tmpFile.Close()
		return fmt.Errorf("下载失败，状态码: %d", resp.StatusCode)
	}

	// 显示下载进度
	written, err := io.Copy(tmpFile, &progressReader{
		reader: resp.Body,
		total:  resp.ContentLength,
	})
	tmpFile.Close()

	if err != nil {
		return fmt.Errorf("写入文件失败: %w", err)
	}

	logger.Info(ModuleName, "下载完成: %.2f MB", float64(written)/1024/1024)
	fmt.Println("\n📂 正在解压...")

	// 解压到 deps 目录
	if err := d.unzip(tmpPath, d.depsDir); err != nil {
		return fmt.Errorf("解压失败: %w", err)
	}

	return nil
}

// 解压 zip 文件
func (d *Downloader) unzip(src, dest string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer r.Close()

	// 确保目标目录存在
	if err := os.MkdirAll(dest, 0755); err != nil {
		return err
	}

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

// 进度读取器
type progressReader struct {
	reader     io.Reader
	total      int64
	downloaded int64
	lastPct    int
}

func (pr *progressReader) Read(p []byte) (int, error) {
	n, err := pr.reader.Read(p)
	if n > 0 {
		pr.downloaded += int64(n)
		if pr.total > 0 {
			pct := int(pr.downloaded * 100 / pr.total)
			if pct != pr.lastPct && pct%10 == 0 {
				fmt.Printf("   下载进度: %d%%\n", pct)
				pr.lastPct = pct
			}
		}
	}
	return n, err
}

// GetDepsDir 获取 deps 目录路径
func (d *Downloader) GetDepsDir() string {
	return d.depsDir
}

// GetMaafwDir 获取 maafw 目录路径
func (d *Downloader) GetMaafwDir() string {
	return filepath.Join(d.depsDir, MaafwSubDir)
}

// GetOcrModelDir 获取 ocr_model_res 目录路径
func (d *Downloader) GetOcrModelDir() string {
	return filepath.Join(d.depsDir, OcrModelResSubDir)
}

// getWindowsSystemProxy 从 Windows 注册表读取系统代理设置
func getWindowsSystemProxy() string {
	if runtime.GOOS != "windows" {
		return ""
	}

	// 打开注册表键
	key, err := registry.OpenKey(registry.CURRENT_USER,
		`Software\Microsoft\Windows\CurrentVersion\Internet Settings`,
		registry.QUERY_VALUE)
	if err != nil {
		return ""
	}
	defer key.Close()

	// 检查是否启用代理
	proxyEnable, _, err := key.GetIntegerValue("ProxyEnable")
	if err != nil || proxyEnable == 0 {
		return ""
	}

	// 读取代理服务器地址
	proxyServer, _, err := key.GetStringValue("ProxyServer")
	if err != nil || proxyServer == "" {
		return ""
	}

	// 处理代理地址格式
	// ProxyServer 可能是 "http://proxy:port" 或 "proxy:port"
	if !strings.HasPrefix(proxyServer, "http://") && !strings.HasPrefix(proxyServer, "https://") {
		proxyServer = "http://" + proxyServer
	}

	return proxyServer
}
