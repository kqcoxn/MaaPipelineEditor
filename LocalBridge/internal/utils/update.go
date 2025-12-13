package utils

import (
	"fmt"
	"os"
	"runtime"
)

// PrintInstallCommand 输出适合当前平台的安装命令
func PrintInstallCommand() {
	switch runtime.GOOS {
	case "windows":
		// 检测是否在 PowerShell 环境
		shell := os.Getenv("PSModulePath")
		if shell != "" {
			// PowerShell 环境
			fmt.Println("   irm https://raw.githubusercontent.com/kqcoxn/MaaPipelineEditor/main/tools/install.ps1 | iex")
		} else {
			// CMD 环境
			fmt.Println("   curl -fsSL https://raw.githubusercontent.com/kqcoxn/MaaPipelineEditor/main/tools/install.bat -o %TEMP%\\install-mpelb.bat && %TEMP%\\install-mpelb.bat")
		}
	case "darwin", "linux":
		// Linux/macOS
		fmt.Println("   curl -fsSL https://raw.githubusercontent.com/kqcoxn/MaaPipelineEditor/main/tools/install.sh | bash")
	default:
		fmt.Println("   请访问 GitHub Release 页面手动下载")
	}
}
