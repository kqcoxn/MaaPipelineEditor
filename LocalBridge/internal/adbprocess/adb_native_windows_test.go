package adbprocess

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"testing"
	"time"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"golang.org/x/sys/windows"
)

// Opt-in: MPE_ADB_TEST_EXE 指定真实 adb.exe；仅操作副本和隔离的 server 端口。
// 不需要模拟器，不执行设备命令，也不访问默认 5037 server。
func TestNativeADBProcessLifecycle(t *testing.T) {
	source := os.Getenv("MPE_ADB_TEST_EXE")
	if source == "" {
		t.Skip("requires MPE_ADB_TEST_EXE")
	}
	externalDir := copyADB(t, source)
	externalPort := unusedADBPort(t)
	external := isolatedADB(filepath.Join(externalDir, "adb.exe"), externalPort, "--one-device", "MPE_TEST_NO_USB_DEVICE", "server", "nodaemon")
	if err := external.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = external.Process.Kill(); _ = external.Wait() })
	waitADB(t, externalPort, true)

	for _, mode := range []string{"disconnect", "normal-exit", "forced-exit"} {
		t.Run(mode, func(t *testing.T) {
			dir := copyADB(t, source)
			port := unusedADBPort(t)
			// 失败用例也只清理本用例的隔离端口，防止接管前失败留下测试 server。
			t.Cleanup(func() {
				if !adbResponds(port) {
					return
				}
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				cmd := isolatedADB(filepath.Join(dir, "adb.exe"), port, "kill-server")
				bounded := exec.CommandContext(ctx, cmd.Path, cmd.Args[1:]...)
				bounded.Env = cmd.Env
				if output, err := bounded.CombinedOutput(); err != nil {
					t.Errorf("cleanup test ADB: %v %s", err, output)
				}
			})
			owner := exec.Command(os.Args[0], "-test.run=^TestNativeADBHelper$")
			owner.Env = append(os.Environ(), "MPE_ADB_HELPER_MODE="+mode, "MPE_ADB_HELPER_DIR="+dir, "MPE_ADB_HELPER_PORT="+port)
			owner.Stderr = os.Stderr
			stdin, err := owner.StdinPipe()
			if err != nil {
				t.Fatal(err)
			}
			stdout, err := owner.StdoutPipe()
			if err != nil {
				t.Fatal(err)
			}
			if err := owner.Start(); err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() { _ = owner.Process.Kill(); _ = owner.Wait() })
			lines := make(chan string, 8)
			go func() {
				scanner := bufio.NewScanner(stdout)
				for scanner.Scan() {
					lines <- scanner.Text()
				}
				close(lines)
			}()
			read := func() string {
				t.Helper()
				select {
				case line, ok := <-lines:
					if !ok {
						t.Fatal("ADB helper exited unexpectedly")
					}
					return line
				case <-time.After(20 * time.Second):
					t.Fatal("ADB helper timed out")
					return ""
				}
			}
			var pids []int
			if err := json.Unmarshal([]byte(read()), &pids); err != nil || len(pids) == 0 {
				t.Fatalf("invalid ADB PIDs: %v %v", pids, err)
			}
			var handles []windows.Handle
			for _, pid := range pids {
				handles = append(handles, openTestProcess(t, pid))
			}
			waitADB(t, port, true)
			// 必须先证明确实复现了 Windows 可执行文件占用，避免空洞的删除断言。
			if err := os.Remove(filepath.Join(dir, "adb.exe")); err == nil {
				t.Fatal("running ADB did not lock its executable")
			}
			if mode == "forced-exit" {
				if err := owner.Process.Kill(); err != nil {
					t.Fatal(err)
				}
			} else {
				io.WriteString(stdin, "finish\n")
				if mode == "disconnect" && read() != "disconnected-and-restarted" {
					t.Fatal("ADB restart failed")
				}
			}
			for _, handle := range handles {
				status, err := windows.WaitForSingleObject(handle, 5000)
				if err != nil || status != windows.WAIT_OBJECT_0 {
					t.Fatalf("real ADB survived cleanup: %v %v", status, err)
				}
			}
			waitADB(t, port, false)
			// 删除整个隔离项目目录，包括 adb.exe、DLL 和继承的工作目录。
			if err := os.RemoveAll(dir); err != nil {
				t.Fatalf("project directory remains locked: %v", err)
			}
			if _, err := os.Stat(dir); !os.IsNotExist(err) {
				t.Fatalf("project directory still exists: %v", err)
			}
			// 发协议请求验证外部真实 server 可服务，不能仅断言其 PID 存活。
			waitADB(t, externalPort, true)
		})
	}
}

func TestNativeADBHelper(t *testing.T) {
	mode := os.Getenv("MPE_ADB_HELPER_MODE")
	if mode == "" {
		return
	}
	if err := logger.Init("ERROR", "", false); err != nil {
		t.Fatal(err)
	}
	dir, port := os.Getenv("MPE_ADB_HELPER_DIR"), os.Getenv("MPE_ADB_HELPER_PORT")
	exe := filepath.Join(dir, "adb.exe")
	start := func() func() {
		release := Acquire(exe)
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		cmd := isolatedADB(exe, port, "--one-device", "MPE_TEST_NO_USB_DEVICE", "start-server")
		// CommandContext 提供超时，保留隔离参数与环境。
		bounded := exec.CommandContext(ctx, cmd.Path, cmd.Args[1:]...)
		bounded.Env, bounded.Dir = cmd.Env, dir
		if output, err := bounded.CombinedOutput(); err != nil {
			t.Fatalf("start ADB: %v\n%s", err, output)
		}
		waitADB(t, port, true)
		return release
	}
	release := start()
	if shared.scope == nil {
		t.Fatal("ADB guard unavailable")
	}
	// 强制退出必须依靠后台跟踪器接管，不手动调用 collect。
	deadline := time.Now().Add(5 * time.Second)
	var pids []uintptr
	for {
		var err error
		pids, err = jobProcesses(shared.scope.(*windowsScope).reap)
		if err != nil {
			t.Fatal(err)
		}
		if len(pids) != 0 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("real ADB was not adopted")
		}
		time.Sleep(10 * time.Millisecond)
	}
	json.NewEncoder(os.Stdout).Encode(pids)
	input := bufio.NewScanner(os.Stdin)
	if !input.Scan() {
		os.Exit(2)
	}
	if mode == "disconnect" {
		release()
		// 不添加延迟：连续重启 server，覆盖终止尚未完成就再次启动的竞态。
		for i := 0; i < 5; i++ {
			next := start()
			next()
		}
		fmt.Println("disconnected-and-restarted")
		input.Scan()
	} else {
		CleanupForExit()
	}
	os.Exit(0)
}

func isolatedADB(exe, port string, args ...string) *exec.Cmd {
	cmd := exec.Command(exe, append([]string{"-P", port}, args...)...)
	cmd.Env = append(os.Environ(), "ADB_SERVER_SOCKET=", "ADB_MDNS_AUTO_CONNECT=", "ADB_LOCAL_TRANSPORT_MAX_PORT=0", "ANDROID_USER_HOME="+filepath.Dir(exe))
	return cmd
}

func copyADB(t *testing.T, source string) string {
	t.Helper()
	dir := t.TempDir()
	for _, name := range []string{"adb.exe", "AdbWinApi.dll", "AdbWinUsbApi.dll"} {
		data, err := os.ReadFile(filepath.Join(filepath.Dir(source), name))
		if os.IsNotExist(err) && name != "adb.exe" {
			continue
		}
		if err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, name), data, 0700); err != nil {
			t.Fatal(err)
		}
	}
	return dir
}

func unusedADBPort(t *testing.T) string {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	return strconv.Itoa(listener.Addr().(*net.TCPAddr).Port)
}

// 直接请求 server，避免 adb devices 在 server 死亡时自动重启它而掩盖失败。
func adbResponds(port string) bool {
	conn, err := net.DialTimeout("tcp", "127.0.0.1:"+port, 200*time.Millisecond)
	if err != nil {
		return false
	}
	defer conn.Close()
	conn.SetDeadline(time.Now().Add(time.Second))
	if _, err := io.WriteString(conn, "000chost:version"); err != nil {
		return false
	}
	var status [4]byte
	_, err = io.ReadFull(conn, status[:])
	return err == nil && string(status[:]) == "OKAY"
}

func waitADB(t *testing.T, port string, want bool) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for {
		if adbResponds(port) == want {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("ADB port %s responding != %v", port, want)
		}
		time.Sleep(10 * time.Millisecond)
	}
}
