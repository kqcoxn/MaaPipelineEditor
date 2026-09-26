package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"unicode/utf8"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/install"
)

type environmentProgressWriter struct {
	output      io.Writer
	pending     []byte
	interactive bool
	width       int
}

func newEnvironmentProgressWriter(output io.Writer) *environmentProgressWriter {
	w := &environmentProgressWriter{output: output}
	if f, ok := output.(*os.File); ok {
		info, err := f.Stat()
		w.interactive = err == nil && info.Mode()&os.ModeCharDevice != 0
	}
	return w
}

func (w *environmentProgressWriter) finish() {
	if w.width > 0 {
		fmt.Fprintln(w.output)
		w.width = 0
	}
}

func (w *environmentProgressWriter) Write(data []byte) (int, error) {
	w.pending = append(w.pending, data...)
	for {
		index := bytes.IndexByte(w.pending, '\n')
		if index < 0 {
			break
		}
		line := w.pending[:index]
		var event install.ProgressEvent
		if err := json.Unmarshal(line, &event); err != nil {
			w.finish()
			fmt.Fprintln(w.output, string(line))
		} else {
			text := environmentProgressText(event)
			if w.interactive && event.DownloadProgress != nil {
				width := utf8.RuneCountInString(text)
				fmt.Fprintf(w.output, "\r%s%s", text, strings.Repeat(" ", max(0, w.width-width)))
				w.width = width
			} else {
				w.finish()
				fmt.Fprintln(w.output, text)
			}
		}
		w.pending = w.pending[index+1:]
	}
	return len(data), nil
}

func downloadSize(n float64) string {
	for _, unit := range []string{"B", "KiB", "MiB", "GiB"} {
		if n < 1024 || unit == "GiB" {
			return fmt.Sprintf("%.1f %s", n, unit)
		}
		n /= 1024
	}
	return ""
}

func environmentProgressText(event install.ProgressEvent) string {
	if p := event.DownloadProgress; p != nil {
		name := "运行环境"
		if event.Artifact == "editor" {
			name = "Editor"
		}
		amount := downloadSize(float64(p.Downloaded))
		bar := "[总大小未知]"
		if p.Total > 0 {
			ratio := min(1, float64(p.Downloaded)/float64(p.Total))
			filled := int(ratio * 20)
			bar = fmt.Sprintf("[%s%s] %.1f%%", strings.Repeat("=", filled), strings.Repeat("-", 20-filled), ratio*100)
			amount += " / " + downloadSize(float64(p.Total))
		} else if p.Downloaded == 0 {
			bar = "[等待下载响应]"
		}
		return fmt.Sprintf("%s %s %s %s/s 已用 %ds", name, bar, amount, downloadSize(p.BytesPerSecond), p.ElapsedSeconds)
	}
	label := map[string]string{"downloading": "正在连接下载服务器", "verifying": "正在校验与解压", "installing": "正在切换版本", "validating": "正在验证已安装环境", "complete": "环境已准备完成"}[event.Phase]
	if label == "" {
		label = event.Phase
	}
	return fmt.Sprintf("%s（%s）", label, event.Version)
}
