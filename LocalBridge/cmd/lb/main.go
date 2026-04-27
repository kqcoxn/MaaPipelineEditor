package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/config"
	debugapi "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/api"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/paths"
	aiProtocol "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/protocol/ai"
	configProtocol "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/protocol/config"
	fileProtocol "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/protocol/file"
	mfwProtocol "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/protocol/mfw"
	resourceProtocol "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/protocol/resource"
	utilityProtocol "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/protocol/utility"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/router"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	fileService "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/service/file"
	resourceService "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/service/resource"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/utils"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
	"github.com/spf13/cobra"
)

// 版本号（由构建时注入）
var Version = "dev"

// 命令行
var (
	configPath   string
	rootDir      string
	port         int
	logDir       string
	logLevel     string
	showVersion  bool
	portableMode bool
)

var rootCmd = &cobra.Command{
	Use:     "mpelb",
	Short:   "⭐ MPE Local Bridge - 为 MaaPipelineEditor 构建本地的桥梁 🌉",
	Long:    `MPE Local Bridge 是连接本地各系统与 MaaPipelineEditor 前端的桥梁服务，目前支持文件管理功能，更多集成即将更新！`,
	Version: Version,
	Run:     runServer,
}

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "配置管理命令",
	Long:  `管理 LocalBridge 配置，包括打开配置文件、设置 MaaFramework 路径等`,
}

var configOpenCmd = &cobra.Command{
	Use:   "open",
	Short: "打开配置文件",
	Long:  `使用系统默认编辑器打开配置文件`,
	Run:   openConfig,
}

var setLibDirCmd = &cobra.Command{
	Use:   "set-lib [path]",
	Short: "设置 MaaFramework lib 路径",
	Long: `设置 MaaFramework Release 包的 lib 目录路径。

路径说明:
  该路径应指向 MaaFramework Release 包解压后的 bin 文件夹，
  其中应包含 MaaFramework.dll/.so 等库文件。

示例:
  Windows: C:\MaaFramework\bin
  Linux:   /opt/maaframework/bin
  macOS:   /Applications/MaaFramework/bin`,
	Args: cobra.MaximumNArgs(1),
	Run:  setLibDir,
}

var setResourceDirCmd = &cobra.Command{
	Use:   "set-resource [path]",
	Short: "设置 OCR 资源路径",
	Long: `设置 OCR 顶层资源路径（model 文件夹所在目录）。

路径说明:
  该路径应指向包含 model 文件夹的目录，
  model 文件夹内应包含 OCR 模型文件（如 ocr 子目录）。

示例:
  Windows: C:\MaaResource
  Linux:   /opt/maa-resource
  macOS:   /Applications/MaaResource

目录结构示例:
  MaaResource/
  └── model/
      └── ocr/
          └── ...`,
	Args: cobra.MaximumNArgs(1),
	Run:  setResourceDir,
}

var openLogDirCmd = &cobra.Command{
	Use:   "open-log",
	Short: "打开后端日志文件夹",
	Long:  `使用系统文件管理器打开后端日志文件夹`,
	Run:   openLogDir,
	PreRun: func(cmd *cobra.Command, args []string) {
		paths.SetPortableMode(portableMode)
		paths.Init()
	},
}

var infoCmd = &cobra.Command{
	Use:   "info",
	Short: "显示路径信息",
	Long:  `显示当前的运行模式和各路径配置信息`,
	Run:   showInfo,
	PreRun: func(cmd *cobra.Command, args []string) {
		paths.SetPortableMode(portableMode)
		paths.Init()
	},
}

func init() {
	rootCmd.Flags().StringVar(&configPath, "config", "", "配置文件路径")
	rootCmd.Flags().StringVar(&rootDir, "root", "", "文件扫描根目录")
	rootCmd.Flags().IntVar(&port, "port", 0, "WebSocket 监听端口")
	rootCmd.Flags().StringVar(&logDir, "log-dir", "", "日志输出目录")
	rootCmd.Flags().StringVar(&logLevel, "log-level", "", "日志级别 (DEBUG, INFO, WARN, ERROR)")
	rootCmd.Flags().BoolVarP(&showVersion, "version", "v", false, "显示版本号")
	rootCmd.Flags().BoolVar(&portableMode, "portable", false, "便携模式：使用可执行文件同目录存储配置")

	// 添加子命令
	rootCmd.AddCommand(configCmd)
	rootCmd.AddCommand(infoCmd)

	// info 子命令
	infoCmd.Flags().BoolVar(&portableMode, "portable", false, "便携模式")

	// config 子命令
	configCmd.AddCommand(configOpenCmd)
	configCmd.AddCommand(setLibDirCmd)
	configCmd.AddCommand(setResourceDirCmd)
	configCmd.AddCommand(openLogDirCmd)

	configCmd.Flags().StringVar(&configPath, "config", "", "配置文件路径")
	configCmd.PersistentFlags().BoolVar(&portableMode, "portable", false, "便携模式")
}

// 主函数
func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "错误: %v\n", err)
		os.Exit(1)
	}
}

// 打印启动 Banner
func printBanner() {
	fmt.Println()
	fmt.Println("\033[36m   __  __ ____  _____ _     ____ ")
	fmt.Println("  |  \\/  |  _ \\| ____| |   | __ ) ")
	fmt.Println("  | |\\/| | |_) |  _| | |   |  _ \\ ")
	fmt.Println("  | |  | |  __/| |___| |___| |_) |")
	fmt.Println("  |_|  |_|_|   |_____|_____|____/ ")
	fmt.Println("\033[0m")
	fmt.Printf("  \033[90mMaaPipelineEditor Local Bridge v%s\033[0m\n", Version)
	fmt.Println("  \033[90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m")
	fmt.Println()
}

// 启动服务
func runServer(cmd *cobra.Command, args []string) {
	// 打印启动 Banner
	printBanner()

	// 设置便携模式
	paths.SetPortableMode(portableMode)

	// 初始化路径系统
	paths.Init()

	// 确保所有必要目录存在
	if err := paths.EnsureAllDirs(); err != nil {
		fmt.Fprintf(os.Stderr, "创建数据目录失败: %v\n", err)
		os.Exit(1)
	}

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

	logger.Info("Main", "Local Bridge 启动中... 版本: %s", Version)
	logger.Debug("Main", "运行模式: %s", paths.GetModeName())
	logger.Debug("Main", "数据目录: %s", paths.GetDataDir())
	logger.Info("Main", "运行目录: %s", cfg.File.Root)
	logger.Debug("Main", "监听端口: %d", cfg.Server.Port)
	logger.Debug("Main", "扫描限制: 深度=%d, 文件数=%d", cfg.File.MaxDepth, cfg.File.MaxFiles)

	// 安全检查
	safetyResult := cfg.CheckRootSafety()
	if safetyResult.IsRisky {
		switch safetyResult.RiskLevel {
		case "high":
			logger.Error("Main", "⚠️  安全警告：检测到高风险目录！")
			for _, reason := range safetyResult.RiskReasons {
				logger.Error("Main", "  - %s", reason)
			}
			logger.Error("Main", "建议操作：")
			for _, suggestion := range safetyResult.Suggestions {
				logger.Error("Main", "  - %s", suggestion)
			}
			logger.Error("Main", "")
			logger.Error("Main", "启动已中止。请指定更具体的项目目录。")
			logger.Error("Main", "示例: mpelb --root \"C:\\YourProject\"")
			os.Exit(1)

		case "medium":
			logger.Warn("Main", "⚠️  注意：扫描目录范围较大")
			for _, reason := range safetyResult.RiskReasons {
				logger.Warn("Main", "  - %s", reason)
			}
			logger.Warn("Main", "扫描将继续，但可能需要较长时间...")
		}

		// 低风险仅记录
		if safetyResult.RiskLevel == "low" {
			for _, reason := range safetyResult.RiskReasons {
				logger.Debug("Main", "提示: %s", reason)
			}
		}
	}

	// 检查 MaaFramework 配置
	if cfg.MaaFW.Enabled {
		if err := checkAndPromptMaaFWConfig(cfg); err != nil {
			logger.Error("Main", "MaaFramework 配置检查失败: %v", err)
			os.Exit(1)
		}
	}

	// 创建事件总线
	eventBus := eventbus.GetGlobalBus()

	// 创建文件服务
	fileSvc, err := fileService.NewService(
		cfg.File.Root,
		cfg.File.Exclude,
		cfg.File.Extensions,
		cfg.File.MaxDepth,
		cfg.File.MaxFiles,
		eventBus,
	)
	if err != nil {
		logger.Error("Main", "创建文件服务失败: %v", err)
		os.Exit(1)
	}

	// 创建 MFW 服务
	mfwSvc := mfw.NewService()
	// 初始化 MFW 服务
	if err := mfwSvc.Initialize(); err != nil {
		// 检查是否是库版本不匹配错误
		if strings.Contains(err.Error(), "库版本不匹配") || strings.Contains(err.Error(), "panic") {
			logger.Error("Main", "MFW 服务初始化失败: %v", err)
			logger.Error("Main", "程序将退出，请更新 MaaFramework 后重启")
			os.Exit(1)
		}
		logger.Warn("Main", "MFW 服务初始化失败: %v (当前状态仅可使用文件管理功能)", err)
	} else {
		logger.Debug("Main", "MFW 服务初始化完成")
		// 检查 OCR 资源路径是否配置
		if cfg.MaaFW.ResourceDir == "" {
			logger.Warn("Main", "OCR 资源路径未配置，原生 OCR 功能将不可用（但仍可用前端 OCR，若无需求无需配置）。请运行 'mpelb config set-resource' 进行配置")
		}
	}

	// 启动文件服务
	if err := fileSvc.Start(); err != nil {
		logger.Error("Main", "启动文件服务失败: %v", err)
		os.Exit(1)
	}

	// 创建资源扫描服务
	resSvc := resourceService.NewService(cfg.File.Root, eventBus)
	if err := resSvc.Start(); err != nil {
		logger.Warn("Main", "资源扫描服务启动失败: %v", err)
	} else {
		logger.Debug("Main", "资源扫描服务已启动")
	}

	// 检查更新
	checkAndPrintUpdateNotice()

	// 创建 WebSocket 服务器
	wsServer := server.NewWebSocketServer(cfg.Server.Host, cfg.Server.Port, eventBus)

	// 设置日志推送函数
	logger.SetPushFunc(func(level, module, message string) {
		wsServer.Broadcast(models.Message{
			Path: "/lte/logger",
			Data: models.LogData{
				Level:     level,
				Module:    module,
				Message:   message,
				Timestamp: time.Now().Format(time.RFC3339),
			},
		})
	})

	// 订阅连接建立事件，推送历史日志
	eventBus.Subscribe(eventbus.EventConnectionEstablished, func(event eventbus.Event) {
		conn, ok := event.Data.(*server.Connection)
		if !ok {
			return
		}
		// 获取历史日志并推送
		historyLogs := logger.GetHistoryLogs()
		for _, log := range historyLogs {
			conn.Send(models.Message{
				Path: "/lte/logger",
				Data: models.LogData{
					Level:     log.Level,
					Module:    log.Module,
					Message:   log.Message,
					Timestamp: log.Timestamp.Format(time.RFC3339),
				},
			})
		}
	})

	// 订阅配置重载事件
	eventBus.Subscribe(eventbus.EventConfigReload, func(event eventbus.Event) {
		cfg, ok := event.Data.(*config.Config)
		if !ok {
			logger.Error("Main", "配置重载事件数据类型错误")
			return
		}

		logger.Info("Main", "收到配置重载事件，开始重载各服务...")

		// 重载资源扫描服务
		if resSvc != nil {
			if err := resSvc.Reload(cfg.File.Root); err != nil {
				logger.Error("Main", "资源扫描服务重载失败: %v", err)
			} else {
				logger.Info("Main", "资源扫描服务重载完成")
			}
		}

		// 重载MFW服务（仅当启用且配置变化时）
		if mfwSvc != nil && cfg.MaaFW.Enabled {
			if err := mfwSvc.Reload(); err != nil {
				logger.Error("Main", "MFW服务重载失败: %v", err)
			} else {
				logger.Info("Main", "MFW服务重载完成")
			}
		}

		logger.Info("Main", "所有服务重载完成")
	})

	// 创建路由分发器
	rt := router.New()

	// 注册协议处理器
	fileHandler := fileProtocol.NewHandler(fileSvc, eventBus, wsServer, cfg.File.Root)
	rt.RegisterHandler(fileHandler)

	// 注册 MFW 协议处理器
	mfwHandler := mfwProtocol.NewMFWHandler(mfwSvc)
	rt.RegisterHandler(mfwHandler)

	// 注册 Utility 协议处理器
	utilityHandler := utilityProtocol.NewUtilityHandler(mfwSvc, cfg.File.Root)
	rt.RegisterHandler(utilityHandler)

	// 注册 AI 代理协议处理器
	aiHandler := aiProtocol.NewAIHandler()
	rt.RegisterHandler(aiHandler)

	// 注册 Config 协议处理器
	configHandler := configProtocol.NewConfigHandler()
	rt.RegisterHandler(configHandler)

	// 注册 debug-vNext 协议处理器
	debugHandler := debugapi.NewHandler(mfwSvc)
	rt.RegisterHandler(debugHandler)

	// 注册 Resource 协议处理器
	resourceHandler := resourceProtocol.NewHandler(resSvc, eventBus, wsServer, cfg.File.Root)
	rt.RegisterHandler(resourceHandler)

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
	signal.Notify(sigChan, getExitSignals()...)

	<-sigChan

	// 退出
	logger.Info("Main", "正在关闭 Local Bridge 服务...")

	wsServer.Stop()
	fileSvc.Stop()

	// 关闭 MFW 服务
	if err := mfwSvc.Shutdown(); err != nil {
		logger.Error("Main", "MFW 服务关闭失败: %v", err)
	}

	logger.Info("Main", "Local Bridge 已退出")
}

// 打开配置文件
func openConfig(cmd *cobra.Command, args []string) {
	// 初始化路径系统
	paths.Init()

	// 确定配置文件路径
	var cfgPath string
	if configPath != "" {
		cfgPath = configPath
	} else {
		// 使用 paths 包获取配置文件路径
		cfgPath = paths.GetConfigFile()
	}

	// 转换为绝对路径
	absPath, err := filepath.Abs(cfgPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "错误: 无法获取配置文件的绝对路径: %v\n", err)
		os.Exit(1)
	}

	// 检查文件是否存在
	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "错误: 配置文件不存在: %s\n", absPath)
		os.Exit(1)
	}

	fmt.Printf("正在打开配置文件: %s\n", absPath)

	// 根据不同操作系统使用不同的命令打开文件
	var command *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		command = exec.Command("cmd", "/c", "start", "", absPath)
	case "darwin":
		command = exec.Command("open", absPath)
	case "linux":
		command = exec.Command("xdg-open", absPath)
	default:
		fmt.Fprintf(os.Stderr, "错误: 不支持的操作系统: %s\n", runtime.GOOS)
		os.Exit(1)
	}

	// 执行命令
	if err := command.Start(); err != nil {
		fmt.Fprintf(os.Stderr, "错误: 打开配置文件失败: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("✅ 配置文件已在默认编辑器中打开")
}

// 设置 MaaFramework lib 路径
func setLibDir(cmd *cobra.Command, args []string) {
	// 初始化路径系统
	paths.Init()

	// 加载配置
	cfg, err := config.Load(configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "加载配置失败: %v\n", err)
		os.Exit(1)
	}

	var libDir string
	if len(args) > 0 {
		libDir = args[0]
	} else {
		// 交互式输入
		libDir = promptForPath(
			"📁 MaaFramework lib 路径",
			"该路径应指向 MaaFramework Release 包解压后的 bin 文件夹\n"+
				"   其中应包含 MaaFramework.dll/.so 等库文件\n"+
				"   示例: C:\\MaaFramework\\bin 或 /opt/maaframework/bin",
			cfg.MaaFW.LibDir,
		)
	}

	// 验证路径
	if libDir != "" {
		absPath, err := filepath.Abs(libDir)
		if err != nil {
			fmt.Fprintf(os.Stderr, "错误: 无法解析路径: %v\n", err)
			os.Exit(1)
		}
		libDir = absPath

		if _, err := os.Stat(libDir); os.IsNotExist(err) {
			fmt.Fprintf(os.Stderr, "⚠️  警告: 指定的路径不存在: %s\n", libDir)
		}

		// 设置路径后自动启用 MaaFramework
		cfg.MaaFW.Enabled = true
	}

	if err := cfg.SetMaaFWLibDir(libDir); err != nil {
		fmt.Fprintf(os.Stderr, "保存配置失败: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("✅ MaaFramework lib 路径已设置为: %s\n", libDir)
	if libDir != "" {
		fmt.Println("✅ 已设置 MaaFramework 自启用")
	}
}

// 设置 OCR 资源路径
func setResourceDir(cmd *cobra.Command, args []string) {
	// 初始化路径系统
	paths.Init()

	// 加载配置
	cfg, err := config.Load(configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "加载配置失败: %v\n", err)
		os.Exit(1)
	}

	var resourceDir string
	if len(args) > 0 {
		resourceDir = args[0]
	} else {
		// 交互式输入
		resourceDir = promptForPath(
			"📁 OCR 资源路径",
			"model 文件夹所在目录，目录结构应为:\n"+
				"   <路径>/model/ocr/...\n"+
				"   示例: D:assets/resource/base"+
				"   （注意是 model 文件夹所在的根目录，而不是 ocr 文件夹的目录）",
			cfg.MaaFW.ResourceDir,
		)
	}

	// 验证路径
	if resourceDir != "" {
		absPath, err := filepath.Abs(resourceDir)
		if err != nil {
			fmt.Fprintf(os.Stderr, "错误: 无法解析路径: %v\n", err)
			os.Exit(1)
		}
		resourceDir = absPath

		if _, err := os.Stat(resourceDir); os.IsNotExist(err) {
			fmt.Fprintf(os.Stderr, "⚠️  警告: 指定的路径不存在: %s\n", resourceDir)
		}

		// 设置资源路径时自动启用 MaaFramework
		cfg.MaaFW.Enabled = true
	}

	if err := cfg.SetMaaFWResourceDir(resourceDir); err != nil {
		fmt.Fprintf(os.Stderr, "保存配置失败: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("✅ OCR 资源路径已设置为: %s\n", resourceDir)
	if resourceDir != "" {
		fmt.Println("✅ MaaFramework 已自动启用")
	}
}

// 交互式提示输入路径
func promptForPath(title, hint, currentValue string) string {
	fmt.Println()
	fmt.Printf("┌─ %s\n", title)
	fmt.Printf("│  %s\n", strings.ReplaceAll(hint, "\n", "\n│  "))
	if currentValue != "" {
		fmt.Printf("│  当前值: %s\n", currentValue)
	}
	fmt.Print("└─ 请输入路径 (留空保持不变): ")

	reader := bufio.NewReader(os.Stdin)
	input, _ := reader.ReadString('\n')
	input = strings.TrimSpace(input)

	if input == "" {
		return currentValue
	}
	return input
}

// 打开后端日志文件夹
func openLogDir(cmd *cobra.Command, args []string) {
	// 加载配置
	cfg, err := config.Load(configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "加载配置失败: %v\n", err)
		os.Exit(1)
	}

	// 获取后端日志目录
	var logDir string
	if cfg != nil && cfg.Log.Dir != "" {
		logDir = cfg.Log.Dir
	} else {
		// 使用默认日志目录
		logDir = paths.GetLogDir()
	}

	// 转换为绝对路径
	absPath, err := filepath.Abs(logDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "错误: 无法获取日志目录的绝对路径: %v\n", err)
		os.Exit(1)
	}

	// 检查目录是否存在
	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "错误: 日志目录不存在: %s\n", absPath)
		os.Exit(1)
	}

	fmt.Printf("正在打开日志文件夹: %s\n", absPath)

	// 根据不同操作系统使用不同的命令打开目录
	var command *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		command = exec.Command("explorer", absPath)
	case "darwin":
		command = exec.Command("open", absPath)
	case "linux":
		command = exec.Command("xdg-open", absPath)
	default:
		fmt.Fprintf(os.Stderr, "错误: 不支持的操作系统: %s\n", runtime.GOOS)
		os.Exit(1)
	}

	// 执行命令
	if err := command.Start(); err != nil {
		fmt.Fprintf(os.Stderr, "错误: 打开日志文件夹失败: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("✅ 日志文件夹已在文件管理器中打开")
}

// 检查并提示 MaaFramework 配置
func checkAndPromptMaaFWConfig(cfg *config.Config) error {
	if cfg.MaaFW.LibDir != "" {
		return nil
	}

	// lib_dir 未配置
	fmt.Println()
	fmt.Println("══════════════════════════════════════════════════")
	fmt.Println("🔧 MaaFramework 初始配置")
	fmt.Println("══════════════════════════════════════════════════")
	fmt.Println("检测到 MaaFramework 已启用但尚未配置路径，请进行初始设置。")

	libDir := promptForPath(
		"📁 MaaFramework lib 路径",
		"MaaFramework Release 包解压后的 bin 文件夹路径\n"+
			"   其中应包含 MaaFramework.dll/.so 等库文件\n"+
			"   示例: C:\\MaaFramework\\bin 或 /opt/maaframework/bin",
		"",
	)

	if libDir != "" {
		absPath, err := filepath.Abs(libDir)
		if err != nil {
			return fmt.Errorf("解析 lib 路径失败: %w", err)
		}
		cfg.MaaFW.LibDir = absPath

		if _, err := os.Stat(absPath); os.IsNotExist(err) {
			fmt.Printf("⚠️  警告: 指定的路径不存在: %s\n", absPath)
		}

		if err := cfg.Save(); err != nil {
			return fmt.Errorf("保存配置失败: %w", err)
		}
		fmt.Println()
		fmt.Println("✅ 配置已保存")
		fmt.Println("══════════════════════════════════════════════════")
		fmt.Println()
	}

	return nil
}

// GitHub Release 响应结构
type GitHubRelease struct {
	TagName string `json:"tag_name"`
	HTMLURL string `json:"html_url"`
}

// 检查并显示更新提醒
func checkAndPrintUpdateNotice() {
	// 跳过开发版本的检查
	if Version == "dev" {
		logger.Debug("Update", "当前为开发版本，跳过更新检查")
		return
	}

	// 获取最新版本信息
	latestVersion, releaseURL, err := getLatestVersion()
	if err != nil {
		logger.Debug("Update", "检查更新失败: %v", err)
		return
	}

	// 比较版本号
	currentVersion := strings.TrimPrefix(Version, "v")
	latestVersion = strings.TrimPrefix(latestVersion, "v")

	// 使用语义化版本比较
	if compareVersion(latestVersion, currentVersion) > 0 {
		fmt.Println()
		fmt.Println("══════════════════════════════════════════════════")
		fmt.Println("🎉 发现新版本")
		fmt.Println("══════════════════════════════════════════════════")
		fmt.Printf("   当前版本: v%s\n", currentVersion)
		fmt.Printf("   最新版本: v%s\n", latestVersion)
		fmt.Println()
		fmt.Println("   下载地址:")
		fmt.Printf("   %s\n", releaseURL)
		fmt.Println("   快速更新指令:")
		utils.PrintInstallCommand()
		fmt.Println("══════════════════════════════════════════════════")
		fmt.Println()
	} else {
		logger.Debug("Update", "当前版本 v%s 已是最新版本 (最新: v%s)", currentVersion, latestVersion)
	}
}

// 获取最新版本信息
func getLatestVersion() (string, string, error) {
	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	resp, err := client.Get("https://api.github.com/repos/kqcoxn/MaaPipelineEditor/releases/latest")
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", "", fmt.Errorf("GitHub API 返回状态码: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", err
	}

	var release GitHubRelease
	if err := json.Unmarshal(body, &release); err != nil {
		return "", "", err
	}

	return release.TagName, release.HTMLURL, nil
}

// 显示路径信息
func showInfo(cmd *cobra.Command, args []string) {
	fmt.Println()
	fmt.Println("══════════════════════════════════════════════════")
	fmt.Println("📁 MPE Local Bridge 路径信息")
	fmt.Println("══════════════════════════════════════════════════")
	fmt.Println()
	fmt.Printf("🎯 运行模式:     %s\n", paths.GetModeName())
	fmt.Println()
	fmt.Println("📂 目录路径:")
	fmt.Printf("   数据目录:     %s\n", paths.GetDataDir())
	fmt.Printf("   配置文件:     %s\n", paths.GetConfigFile())
	fmt.Printf("   日志目录:     %s\n", paths.GetLogDir())
	fmt.Printf("   可执行文件:   %s\n", paths.GetExeDir())
	fmt.Println()
	fmt.Println("──────────────────────────────────────────────────")
	fmt.Println("💡 提示:")
	fmt.Println("   - 使用 --portable 参数可切换到便携模式")
	fmt.Println("   - 开发模式: 可执行文件旁存在 config/ 目录时自动启用")
	fmt.Println("   - 本地模式: 使用系统用户数据目录")
	fmt.Println("══════════════════════════════════════════════════")
	fmt.Println()
}

// compareVersion 比较两个语义化版本号
// 返回值: 1 表示 v1 > v2, -1 表示 v1 < v2, 0 表示 v1 == v2
func compareVersion(v1, v2 string) int {
	// 移除可能的 v 前缀
	v1 = strings.TrimPrefix(v1, "v")
	v2 = strings.TrimPrefix(v2, "v")

	// 分割版本号
	parts1 := strings.Split(v1, ".")
	parts2 := strings.Split(v2, ".")

	// 补齐到相同长度
	maxLen := len(parts1)
	if len(parts2) > maxLen {
		maxLen = len(parts2)
	}

	for len(parts1) < maxLen {
		parts1 = append(parts1, "0")
	}
	for len(parts2) < maxLen {
		parts2 = append(parts2, "0")
	}

	// 逐段比较
	for i := 0; i < maxLen; i++ {
		// 提取数字部分（忽略预发布标识）
		num1 := extractNumber(parts1[i])
		num2 := extractNumber(parts2[i])

		if num1 > num2 {
			return 1
		}
		if num1 < num2 {
			return -1
		}
	}

	return 0
}

// extractNumber 从版本号段中提取数字部分
func extractNumber(s string) int {
	// 移除非数字字符（如 -alpha, -beta 等）
	var numStr string
	for _, c := range s {
		if c >= '0' && c <= '9' {
			numStr += string(c)
		} else {
			break
		}
	}

	if numStr == "" {
		return 0
	}

	num := 0
	fmt.Sscanf(numStr, "%d", &num)
	return num
}
