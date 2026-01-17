package updater

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/kqcoxn/MaaPipelineExtremer/internal/config"
	"github.com/kqcoxn/MaaPipelineExtremer/internal/logger"
)

// Manifest 更新清单结构体
type Manifest struct {
	Version       string               `json:"version"`
	Components    map[string]Component `json:"components"`
	UpdateChannel string               `json:"updateChannel"`
}

// Component 组件信息
type Component struct {
	Version   string `json:"version"`
	URL       string `json:"url"`
	SHA256    string `json:"sha256"`
	Changelog string `json:"changelog,omitempty"`
}

// UpdateInfo 更新信息
type UpdateInfo struct {
	ComponentName  string `json:"componentName"`
	CurrentVersion string `json:"currentVersion"`
	NewVersion     string `json:"newVersion"`
	Changelog      string `json:"changelog"`
	URL            string `json:"url"`
}

// Updater 更新管理器
type Updater struct {
	cfg    *config.Config
	log    *logger.Logger
	client *http.Client
}

// NewUpdater 创建更新管理器
func NewUpdater(cfg *config.Config, log *logger.Logger) *Updater {
	return &Updater{
		cfg: cfg,
		log: log,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// CheckForUpdates 检查更新
func (u *Updater) CheckForUpdates() ([]UpdateInfo, error) {
	if !u.cfg.Update.Enabled {
		return nil, nil
	}

	u.log.Info("正在检查更新...")

	// 获取远端清单
	manifest, err := u.fetchManifest()
	if err != nil {
		return nil, fmt.Errorf("获取更新清单失败: %v", err)
	}

	// 比较版本
	updates := u.compareVersions(manifest)

	if len(updates) > 0 {
		u.log.Infof("发现 %d 个可用更新", len(updates))
	} else {
		u.log.Info("当前已是最新版本")
	}

	return updates, nil
}

// fetchManifest 获取远端更新清单
func (u *Updater) fetchManifest() (*Manifest, error) {
	resp, err := u.client.Get(u.cfg.Update.ManifestURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP 状态码: %d", resp.StatusCode)
	}

	var manifest Manifest
	if err := json.NewDecoder(resp.Body).Decode(&manifest); err != nil {
		return nil, err
	}

	return &manifest, nil
}

// compareVersions 比较版本号
func (u *Updater) compareVersions(manifest *Manifest) []UpdateInfo {
	var updates []UpdateInfo

	// 比较各组件版本
	componentVersions := map[string]string{
		"frontend":    u.cfg.Components.Frontend,
		"localbridge": u.cfg.Components.LocalBridge,
		"mfw":         u.cfg.Components.Mfw,
		"ocr":         u.cfg.Components.Ocr,
	}

	for name, currentVer := range componentVersions {
		if comp, ok := manifest.Components[name]; ok {
			if comp.Version != currentVer {
				updates = append(updates, UpdateInfo{
					ComponentName:  name,
					CurrentVersion: currentVer,
					NewVersion:     comp.Version,
					Changelog:      comp.Changelog,
					URL:            comp.URL,
				})
			}
		}
	}

	return updates
}

// DownloadUpdate 下载更新包
func (u *Updater) DownloadUpdate(info UpdateInfo, destDir string) (string, error) {
	u.log.Infof("正在下载更新: %s %s -> %s", info.ComponentName, info.CurrentVersion, info.NewVersion)

	// 创建临时文件
	filename := filepath.Base(info.URL)
	destPath := filepath.Join(destDir, filename)

	// 下载文件
	resp, err := u.client.Get(info.URL)
	if err != nil {
		return "", fmt.Errorf("下载失败: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("下载失败，HTTP 状态码: %d", resp.StatusCode)
	}

	// 确保目录存在
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return "", err
	}

	// 创建目标文件
	file, err := os.Create(destPath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	// 写入文件并计算 SHA256
	hash := sha256.New()
	writer := io.MultiWriter(file, hash)

	if _, err := io.Copy(writer, resp.Body); err != nil {
		return "", fmt.Errorf("写入文件失败: %v", err)
	}

	u.log.Infof("下载完成: %s", destPath)
	return destPath, nil
}

// VerifyChecksum 验证文件校验和
func (u *Updater) VerifyChecksum(filePath, expectedSHA256 string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return err
	}

	actualSHA256 := hex.EncodeToString(hash.Sum(nil))
	if actualSHA256 != expectedSHA256 {
		return fmt.Errorf("SHA256 校验失败: 期望 %s, 实际 %s", expectedSHA256, actualSHA256)
	}

	u.log.Debug("SHA256 校验通过")
	return nil
}

// BackupComponent 备份组件
func (u *Updater) BackupComponent(componentPath string) (string, error) {
	backupPath := componentPath + ".bak"

	// 检查原路径是否存在
	if _, err := os.Stat(componentPath); os.IsNotExist(err) {
		return "", nil // 不存在则无需备份
	}

	// 删除旧备份
	os.RemoveAll(backupPath)

	// 重命名为备份
	if err := os.Rename(componentPath, backupPath); err != nil {
		return "", fmt.Errorf("备份失败: %v", err)
	}

	u.log.Infof("已备份: %s -> %s", componentPath, backupPath)
	return backupPath, nil
}

// RollbackComponent 回滚组件
func (u *Updater) RollbackComponent(componentPath, backupPath string) error {
	if backupPath == "" {
		return nil
	}

	// 删除新版本
	os.RemoveAll(componentPath)

	// 恢复备份
	if err := os.Rename(backupPath, componentPath); err != nil {
		return fmt.Errorf("回滚失败: %v", err)
	}

	u.log.Infof("已回滚: %s", componentPath)
	return nil
}

// CleanupBackup 清理备份
func (u *Updater) CleanupBackup(backupPath string) error {
	if backupPath == "" {
		return nil
	}

	if err := os.RemoveAll(backupPath); err != nil {
		u.log.Warnf("清理备份失败: %v", err)
		return err
	}

	u.log.Debugf("已清理备份: %s", backupPath)
	return nil
}

// ExtractZip 解压 ZIP 文件到目标目录
func (u *Updater) ExtractZip(zipPath, destDir string) error {
	u.log.Infof("正在解压: %s -> %s", zipPath, destDir)

	reader, err := zip.OpenReader(zipPath)
	if err != nil {
		return fmt.Errorf("打开 ZIP 文件失败: %v", err)
	}
	defer reader.Close()

	// 确保目标目录存在
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return err
	}

	for _, file := range reader.File {
		// 构建目标路径
		destPath := filepath.Join(destDir, file.Name)

		// 防止目录遍历攻击
		if !strings.HasPrefix(destPath, filepath.Clean(destDir)+string(os.PathSeparator)) {
			return fmt.Errorf("非法的文件路径: %s", file.Name)
		}

		if file.FileInfo().IsDir() {
			os.MkdirAll(destPath, file.Mode())
			continue
		}

		// 确保父目录存在
		if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
			return err
		}

		// 解压文件
		if err := u.extractFile(file, destPath); err != nil {
			return err
		}
	}

	u.log.Info("解压完成")
	return nil
}

// extractFile 解压单个文件
func (u *Updater) extractFile(file *zip.File, destPath string) error {
	srcFile, err := file.Open()
	if err != nil {
		return err
	}
	defer srcFile.Close()

	destFile, err := os.OpenFile(destPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, file.Mode())
	if err != nil {
		return err
	}
	defer destFile.Close()

	_, err = io.Copy(destFile, srcFile)
	return err
}

// ApplyUpdate 应用单个组件更新
func (u *Updater) ApplyUpdate(info UpdateInfo, manifest *Manifest) error {
	basePath, err := config.GetBasePath()
	if err != nil {
		return fmt.Errorf("获取基础路径失败: %v", err)
	}

	tempDir := filepath.Join(basePath, "temp")
	componentPath := u.getComponentPath(basePath, info.ComponentName)

	u.log.Infof("开始更新组件: %s", info.ComponentName)

	// 1. 下载更新包
	zipPath, err := u.DownloadUpdate(info, tempDir)
	if err != nil {
		return err
	}
	defer os.Remove(zipPath)

	// 2. 验证校验和（如果提供）
	if comp, ok := manifest.Components[info.ComponentName]; ok && comp.SHA256 != "" {
		if err := u.VerifyChecksum(zipPath, comp.SHA256); err != nil {
			return err
		}
	}

	// 3. 备份旧版本
	backupPath, err := u.BackupComponent(componentPath)
	if err != nil {
		return err
	}

	// 4. 解压新版本
	if err := u.ExtractZip(zipPath, componentPath); err != nil {
		// 解压失败，回滚
		u.RollbackComponent(componentPath, backupPath)
		return err
	}

	// 5. 更新配置中的版本号
	if err := u.updateComponentVersion(info.ComponentName, info.NewVersion); err != nil {
		u.log.Warnf("更新版本号失败: %v", err)
	}

	// 6. 清理备份
	u.CleanupBackup(backupPath)

	u.log.Infof("组件更新完成: %s %s -> %s", info.ComponentName, info.CurrentVersion, info.NewVersion)
	return nil
}

// getComponentPath 获取组件路径
func (u *Updater) getComponentPath(basePath, componentName string) string {
	switch componentName {
	case "frontend":
		return filepath.Join(basePath, "web")
	case "localbridge":
		return filepath.Join(basePath, "bin")
	case "mfw":
		return filepath.Join(basePath, "mfw")
	case "ocr":
		return filepath.Join(basePath, "ocr")
	default:
		return filepath.Join(basePath, componentName)
	}
}

// updateComponentVersion 更新配置文件中的组件版本
func (u *Updater) updateComponentVersion(componentName, newVersion string) error {
	switch componentName {
	case "frontend":
		u.cfg.Components.Frontend = newVersion
	case "localbridge":
		u.cfg.Components.LocalBridge = newVersion
	case "mfw":
		u.cfg.Components.Mfw = newVersion
	case "ocr":
		u.cfg.Components.Ocr = newVersion
	}
	return u.cfg.Save()
}

// ApplyAllUpdates 应用所有可用更新
func (u *Updater) ApplyAllUpdates(updates []UpdateInfo) error {
	if len(updates) == 0 {
		return nil
	}

	manifest, err := u.fetchManifest()
	if err != nil {
		return err
	}

	var failedUpdates []string
	for _, update := range updates {
		if err := u.ApplyUpdate(update, manifest); err != nil {
			u.log.Errorf("更新 %s 失败: %v", update.ComponentName, err)
			failedUpdates = append(failedUpdates, update.ComponentName)
		}
	}

	if len(failedUpdates) > 0 {
		return fmt.Errorf("以下组件更新失败: %v", failedUpdates)
	}

	return nil
}

// GetManifest 获取远端清单（供外部使用）
func (u *Updater) GetManifest() (*Manifest, error) {
	return u.fetchManifest()
}
