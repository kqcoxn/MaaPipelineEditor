package recorder

import (
	"context"
	"fmt"
	"image/png"
	"os"
	"path/filepath"
	"regexp"

	"github.com/google/uuid"
)

type Asset struct {
	ID    string `json:"id"`
	Image string `json:"image"`
}
type SaveRequest struct {
	RequestID    string  `json:"request_id"`
	ResourcePath string  `json:"resource_path"`
	SessionID    string  `json:"session_id"`
	Assets       []Asset `json:"assets"`
}
type SaveResult struct {
	RequestID string            `json:"request_id"`
	Success   bool              `json:"success"`
	Error     string            `json:"error,omitempty"`
	Paths     map[string]string `json:"paths,omitempty"`
}

var sessionPattern = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,80}$`)

// os.Root prevents symlink/path traversal during both directory creation and writes.
func saveAssets(ctx context.Context, bundle string, req SaveRequest) (paths map[string]string, err error) {
	if !sessionPattern.MatchString(req.SessionID) {
		return nil, fmt.Errorf("会话标识无效")
	}
	if len(req.Assets) == 0 || len(req.Assets) > 200 {
		return nil, fmt.Errorf("模板数量必须在 1 到 200 之间")
	}
	root, err := os.OpenRoot(bundle)
	if err != nil {
		return nil, err
	}
	defer root.Close()
	dir := filepath.Join("image", "recorder", req.SessionID)
	if err = root.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}
	paths = make(map[string]string)
	created := []string{}
	defer func() {
		if err != nil {
			for _, p := range created {
				_ = root.Remove(p)
			}
		}
	}()
	for _, a := range req.Assets {
		if err = ctx.Err(); err != nil {
			return nil, err
		}
		if a.ID == "" {
			return nil, fmt.Errorf("模板标识为空")
		}
		if _, exists := paths[a.ID]; exists {
			return nil, fmt.Errorf("模板标识重复")
		}
		img, decodeErr := decodeImage(a.Image)
		if decodeErr != nil {
			return nil, decodeErr
		}
		relative := filepath.Join(dir, uuid.NewString()+".png")
		f, createErr := root.OpenFile(relative, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0644)
		if createErr != nil {
			return nil, createErr
		}
		created = append(created, relative)
		writeErr := png.Encode(f, img)
		closeErr := f.Close()
		if writeErr != nil {
			return nil, writeErr
		}
		if closeErr != nil {
			return nil, closeErr
		}
		paths[a.ID] = filepath.ToSlash(filepath.Join("recorder", req.SessionID, filepath.Base(relative)))
	}
	return paths, nil
}
