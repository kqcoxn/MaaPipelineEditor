//go:build !windows
// +build !windows

package splash

// noopSplash 非 Windows 平台的空实现
type noopSplash struct {
	cfg Config
}

// newPlatformSplash 创建非 Windows 平台启动画面
func newPlatformSplash(cfg Config) Splash {
	return &noopSplash{cfg: cfg}
}

// Show 显示启动画面
func (s *noopSplash) Show() error {
	// 非 Windows 平台暂不显示启动画面
	return nil
}

// Close 关闭启动画面
func (s *noopSplash) Close() {
	// 空实现
}

// SetMessage 设置消息
func (s *noopSplash) SetMessage(msg string) {
	// 空实现
}
