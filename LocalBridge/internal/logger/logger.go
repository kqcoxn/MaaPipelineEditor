package logger

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
)

// 控制台日志实例
var consoleLogger *logrus.Logger

// 文件日志实例
var fileLogger *logrus.Logger

// 对外暴露的日志实例
var Logger *logrus.Logger

// 日志推送函数
type LogPushFunc func(level, module, message string)

var pushFunc LogPushFunc

// LogEntry 日志条目
type LogEntry struct {
	Level     string
	Module    string
	Message   string
	Timestamp time.Time
}

// 日志缓存
var (
	logBuffer     []LogEntry
	logBufferMu   sync.RWMutex
	maxBufferSize = 100
)

// 初始化日志系统
func Init(logLevel string, logDir string, pushToClient bool) error {
	// 解析控制台日志级别
	consoleLevel, err := logrus.ParseLevel(logLevel)
	if err != nil {
		consoleLevel = logrus.InfoLevel
	}

	// 创建控制台日志器
	consoleLogger = logrus.New()
	consoleLogger.SetLevel(consoleLevel)
	consoleLogger.SetOutput(os.Stdout)
	consoleLogger.SetFormatter(&logrus.TextFormatter{
		FullTimestamp:   true,
		TimestampFormat: "15:04:05",
		ForceColors:     true,
	})

	// 添加推送到客户端的钩子
	if pushToClient {
		consoleLogger.AddHook(&PushHook{})
	}

	// 创建文件日志器
	if logDir != "" {
		if err := os.MkdirAll(logDir, 0755); err != nil {
			return fmt.Errorf("创建日志目录失败: %w", err)
		}

		// 清理旧日志
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

		// 文件日志记录全级别
		fileLogger = logrus.New()
		fileLogger.SetLevel(logrus.TraceLevel)
		fileLogger.SetOutput(logFile)
		fileLogger.SetFormatter(&logrus.TextFormatter{
			FullTimestamp:   true,
			TimestampFormat: "2006-01-02 15:04:05",
			DisableColors:   true,
		})
	}

	// 设置对外接口使用控制台日志器
	Logger = consoleLogger

	return nil
}

// 设置日志推送函数
func SetPushFunc(fn LogPushFunc) {
	pushFunc = fn
}

// GetHistoryLogs 获取历史日志
func GetHistoryLogs() []LogEntry {
	logBufferMu.RLock()
	defer logBufferMu.RUnlock()
	// 返回副本
	result := make([]LogEntry, len(logBuffer))
	copy(result, logBuffer)
	return result
}

// addToBuffer 添加日志到缓存
func addToBuffer(level, module, message string) {
	logBufferMu.Lock()
	defer logBufferMu.Unlock()

	entry := LogEntry{
		Level:     level,
		Module:    module,
		Message:   message,
		Timestamp: time.Now(),
	}

	logBuffer = append(logBuffer, entry)
	// 保持缓冲区大小
	if len(logBuffer) > maxBufferSize {
		logBuffer = logBuffer[len(logBuffer)-maxBufferSize:]
	}
}

// 推送日志钩子
type PushHook struct{}

func (hook *PushHook) Levels() []logrus.Level {
	return []logrus.Level{
		logrus.InfoLevel,
		logrus.WarnLevel,
		logrus.ErrorLevel,
	}
}

func (hook *PushHook) Fire(entry *logrus.Entry) error {
	module := "System"
	if m, ok := entry.Data["module"].(string); ok {
		module = m
	}
	level := entry.Level.String()

	// 添加到缓存
	addToBuffer(level, module, entry.Message)

	// 推送到客户端
	if pushFunc != nil {
		pushFunc(level, module, entry.Message)
	}
	return nil
}

// 便捷日志方法
func Info(module, message string, args ...interface{}) {
	entry := consoleLogger.WithField("module", module)
	entry.Infof(message, args...)
	if fileLogger != nil {
		fileLogger.WithField("module", module).Infof(message, args...)
	}
}

func Warn(module, message string, args ...interface{}) {
	entry := consoleLogger.WithField("module", module)
	entry.Warnf(message, args...)
	if fileLogger != nil {
		fileLogger.WithField("module", module).Warnf(message, args...)
	}
}

func Error(module, message string, args ...interface{}) {
	entry := consoleLogger.WithField("module", module)
	entry.Errorf(message, args...)
	if fileLogger != nil {
		fileLogger.WithField("module", module).Errorf(message, args...)
	}
}

func Debug(module, message string, args ...interface{}) {
	entry := consoleLogger.WithField("module", module)
	entry.Debugf(message, args...)
	if fileLogger != nil {
		fileLogger.WithField("module", module).Debugf(message, args...)
	}
}

func Trace(module, message string, args ...interface{}) {
	if fileLogger != nil {
		fileLogger.WithField("module", module).Tracef(message, args...)
	}
}

// 返回带模块信息的日志 Entry
func WithModule(module string) *logrus.Entry {
	return consoleLogger.WithField("module", module)
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
