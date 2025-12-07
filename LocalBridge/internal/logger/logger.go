package logger

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/sirupsen/logrus"
)

// 全局日志实例
var Logger *logrus.Logger

// 日志推送函数类型
type LogPushFunc func(level, module, message string)

var pushFunc LogPushFunc

// 初始化日志系统
func Init(logLevel string, logDir string, pushToClient bool) error {
	Logger = logrus.New()

	// 设置日志级别
	level, err := logrus.ParseLevel(logLevel)
	if err != nil {
		level = logrus.InfoLevel
	}
	Logger.SetLevel(level)

	// 设置日志格式
	Logger.SetFormatter(&logrus.TextFormatter{
		FullTimestamp:   true,
		TimestampFormat: "15:04:05",
		ForceColors:     true,
	})

	// 创建日志目录
	if logDir != "" {
		if err := os.MkdirAll(logDir, 0755); err != nil {
			return fmt.Errorf("创建日志目录失败: %w", err)
		}

		// 清理旧日志文件
		if err := cleanOldLogs(logDir, 3); err != nil {
			fmt.Printf("清理旧日志失败: %v\n", err)
		}

		// 创建日志文件
		logFileName := fmt.Sprintf("lb-%s.log", time.Now().Format("2006-01-02"))
		logFilePath := filepath.Join(logDir, logFileName)

		logFile, err := os.OpenFile(logFilePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
		if err != nil {
			return fmt.Errorf("创建日志文件失败: %w", err)
		}

		// 同时输出到控制台和文件
		mw := io.MultiWriter(os.Stdout, logFile)
		Logger.SetOutput(mw)
	}

	// 添加钩子用于推送日志到客户端
	if pushToClient {
		Logger.AddHook(&PushHook{})
	}

	return nil
}

// 设置日志推送函数
func SetPushFunc(fn LogPushFunc) {
	pushFunc = fn
}

// 推送日志到 WebSocket 客户端 Hook
type PushHook struct{}

// 返回 Hook 处理的日志级别
func (hook *PushHook) Levels() []logrus.Level {
	return []logrus.Level{
		logrus.InfoLevel,
		logrus.WarnLevel,
		logrus.ErrorLevel,
	}
}

// 在日志记录时触发 Hook
func (hook *PushHook) Fire(entry *logrus.Entry) error {
	if pushFunc != nil {
		module := "System"
		if m, ok := entry.Data["module"].(string); ok {
			module = m
		}

		pushFunc(
			entry.Level.String(),
			module,
			entry.Message,
		)
	}
	return nil
}

// 返回带模块信息的日志 Entry
func WithModule(module string) *logrus.Entry {
	return Logger.WithField("module", module)
}

// 便捷日志方法 - TODO

// 记录 INFO 级别日志
func Info(module, message string, args ...interface{}) {
	WithModule(module).Infof(message, args...)
}

// 记录 WARN 级别日志
func Warn(module, message string, args ...interface{}) {
	WithModule(module).Warnf(message, args...)
}

// 记录 ERROR 级别日志
func Error(module, message string, args ...interface{}) {
	WithModule(module).Errorf(message, args...)
}

// 记录 DEBUG 级别日志
func Debug(module, message string, args ...interface{}) {
	WithModule(module).Debugf(message, args...)
}

// 清理旧日志文件
func cleanOldLogs(logDir string, keepDays int) error {
	// 计算截止时间
	cutoffTime := time.Now().AddDate(0, 0, -keepDays)

	// 读取日志目录
	entries, err := os.ReadDir(logDir)
	if err != nil {
		return fmt.Errorf("读取日志目录失败: %w", err)
	}

	// 遍历并删除过期日志
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		// 只处理 lb- 开头的 .log 文件
		fileName := entry.Name()
		matched, err := filepath.Match("lb-*.log", fileName)
		if err != nil || !matched {
			continue
		}

		// 获取文件信息
		filePath := filepath.Join(logDir, fileName)
		fileInfo, err := os.Stat(filePath)
		if err != nil {
			continue
		}

		// 检查修改时间,删除过期文件
		if fileInfo.ModTime().Before(cutoffTime) {
			if err := os.Remove(filePath); err != nil {
				fmt.Printf("删除旧日志失败 %s: %v\n", fileName, err)
			} else {
				fmt.Printf("已删除旧日志: %s\n", fileName)
			}
		}
	}

	return nil
}
