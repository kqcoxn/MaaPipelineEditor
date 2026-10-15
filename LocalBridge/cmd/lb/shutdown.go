package main

import (
	"os"
	"time"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/adbprocess"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
)

const frameworkExitGrace = 2 * time.Second

// 仅用于整个 LocalBridge 进程退出。调用前必须排空持久化请求，关闭
// 文件监听、调试/PI 会话和 Agent 子进程；运行中的服务重载仍使用 Shutdown。
func shutdownFrameworkForExit(shutdown func() error, resultErr error) {
	done := make(chan error, 1)
	go func() { done <- shutdown() }()
	timer := time.NewTimer(frameworkExitGrace)
	defer timer.Stop()
	select {
	case err := <-done:
		if err != nil {
			logger.Error("Main", "MFW 服务关闭失败: %v", err)
		}
	case <-timer.C:
		logger.Warn("Main", "原生资源清理超过 %s，结束 LocalBridge 进程，不再等待设备重连", frameworkExitGrace)
		// 不继续执行释放动态库或管理锁的 defer。仍在运行的原生线程随
		// 整个进程一起结束，避免销毁其使用中的句柄，也不提前放行新实例。
		adbprocess.CleanupForExit()
		code := 0
		if resultErr != nil {
			code = 1
		}
		os.Exit(code)
	}
}
