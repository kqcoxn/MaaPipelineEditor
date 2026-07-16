package ports

import (
	"fmt"
	"net"
)

const (
	// MinPort 最小端口号
	MinPort = 9066
	// MaxPort 最大端口号
	MaxPort = 9199
)

// Allocate 分配一个可用端口
// preferredPort 为首选端口，如果不可用则递增尝试
func Allocate(preferredPort int) (int, error) {
	if preferredPort < MinPort {
		preferredPort = MinPort
	}
	if preferredPort > MaxPort {
		preferredPort = MinPort
	}

	// 从首选端口开始尝试
	for port := preferredPort; port <= MaxPort; port++ {
		if IsAvailable(port) {
			return port, nil
		}
	}

	// 如果首选端口之后都不可用，从最小端口开始尝试
	for port := MinPort; port < preferredPort; port++ {
		if IsAvailable(port) {
			return port, nil
		}
	}

	return 0, fmt.Errorf("没有可用端口 (%d-%d)", MinPort, MaxPort)
}

// IsAvailable 检查端口是否可用
func IsAvailable(port int) bool {
	addr := fmt.Sprintf("localhost:%d", port)
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return false
	}
	listener.Close()
	return true
}

// FindAvailable 从指定范围内查找可用端口
func FindAvailable(start, end int) (int, error) {
	for port := start; port <= end; port++ {
		if IsAvailable(port) {
			return port, nil
		}
	}
	return 0, fmt.Errorf("没有可用端口 (%d-%d)", start, end)
}
