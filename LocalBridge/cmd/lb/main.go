package main

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/config"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	fileProtocol "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/protocol/file"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/router"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	fileService "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/service/file"
	"github.com/spf13/cobra"
)

// 命令行
var (
	configPath string
	rootDir    string
	port       int
	logDir     string
	logLevel   string
)

var rootCmd = &cobra.Command{
	Use:   "mpelb",
	Short: "⭐ MPE Local Bridge - 为 MaaPipelineEditor 构建本地的桥梁 🌉",
	Long:  `MPE Local Bridge 是连接本地各系统与 MaaPipelineEditor 前端的桥梁服务，目前支持文件管理功能，更多集成即将更新！`,
	Run:   runServer,
}

func init() {
	rootCmd.Flags().StringVar(&configPath, "config", "", "配置文件路径")
	rootCmd.Flags().StringVar(&rootDir, "root", "", "文件扫描根目录")
	rootCmd.Flags().IntVar(&port, "port", 0, "WebSocket 监听端口")
	rootCmd.Flags().StringVar(&logDir, "log-dir", "", "日志输出目录")
	rootCmd.Flags().StringVar(&logLevel, "log-level", "", "日志级别 (DEBUG, INFO, WARN, ERROR)")
}

// 主函数
func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "错误: %v\n", err)
		os.Exit(1)
	}
}

// 启动服务
func runServer(cmd *cobra.Command, args []string) {
	// 加载配置
	cfg, err := config.Load(configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "加载配置失败: %v\n", err)
		os.Exit(1)
	}

	// 从命令行参数覆盖配置
	cfg.OverrideFromFlags(rootDir, logDir, logLevel, port)

	// 初始化日志系统
	if err := logger.Init(cfg.Log.Level, cfg.Log.Dir, cfg.Log.PushToClient); err != nil {
		fmt.Fprintf(os.Stderr, "初始化日志系统失败: %v\n", err)
		os.Exit(1)
	}

	logger.Info("Main", "Local Bridge 启动中...")
	logger.Info("Main", "根目录: %s", cfg.File.Root)
	logger.Info("Main", "监听端口: %d", cfg.Server.Port)

	// 创建事件总线
	eventBus := eventbus.GetGlobalBus()

	// 创建文件服务
	fileSvc, err := fileService.NewService(
		cfg.File.Root,
		cfg.File.Exclude,
		cfg.File.Extensions,
		eventBus,
	)
	if err != nil {
		logger.Error("Main", "创建文件服务失败: %v", err)
		os.Exit(1)
	}

	// 启动文件服务
	if err := fileSvc.Start(); err != nil {
		logger.Error("Main", "启动文件服务失败: %v", err)
		os.Exit(1)
	}

	// 创建 WebSocket 服务器
	wsServer := server.NewWebSocketServer(cfg.Server.Host, cfg.Server.Port, eventBus)

	// 创建路由分发器
	rt := router.New()

	// 注册协议处理器
	fileHandler := fileProtocol.NewHandler(fileSvc, eventBus, wsServer, cfg.File.Root)
	rt.RegisterHandler(fileHandler)

	// 设置消息处理器
	wsServer.SetMessageHandler(rt.Route)

	// 启动 WebSocket 服务器
	go func() {
		if err := wsServer.Start(); err != nil {
			logger.Error("Main", "WebSocket 服务器错误: %v", err)
		}
	}()

	// 等待退出信号
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	<-sigChan

	// 退出
	logger.Info("Main", "正在关闭 Local Bridge 服务...")

	wsServer.Stop()
	fileSvc.Stop()

	logger.Info("Main", "Local Bridge 已退出")
}
