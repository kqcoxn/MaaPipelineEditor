package resource

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

// Serialize editor writes so two sessions cannot both overwrite the same revision.
var templateWriteMu sync.Mutex

type templateEditRequest struct {
	RequestID    string `json:"request_id"`
	RelativePath string `json:"relative_path"`
	AbsolutePath string `json:"absolute_path"`
	Original     string `json:"original"`
	Image        string `json:"image"`
}

func (h *Handler) handleSaveTemplateImage(msg models.Message) *models.Message {
	var req templateEditRequest
	var err error
	if parseErr := h.parseData(msg.Data, &req); parseErr != nil {
		err = parseErr
	}
	templateWriteMu.Lock()
	defer templateWriteMu.Unlock()
	if err == nil && (!filepath.IsLocal(req.RelativePath) || strings.Contains(strings.ReplaceAll(req.RelativePath, "\\", "/"), "../")) {
		err = fmt.Errorf("模板路径必须是 image 目录内的相对路径")
	}
	if err == nil {
		path, _, found := h.resourceService.FindImage(req.RelativePath)
		if !found || filepath.Clean(path) != filepath.Clean(req.AbsolutePath) {
			err = fmt.Errorf("模板路径已变化，请关闭编辑器后重新打开")
		} else {
			err = replaceTemplateImage(h.root, path, req.Original, req.Image)
		}
	}
	data := map[string]any{"request_id": req.RequestID, "success": err == nil}
	if err != nil {
		data["message"] = err.Error()
	} else {
		data["image"] = h.getImageData(req.RelativePath)
	}
	return &models.Message{Path: "/lte/template_image_saved", Data: data}
}

func decodeTemplateData(value string) ([]byte, error) {
	if len(value) > 32*1024*1024 {
		return nil, fmt.Errorf("模板图片过大")
	}
	if strings.HasPrefix(value, "data:") {
		_, value, _ = strings.Cut(value, ",")
	}
	return base64.StdEncoding.DecodeString(value)
}

func replaceTemplateImage(root, path, original, edited string) error {
	// Resolve symlinks before checking the workspace boundary.
	realRoot, err := filepath.EvalSymlinks(root)
	if err != nil {
		return err
	}
	realPath, err := filepath.EvalSymlinks(path)
	if err != nil {
		return err
	}
	rel, err := filepath.Rel(realRoot, realPath)
	if err != nil || !filepath.IsLocal(rel) {
		return fmt.Errorf("模板不在当前工作目录内")
	}
	if !strings.EqualFold(filepath.Ext(realPath), ".png") {
		return fmt.Errorf("仅支持覆盖 PNG 模板，请将编辑结果导出为 PNG")
	}
	expected, err := decodeTemplateData(original)
	if err != nil {
		return fmt.Errorf("原图数据无效: %w", err)
	}
	data, err := decodeTemplateData(edited)
	if err != nil {
		return fmt.Errorf("编辑图片数据无效: %w", err)
	}
	config, err := png.DecodeConfig(bytes.NewReader(data))
	if err != nil || config.Width <= 0 || config.Height <= 0 || int64(config.Width)*int64(config.Height) > 32*1024*1024 {
		return fmt.Errorf("无效的 PNG 模板或尺寸过大")
	}
	if _, err := png.Decode(bytes.NewReader(data)); err != nil {
		return fmt.Errorf("PNG 图片不完整")
	}
	current, err := os.ReadFile(realPath)
	if err != nil {
		return err
	}
	if !bytes.Equal(current, expected) {
		return fmt.Errorf("模板已被外部修改，请导出当前编辑结果，或关闭后重新打开")
	}
	info, err := os.Stat(realPath)
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(realPath), ".mpe-template-*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	if _, err = tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err = tmp.Sync(); err != nil {
		tmp.Close()
		return err
	}
	if err = tmp.Close(); err != nil {
		return err
	}
	if err = os.Chmod(tmp.Name(), info.Mode().Perm()); err != nil {
		return err
	}
	// Check again just before replacement, including edits made while encoding/writing.
	current, err = os.ReadFile(realPath)
	if err != nil {
		return err
	}
	if !bytes.Equal(current, expected) {
		return fmt.Errorf("模板已被外部修改，未覆盖文件")
	}
	return os.Rename(tmp.Name(), realPath)
}
