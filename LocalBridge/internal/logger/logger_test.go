package logger

import (
	"bytes"
	"strings"
	"testing"
)

func TestRedirectedConsoleHasNoColorCodes(t *testing.T) {
	previousConsole, previousFile, previousLogger := consoleLogger, fileLogger, Logger
	t.Cleanup(func() {
		consoleLogger, fileLogger, Logger = previousConsole, previousFile, previousLogger
	})
	fileLogger = nil
	if err := Init("info", "", false); err != nil {
		t.Fatal(err)
	}
	var output bytes.Buffer
	consoleLogger.SetOutput(&output)
	Info("MFW", "初始化成功")
	text := output.String()
	if strings.Contains(text, "\x1b[") {
		t.Fatalf("重定向输出不应包含颜色控制码: %q", text)
	}
	if !strings.Contains(text, "初始化成功") || !strings.Contains(text, "MFW") {
		t.Fatalf("日志正文或模块丢失: %q", text)
	}
}
