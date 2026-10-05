package adbprocess

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"golang.org/x/sys/windows"
)

// 在独立进程中设置 Job，避免把 go test 宿主和其他用例纳入观察范围。
func TestGuardProcessHelper(t *testing.T) {
	mode := os.Getenv("MPE_ADB_GUARD_TEST")
	if mode == "" {
		return
	}
	if mode == "sleep" {
		time.Sleep(time.Minute)
		os.Exit(0)
	}
	if mode == "spawn" {
		child := helperCommand(os.Args[0], "sleep")
		if err := child.Start(); err != nil {
			panic(err)
		}
		fmt.Println(child.Process.Pid)
		os.Exit(0)
	}
	if err := logger.Init("ERROR", "", false); err != nil {
		t.Fatal(err)
	}
	releaseFirst := Acquire(os.Args[0])
	releaseSecond := Acquire(os.Args[0])
	if shared.scope == nil {
		panic("process guard unavailable")
	}
	// 中间父进程先退出；观察 Job 仍能找回孙进程，不能依赖存活的 PPID 链。
	output, err := helperCommand(os.Args[0], "spawn").Output()
	if err != nil {
		panic(err)
	}
	var ownedPID int
	if _, err := fmt.Sscan(string(output), &ownedPID); err != nil {
		panic(err)
	}
	other := helperCommand(os.Getenv("MPE_ADB_OTHER_EXE"), "sleep")
	if err := other.Start(); err != nil {
		panic(err)
	}
	// 等待实际后台跟踪器接管，强杀用例不依赖正常退出清理。
	process, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, uint32(ownedPID))
	if err != nil {
		panic(err)
	}
	deadline := time.Now().Add(5 * time.Second)
	for {
		inside, err := inJob(process, shared.scope.(*windowsScope).reap)
		if err != nil {
			panic(err)
		}
		if inside {
			break
		}
		if time.Now().After(deadline) {
			panic("watcher did not adopt ADB")
		}
		time.Sleep(10 * time.Millisecond)
	}
	windows.CloseHandle(process)
	json.NewEncoder(os.Stdout).Encode([]int{ownedPID, other.Process.Pid})
	input := bufio.NewScanner(os.Stdin)
	if !input.Scan() {
		os.Exit(2)
	}
	releaseFirst()
	releaseFirst() // 重复释放不能提前回收另一个控制器使用的进程。
	fmt.Println("retained")
	if !input.Scan() {
		os.Exit(2)
	}
	if mode == "cleanup" {
		releaseSecond()
		fmt.Println("cleaned")
		input.Scan()
		// 再次连接时复用同一个进程管理器。
		release := Acquire(os.Args[0])
		child := helperCommand(os.Args[0], "sleep")
		if err := child.Start(); err != nil {
			panic(err)
		}
		fmt.Println(child.Process.Pid)
		input.Scan()
		release()
		input.Scan()
	} else if mode == "normal" {
		CleanupForExit() // 即使还有引用，进程退出也应回收。
	} else if mode == "forced" {
		fmt.Println("kill-ready")
		time.Sleep(time.Minute)
	}
	os.Exit(0)
}

func helperCommand(exe, mode string) *exec.Cmd {
	cmd := exec.Command(exe, "-test.run=^TestGuardProcessHelper$")
	cmd.Env = append(os.Environ(), "MPE_ADB_GUARD_TEST="+mode)
	return cmd
}

func TestOwnedADBProcessLifecycle(t *testing.T) {
	// 同一测试可执行文件的外部实例不属于后端 Job，必须存活。
	external := helperCommand(os.Args[0], "sleep")
	if err := external.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = external.Process.Kill(); _ = external.Wait() })
	externalHandle := openTestProcess(t, external.Process.Pid)
	// 同一进程树中的非 ADB 程序也必须存活。
	otherExe := filepath.Join(t.TempDir(), "unrelated.exe")
	data, err := os.ReadFile(os.Args[0])
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(otherExe, data, 0700); err != nil {
		t.Fatal(err)
	}
	for _, mode := range []string{"cleanup", "normal", "forced"} {
		t.Run(mode, func(t *testing.T) {
			owner := helperCommand(os.Args[0], mode)
			owner.Env = append(owner.Env, "MPE_ADB_OTHER_EXE="+otherExe)
			owner.Stderr = os.Stderr
			stdout, err := owner.StdoutPipe()
			if err != nil {
				t.Fatal(err)
			}
			stdin, err := owner.StdinPipe()
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
			readLine := func() string {
				t.Helper()
				select {
				case line, ok := <-lines:
					if !ok {
						t.Fatal("helper exited before reporting state")
					}
					return line
				case <-time.After(10 * time.Second):
					t.Fatal("helper timed out")
					return ""
				}
			}
			var pids []int
			if err := json.Unmarshal([]byte(readLine()), &pids); err != nil || len(pids) != 2 {
				t.Fatalf("invalid helper process list: %v %v", pids, err)
			}
			owned := openTestProcess(t, pids[0])
			other := openTestProcess(t, pids[1])
			t.Cleanup(func() { _ = windows.TerminateProcess(other, 0); windows.WaitForSingleObject(other, 5000) })
			io.WriteString(stdin, "release-one\n")
			if got := readLine(); got != "retained" {
				t.Fatal(got)
			}
			assertProcessAlive(t, owned)
			io.WriteString(stdin, "finish\n")
			if mode == "cleanup" {
				if got := readLine(); got != "cleaned" {
					t.Fatal(got)
				}
			} else if mode == "forced" {
				if got := readLine(); got != "kill-ready" {
					t.Fatal(got)
				}
				if err := owner.Process.Kill(); err != nil {
					t.Fatal(err)
				}
			}
			status, err := windows.WaitForSingleObject(owned, 5000)
			if err != nil || status != windows.WAIT_OBJECT_0 {
				t.Fatalf("owned ADB remained alive: %v %v", status, err)
			}
			assertProcessAlive(t, other)
			assertProcessAlive(t, externalHandle)
			if mode == "cleanup" {
				io.WriteString(stdin, "reconnect\n")
				var pid int
				if _, err := fmt.Sscan(readLine(), &pid); err != nil {
					t.Fatal(err)
				}
				reconnected := openTestProcess(t, pid)
				assertProcessAlive(t, reconnected)
				io.WriteString(stdin, "disconnect\n")
				status, err := windows.WaitForSingleObject(reconnected, 5000)
				if err != nil || status != windows.WAIT_OBJECT_0 {
					t.Fatalf("reconnected ADB remained alive: %v %v", status, err)
				}
			}
		})
	}
}

func openTestProcess(t *testing.T, pid int) windows.Handle {
	t.Helper()
	handle, err := windows.OpenProcess(windows.SYNCHRONIZE|windows.PROCESS_TERMINATE, false, uint32(pid))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { windows.CloseHandle(handle) })
	return handle
}

func assertProcessAlive(t *testing.T, handle windows.Handle) {
	t.Helper()
	status, err := windows.WaitForSingleObject(handle, 0)
	if err != nil || status != uint32(windows.WAIT_TIMEOUT) {
		t.Fatalf("unrelated/in-use process terminated: %v %v", status, err)
	}
}
