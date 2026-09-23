// Package dependencies exposes repair through the shared installation engine.
package dependencies

import (
	"context"
	"fmt"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/install"
	"io"
	"path/filepath"
)

func Reinstall(ctx context.Context, version, target, exeDir string, output, errors io.Writer) error {
	if target != "all" && target != "mfw" && target != "ocr" {
		return fmt.Errorf("未知依赖 %q", target)
	}
	if !filepath.IsAbs(exeDir) {
		return fmt.Errorf("安装目录必须是绝对路径")
	}
	if version == "dev" {
		return fmt.Errorf("开发版没有发布清单；请使用仓库的 yarn lb:deps 安装 MaaFramework、MaaAgentBinary 和 OCR 开发依赖")
	}
	manifest, err := install.FetchManifest(ctx, version)
	if err != nil {
		return err
	}
	return install.Repair(ctx, exeDir, manifest, target, output)
}
