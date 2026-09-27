package mfw

import (
	"fmt"
	"runtime"
	"strings"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
)

// NewProjectAgentClient 创建由 MPE 启动 AgentServer 的 PI 客户端，并返回应传给
// 子进程的实际 identifier。Windows 自动分配时使用 loopback TCP，避免依赖
// MaaFramework 的 C:/Temp 文件 socket；项目显式指定的 identifier 保持原语义。
func NewProjectAgentClient(identifier string) (*maa.AgentClient, string, error) {
	return newProjectAgentClient(identifier, runtime.GOOS)
}

func newProjectAgentClient(identifier, goos string) (*maa.AgentClient, string, error) {
	identifier = strings.TrimSpace(identifier)
	option := maa.WithIdentifier(identifier)
	mode := "identifier"
	if goos == "windows" && identifier == "" {
		// 由 native socket bind(*) 原子分配端口，不提前探测空闲端口。
		option = maa.WithTcpPort(0)
		mode = "tcp-auto"
	}
	// 必须在进入 native 前记录：C++ 创建异常可能直接终止进程，Go recover 无法兜底。
	logger.Info("Agent", "创建 PI Agent 客户端: mode=%s identifier=%q", mode, identifier)
	client, err := maa.NewAgentClient(option)
	if err != nil {
		return nil, "", fmt.Errorf("创建 PI Agent 客户端失败 (%s): %w", mode, err)
	}
	actualIdentifier, err := client.Identifier()
	if err != nil {
		client.Destroy()
		return nil, "", fmt.Errorf("读取 PI Agent identifier 失败: %w", err)
	}
	logger.Info("Agent", "PI Agent 客户端已创建: mode=%s identifier=%q", mode, actualIdentifier)
	return client, actualIdentifier, nil
}
