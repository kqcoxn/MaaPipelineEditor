package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"

	"github.com/kqcoxn/MaaPipelineExtremer/internal/config"
	"github.com/kqcoxn/MaaPipelineExtremer/internal/logger"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// 初始化日志
	log := logger.New()
	log.Info("启动 MaaPipelineExtremer...")

	// 加载配置
	cfg, err := config.Load()
	if err != nil {
		log.Warnf("加载配置失败，使用默认配置: %v", err)
		cfg = config.Default()
	}
	log.Info("读取配置完成: extremer.json")

	// 创建应用实例
	app := NewApp(cfg, log)

	// 创建 Wails 应用
	err = wails.Run(&options.App{
		Title:     "MaaPipelineExtremer",
		Width:     1280,
		Height:    800,
		MinWidth:  800,
		MinHeight: 600,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 255, G: 255, B: 255, A: 1},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Bind: []interface{}{
			app,
		},
		Windows: &windows.Options{
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
			DisableWindowIcon:    false,
		},
	})

	if err != nil {
		log.Fatalf("Wails 启动失败: %v", err)
	}
}
