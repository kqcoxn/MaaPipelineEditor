package splash

// Splash 启动画面接口
type Splash interface {
	// Show 显示启动画面
	Show() error
	// Close 关闭启动画面
	Close()
	// SetMessage 设置显示消息
	SetMessage(msg string)
}

// Config 启动画面配置
type Config struct {
	Title   string // 窗口标题
	Message string // 显示消息
	Width   int    // 窗口宽度
	Height  int    // 窗口高度
}

// DefaultConfig 默认配置
func DefaultConfig() Config {
	return Config{
		Title:   "MaaPipelineEditor",
		Message: "正在启动",
		Width:   380,
		Height:  180,
	}
}

// New 创建启动画面实例
func New(cfg Config) Splash {
	return newPlatformSplash(cfg)
}
