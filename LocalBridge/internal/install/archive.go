package install

import (
	"archive/zip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func download(ctx context.Context, a Artifact, destination string) error {
	if !strings.HasPrefix(a.URL, "https://") || len(a.SHA256) != 64 {
		return fmt.Errorf("资源必须提供 HTTPS 地址与 SHA256")
	}
	req, err := http.NewRequestWithContext(ctx, "GET", a.URL, nil)
	if err != nil {
		return err
	}
	client := &http.Client{Timeout: 30 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("下载失败: HTTP %d", resp.StatusCode)
	}
	f, err := os.OpenFile(destination, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	hash := sha256.New()
	_, err = io.Copy(io.MultiWriter(f, hash), io.LimitReader(resp.Body, 4<<30))
	closeErr := f.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	if !strings.EqualFold(hex.EncodeToString(hash.Sum(nil)), a.SHA256) {
		return fmt.Errorf("下载校验失败")
	}
	return nil
}
func extract(source, destination string) error {
	r, err := zip.OpenReader(source)
	if err != nil {
		return err
	}
	defer r.Close()
	var total uint64
	for _, entry := range r.File {
		name := strings.ReplaceAll(entry.Name, "\\", "/")
		if strings.HasPrefix(name, "/") || strings.Contains(name, ":") || entry.Mode()&os.ModeSymlink != 0 {
			return fmt.Errorf("不安全的压缩条目: %s", name)
		}
		path := filepath.Join(destination, filepath.FromSlash(name))
		relative, err := filepath.Rel(destination, path)
		if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(os.PathSeparator)) {
			return fmt.Errorf("压缩条目越界")
		}
		total += entry.UncompressedSize64
		if total > 8<<30 {
			return fmt.Errorf("解压内容超过限制")
		}
		if entry.FileInfo().IsDir() {
			if err = os.MkdirAll(path, 0755); err != nil {
				return err
			}
			continue
		}
		if err = os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			return err
		}
		input, err := entry.Open()
		if err != nil {
			return err
		}
		mode := entry.Mode().Perm() & 0755
		if mode == 0 {
			mode = 0644
		}
		output, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, mode)
		if err != nil {
			input.Close()
			return err
		}
		_, err = io.Copy(output, io.LimitReader(input, int64(entry.UncompressedSize64)+1))
		closeErr := output.Close()
		input.Close()
		if err != nil {
			return err
		}
		if closeErr != nil {
			return closeErr
		}
	}
	return nil
}
