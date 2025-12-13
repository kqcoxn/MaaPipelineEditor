package main

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/config"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/deps"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
	fileProtocol "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/protocol/file"
	mfwProtocol "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/protocol/mfw"
	utilityProtocol "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/protocol/utility"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/router"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	fileService "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/service/file"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/updater"
	"github.com/spf13/cobra"
)

// 命令行
var (
	configPath  string
	rootDir     string
	port        int
	logDir      string
	logLevel    string
	showVersion bool
	doUpdate    bool
)

var rootCmd = &cobra.Command{
	Use:     "mpelb",
	Short:   "⭐ MPE Local Bridge - 为 MaaPipelineEditor 构建本地的桥梁 🌉",
	Long:    `MPE Local Bridge 是连接本地各系统与 MaaPipelineEditor 前端的桥梁服务，目前支持文件管理功能，更多集成即将更新！`,
	Version: updater.GetVersion(),
	Run:     runServer,
}

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "配置管理命令",
	Long:  `管理 LocalBridge 配置，包括打开配置文件、设置 MaaFramework 路径等`,
	Run:   openConfig,
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

func init() {
	rootCmd.Flags().StringVar(&configPath, "config", "", "配置文件路径")
	rootCmd.Flags().StringVar(&rootDir, "root", "", "文件扫描根目录")
	rootCmd.Flags().IntVar(&port, "port", 0, "WebSocket 监听端口")
	rootCmd.Flags().StringVar(&logDir, "log-dir", "", "日志输出目录")
	rootCmd.Flags().StringVar(&logLevel, "log-level", "", "日志级别 (DEBUG, INFO, WARN, ERROR)")
	rootCmd.Flags().BoolVarP(&showVersion, "version", "v", false, "显示版本号")
	rootCmd.Flags().BoolVar(&doUpdate, "update", false, "检查并执行更新")

	// 添加子命令
	rootCmd.AddCommand(configCmd)

	// config 子命令
	configCmd.AddCommand(configOpenCmd)
	configCmd.AddCommand(setLibDirCmd)
	configCmd.AddCommand(setResourceDirCmd)

	configCmd.Flags().StringVar(&configPath, "config", "", "配置文件路径（默认为 config/default.json）")
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

	logger.Info("Main", "Local Bridge 启动中... 版本: %s", updater.GetVersion())
	logger.Info("Main", "根目录: %s", cfg.File.Root)
	logger.Info("Main", "监听端口: %d", cfg.Server.Port)

	// 检查并下载依赖
	if err := ensureDeps(cfg); err != nil {
		logger.Warn("Main", "依赖下载失败: %v (将继续启动但部分功能可能不可用)", err)
		fmt.Println()
		fmt.Println("⚠️  依赖下载失败，但程序将继续运行")
		fmt.Printf("   错误信息: %v\n", err)
		fmt.Println("   请检查网络连接或手动下载依赖")
		fmt.Printf("   手动下载地址: https://github.com/%s/%s/releases\n", "kqcoxn", "MaaPipelineEditor")
		fmt.Println()
	}

	// 检查 MaaFramework 配置
	if cfg.MaaFW.Enabled {
		if err := checkAndPromptMaaFWConfig(cfg); err != nil {
			logger.Error("Main", "MaaFramework 配置检查失败: %v", err)
			os.Exit(1)
		}
	}

	// 检查更新
	if cfg.Update.Enabled || doUpdate {
		go updater.CheckAndUpdate(cfg.Update.AutoUpdate || doUpdate, cfg.Update.ProxyURL)
	}

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

	// 创建 MFW 服务
	mfwSvc := mfw.NewService()
	// 初始化 MFW 服务
	if err := mfwSvc.Initialize(); err != nil {
		logger.Warn("Main", "MFW 服务初始化失败: %v (将继续启动但MFW功能可能不可用)", err)
	} else {
		logger.Info("Main", "MFW 服务初始化成功")
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

	// 注册 MFW 协议处理器
	mfwHandler := mfwProtocol.NewMFWHandler(mfwSvc)
	rt.RegisterHandler(mfwHandler)

	// 注册 Utility 协议处理器
	utilityHandler := utilityProtocol.NewUtilityHandler(mfwSvc, cfg.File.Root)
	rt.RegisterHandler(utilityHandler)

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

	// 关闭 MFW 服务
	if err := mfwSvc.Shutdown(); err != nil {
		logger.Error("Main", "MFW 服务关闭失败: %v", err)
	}

	logger.Info("Main", "Local Bridge 已退出")
}

// 打开配置文件
func openConfig(cmd *cobra.Command, args []string) {
	// 确定配置文件路径
	var cfgPath string
	if configPath != "" {
		cfgPath = configPath
	} else {
		// 使用默认配置文件路径
		defaultPath := filepath.Join("config", "default.json")
		if _, err := os.Stat(defaultPath); err == nil {
			cfgPath = defaultPath
		} else {
			// 尝试当前目录
			if _, err := os.Stat("default.json"); err == nil {
				cfgPath = "default.json"
			} else {
				fmt.Fprintf(os.Stderr, "错误: 找不到配置文件，请使用 --config 参数指定配置文件路径\n")
				os.Exit(1)
			}
		}
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
	}

	if err := cfg.SetMaaFWLibDir(libDir); err != nil {
		fmt.Fprintf(os.Stderr, "保存配置失败: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("✅ MaaFramework lib 路径已设置为: %s\n", libDir)
}

// 设置 OCR 资源路径
func setResourceDir(cmd *cobra.Command, args []string) {
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
				"   示例: C:\\MaaResource 或 /opt/maa-resource",
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
	}

	if err := cfg.SetMaaFWResourceDir(resourceDir); err != nil {
		fmt.Fprintf(os.Stderr, "保存配置失败: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("✅ OCR 资源路径已设置为: %s\n", resourceDir)
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

// 检查并提示 MaaFramework 配置
func checkAndPromptMaaFWConfig(cfg *config.Config) error {
	needSave := false

	// 检查 lib_dir
	if cfg.MaaFW.LibDir == "" {
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
			needSave = true

			if _, err := os.Stat(absPath); os.IsNotExist(err) {
				fmt.Printf("⚠️  警告: 指定的路径不存在: %s\n", absPath)
			}
		}
	}

	// 检查 resource_dir
	if cfg.MaaFW.ResourceDir == "" {
		resourceDir := promptForPath(
			"📁 OCR 资源路径",
			"model 文件夹所在目录，目录结构应为:\n"+
				"   <路径>/model/ocr/...\n"+
				"   示例: C:\\MaaResource 或 /opt/maa-resource",
			"",
		)

		if resourceDir != "" {
			absPath, err := filepath.Abs(resourceDir)
			if err != nil {
				return fmt.Errorf("解析资源路径失败: %w", err)
			}
			cfg.MaaFW.ResourceDir = absPath
			needSave = true

			if _, err := os.Stat(absPath); os.IsNotExist(err) {
				fmt.Printf("⚠️  警告: 指定的路径不存在: %s\n", absPath)
			}
		}
	}

	// 保存配置
	if needSave {
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

// 检查并确保依赖存在
func ensureDeps(cfg *config.Config) error {
	// 创建依赖下载器
	downloader, err := deps.NewDownloader(deps.DefaultDepsDir, cfg.Update.ProxyURL)
	if err != nil {
		return fmt.Errorf("创建依赖下载器失败: %w", err)
	}

	// 检查并下载缺失的依赖
	if err := downloader.EnsureDeps(); err != nil {
		return err
	}

	return nil
}
