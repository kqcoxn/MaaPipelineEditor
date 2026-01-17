package logger

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"
)

// Level 日志级别
type Level int

const (
	DEBUG Level = iota
	INFO
	WARN
	ERROR
	FATAL
)

func (l Level) String() string {
	switch l {
	case DEBUG:
		return "DEBUG"
	case INFO:
		return "INFO"
	case WARN:
		return "WARN"
	case ERROR:
		return "ERROR"
	case FATAL:
		return "FATAL"
	default:
		return "UNKNOWN"
	}
}

// ParseLevel 解析日志级别字符串
func ParseLevel(s string) Level {
	switch s {
	case "DEBUG":
		return DEBUG
	case "INFO":
		return INFO
	case "WARN":
		return WARN
	case "ERROR":
		return ERROR
	case "FATAL":
		return FATAL
	default:
		return INFO
	}
}

// Logger 日志记录器
type Logger struct {
	level      Level
	output     io.Writer
	fileOutput *os.File
}

// New 创建新的日志记录器
func New() *Logger {
	return &Logger{
		level:  INFO,
		output: os.Stdout,
	}
}

// NewWithFile 创建带文件输出的日志记录器
func NewWithFile(logPath string, level string) (*Logger, error) {
	logger := &Logger{
		level:  ParseLevel(level),
		output: os.Stdout,
	}

	if logPath != "" {
		// 确保日志目录存在
		dir := filepath.Dir(logPath)
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("创建日志目录失败: %v", err)
		}

		// 打开日志文件
		file, err := os.OpenFile(logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
		if err != nil {
			return nil, fmt.Errorf("打开日志文件失败: %v", err)
		}

		logger.fileOutput = file
		logger.output = io.MultiWriter(os.Stdout, file)
	}

	return logger, nil
}

// Close 关闭日志文件
func (l *Logger) Close() {
	if l.fileOutput != nil {
		l.fileOutput.Close()
	}
}

// SetLevel 设置日志级别
func (l *Logger) SetLevel(level Level) {
	l.level = level
}

// SetLevelString 通过字符串设置日志级别
func (l *Logger) SetLevelString(level string) {
	l.level = ParseLevel(level)
}

// log 内部日志方法
func (l *Logger) log(level Level, format string, args ...interface{}) {
	if level < l.level {
		return
	}

	timestamp := time.Now().Format("2006-01-02 15:04:05")
	msg := fmt.Sprintf(format, args...)
	logLine := fmt.Sprintf("[%s] [%s] %s\n", timestamp, level.String(), msg)

	l.output.Write([]byte(logLine))
}

// Debug 输出调试日志
func (l *Logger) Debug(msg string) {
	l.log(DEBUG, "%s", msg)
}

// Debugf 输出格式化调试日志
func (l *Logger) Debugf(format string, args ...interface{}) {
	l.log(DEBUG, format, args...)
}

// Info 输出信息日志
func (l *Logger) Info(msg string) {
	l.log(INFO, "%s", msg)
}

// Infof 输出格式化信息日志
func (l *Logger) Infof(format string, args ...interface{}) {
	l.log(INFO, format, args...)
}

// Warn 输出警告日志
func (l *Logger) Warn(msg string) {
	l.log(WARN, "%s", msg)
}

// Warnf 输出格式化警告日志
func (l *Logger) Warnf(format string, args ...interface{}) {
	l.log(WARN, format, args...)
}

// Error 输出错误日志
func (l *Logger) Error(msg string) {
	l.log(ERROR, "%s", msg)
}

// Errorf 输出格式化错误日志
func (l *Logger) Errorf(format string, args ...interface{}) {
	l.log(ERROR, format, args...)
}

// Fatal 输出致命错误日志并退出
func (l *Logger) Fatal(msg string) {
	l.log(FATAL, "%s", msg)
	os.Exit(1)
}

// Fatalf 输出格式化致命错误日志并退出
func (l *Logger) Fatalf(format string, args ...interface{}) {
	l.log(FATAL, format, args...)
	os.Exit(1)
}
