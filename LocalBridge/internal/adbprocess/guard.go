// Package adbprocess 回收 LocalBridge 自己启动的 Windows ADB 进程。
package adbprocess

import (
	"errors"
	"sync"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
)

type processScope interface {
	collect(paths map[string]bool) error
	cleanup() error
}

type guard struct {
	mu        sync.Mutex
	once      sync.Once
	scope     processScope
	users     int
	paths     map[string]bool
	lastError string
}

var shared guard

// Acquire 必须先于设备扫描/控制器创建调用。返回的函数在原生对象成功销毁后调用。
// 一次扫描或一个控制器占用一份引用，避免清理与新的 ADB 操作竞态。
func Acquire(path string) func() { return shared.acquire(path) }

// CleanupForExit 仅供后端进程退出调用；服务重载不能绕过控制器引用计数。
func CleanupForExit() {
	shared.mu.Lock()
	defer shared.mu.Unlock()
	if shared.scope == nil {
		return
	}
	if err := shared.scope.collect(shared.paths); err != nil {
		logger.Warn("ADB", "退出时收集 ADB 子进程失败: %v", err)
	}
	if err := shared.scope.cleanup(); err != nil {
		logger.Warn("ADB", "退出时回收 ADB 子进程失败: %v", err)
	}
}

func (g *guard) acquire(path string) func() {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.once.Do(func() {
		g.paths = make(map[string]bool)
		var err error
		g.scope, err = newScope()
		if err != nil {
			logger.Warn("ADB", "无法启用 ADB 进程回收: %v", err)
		}
		if g.scope != nil {
			go g.watch()
		}
	})
	if path != "" {
		g.paths[normalizePath(path)] = true
	}
	g.users++
	var once sync.Once
	return func() {
		once.Do(func() {
			g.mu.Lock()
			defer g.mu.Unlock()
			g.users--
			g.sweep()
		})
	}
}

// 调用方持有 mu；先收集后清理，覆盖扫描/失败连接产生的进程。
func (g *guard) sweep() {
	if g.scope == nil {
		return
	}
	err := g.scope.collect(g.paths)
	if g.users == 0 {
		err = errors.Join(err, g.scope.cleanup())
	}
	if err == nil {
		g.lastError = ""
		return
	}
	if message := err.Error(); message != g.lastError {
		logger.Warn("ADB", "ADB 进程回收失败: %s", message)
		g.lastError = message
	}
}
