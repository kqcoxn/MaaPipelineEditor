package managed

import (
	"fmt"
	"golang.org/x/sys/windows"
)

func WaitProcessExit(pid int) error {
	handle, err := windows.OpenProcess(windows.SYNCHRONIZE, false, uint32(pid))
	if err != nil {
		return nil
	}
	defer windows.CloseHandle(handle)
	result, err := windows.WaitForSingleObject(handle, 15000)
	if err != nil {
		return err
	}
	if result != windows.WAIT_OBJECT_0 {
		return fmt.Errorf("等待原安装进程退出超时")
	}
	return nil
}
