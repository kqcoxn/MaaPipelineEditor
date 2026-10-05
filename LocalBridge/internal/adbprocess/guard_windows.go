package adbprocess

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unsafe"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"golang.org/x/sys/windows"
)

var isProcessInJob = windows.NewLazySystemDLL("kernel32.dll").NewProc("IsProcessInJob")

// observe 仅记录后端及其后代，不能设置 KILL_ON_JOB_CLOSE：用户从编辑器
// 打开的外部程序也可能在树内。reap 仅包含经归属校验的 ADB 进程。
// 两个句柄均不继承，保留至进程退出；内核关闭 reap 时回收已接管的 ADB。
type windowsScope struct{ observe, reap windows.Handle }

func newScope() (processScope, error) {
	observe, err := windows.CreateJobObject(nil, nil)
	if err != nil {
		return nil, err
	}
	reap, err := windows.CreateJobObject(nil, nil)
	if err != nil {
		windows.CloseHandle(observe)
		return nil, err
	}
	fail := func(err error) (processScope, error) {
		windows.CloseHandle(reap)
		windows.CloseHandle(observe)
		return nil, err
	}
	info := windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION{}
	info.BasicLimitInformation.LimitFlags = windows.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
	if _, err := windows.SetInformationJobObject(reap, windows.JobObjectExtendedLimitInformation,
		uintptr(unsafe.Pointer(&info)), uint32(unsafe.Sizeof(info))); err != nil {
		return fail(err)
	}
	if err := windows.AssignProcessToJobObject(observe, windows.CurrentProcess()); err != nil {
		return fail(err)
	}
	return &windowsScope{observe: observe, reap: reap}, nil
}

func normalizePath(path string) string {
	if absolute, err := filepath.Abs(path); err == nil {
		path = absolute
	}
	if resolved, err := filepath.EvalSymlinks(path); err == nil {
		path = resolved
	}
	return strings.ToLower(filepath.Clean(path))
}

func (g *guard) watch() {
	ticker := time.NewTicker(200 * time.Millisecond)
	defer ticker.Stop()
	for range ticker.C {
		g.mu.Lock()
		if g.users > 0 {
			g.sweep()
		}
		g.mu.Unlock()
	}
}

func inJob(process, job windows.Handle) (bool, error) {
	var inside int32
	r, _, err := isProcessInJob.Call(uintptr(process), uintptr(job), uintptr(unsafe.Pointer(&inside)))
	if r == 0 {
		return false, err
	}
	return inside != 0, nil
}

func jobProcesses(job windows.Handle) ([]uintptr, error) {
	// DWORD assigned, DWORD listed, ULONG_PTR pids[]，32/64 位均从偏移 8 开始。
	for capacity := 64; capacity <= 65536; capacity *= 2 {
		buffer := make([]uintptr, 8/int(unsafe.Sizeof(uintptr(0)))+capacity)
		err := windows.QueryInformationJobObject(job, windows.JobObjectBasicProcessIdList,
			uintptr(unsafe.Pointer(&buffer[0])), uint32(len(buffer)*int(unsafe.Sizeof(uintptr(0)))), nil)
		if errors.Is(err, windows.ERROR_MORE_DATA) {
			continue
		}
		if err != nil {
			return nil, err
		}
		counts := (*[2]uint32)(unsafe.Pointer(&buffer[0]))
		if int(counts[1]) > capacity {
			continue
		}
		return buffer[8/int(unsafe.Sizeof(uintptr(0))):][:counts[1]], nil
	}
	return nil, fmt.Errorf("ADB 进程树过大")
}

func (s *windowsScope) collect(paths map[string]bool) error {
	pids, err := jobProcesses(s.observe)
	if err != nil {
		return err
	}
	var failures []error
	for _, pid := range pids {
		if pid == uintptr(os.Getpid()) {
			continue
		}
		if err := s.adopt(uint32(pid), paths); err != nil {
			failures = append(failures, err)
		}
	}
	return errors.Join(failures...)
}

func (s *windowsScope) adopt(pid uint32, paths map[string]bool) error {
	process, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION|windows.PROCESS_SET_QUOTA|windows.PROCESS_TERMINATE, false, pid)
	if err != nil {
		if errors.Is(err, windows.ERROR_INVALID_PARAMETER) {
			return nil
		}
		return fmt.Errorf("检查子进程 %d: %w", pid, err)
	}
	defer windows.CloseHandle(process)
	// PID 可能已重用；必须在实际句柄上再次验证归属。
	inside, err := inJob(process, s.observe)
	if err != nil || !inside {
		return err
	}
	inside, err = inJob(process, s.reap)
	if err != nil || inside {
		return err
	}
	var buffer [32768]uint16
	size := uint32(len(buffer))
	if err := windows.QueryFullProcessImageName(process, 0, &buffer[0], &size); err != nil {
		return nil
	}
	path := windows.UTF16ToString(buffer[:size])
	name := strings.ToLower(filepath.Base(path))
	if name != "adb.exe" && name != "nox_adb.exe" && !paths[normalizePath(path)] {
		return nil
	}
	if err := windows.AssignProcessToJobObject(s.reap, process); err != nil {
		var code uint32
		if windows.GetExitCodeProcess(process, &code) == nil && code != 259 {
			return nil
		}
		return fmt.Errorf("接管 ADB 进程 %d: %w", pid, err)
	}
	logger.Debug("ADB", "已接管 ADB 子进程: pid=%d path=%s", pid, path)
	return nil
}

func (s *windowsScope) cleanup() error {
	pids, err := jobProcesses(s.reap)
	if err != nil {
		return err
	}
	if len(pids) == 0 {
		return nil
	}
	var handles []windows.Handle
	defer func() {
		for _, handle := range handles {
			windows.CloseHandle(handle)
		}
	}()
	for _, pid := range pids {
		handle, err := windows.OpenProcess(windows.SYNCHRONIZE|windows.PROCESS_QUERY_LIMITED_INFORMATION, false, uint32(pid))
		if err != nil {
			continue
		}
		inside, err := inJob(handle, s.reap)
		if err != nil || !inside {
			windows.CloseHandle(handle)
			continue
		}
		handles = append(handles, handle)
	}
	if err := windows.TerminateJobObject(s.reap, 0); err != nil {
		return err
	}
	// TerminateJobObject 是异步终止；在释放全局锁、允许再次连接前等待退出，
	// 避免新连接复用正在终止的 server，也让目录占用尽快解除。
	deadline := time.Now().Add(2 * time.Second)
	for _, handle := range handles {
		remaining := time.Until(deadline).Milliseconds()
		if remaining < 0 {
			remaining = 0
		}
		status, err := windows.WaitForSingleObject(handle, uint32(remaining))
		if err != nil {
			return err
		}
		if status != windows.WAIT_OBJECT_0 {
			return fmt.Errorf("等待 ADB 子进程退出超时")
		}
	}
	logger.Debug("ADB", "已回收 %d 个 ADB 子进程", len(handles))
	return nil
}
