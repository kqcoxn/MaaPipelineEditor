package main

import (
	"embed"
	"log"
	"os"
	"runtime"

	"github.com/kqcoxn/MaaPipelineEditor/Extremer/internal/splash"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed build/appicon.png
var icon []byte

//go:embed all:frontend/dist
var assets embed.FS

var version = "1.0.1"

func main() {
	// 检测是否为开发模式
	exePath, err := os.Executable()
	if err != nil {
		log.Printf("获取可执行文件路径失败: %v", err)
	}
	devMode := err == nil && isDevMode(exePath)

	// Windows 平台且非开发模式下显示启动画面
	var sp splash.Splash
	if runtime.GOOS == "windows" && !devMode {
		cfg := splash.DefaultConfig()
		sp = splash.New(cfg)
		if err := sp.Show(); err != nil {
			log.Printf("启动画面显示失败: %v", err)
		}
	}

	app := NewApp()
	app.splash = sp

	err = wails.Run(&options.App{
		Title:            "MaaPipelineEditor",
		Width:            1280,
		Height:           800,
		MinWidth:         1024,
		MinHeight:        768,
		WindowStartState: options.Maximised,
		StartHidden:      runtime.GOOS == "windows" && !devMode,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 255, G: 255, B: 255, A: 255},
		OnStartup:        app.startup,
		OnDomReady:       app.domReady,
		OnShutdown:       app.shutdown,
		Bind: []interface{}{
			app,
		},
		Windows: &windows.Options{
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
			DisableWindowIcon:    false,
			Theme:                windows.SystemDefault,
		},
		Mac: &mac.Options{
			TitleBar: mac.TitleBarDefault(),
			About: &mac.AboutInfo{
				Title:   "MaaPipelineEditor",
				Message: "MAA Pipeline 可视化编辑器\n\nCopyright 2024 MaaXYZ",
				Icon:    icon,
			},
		},
		Linux: &linux.Options{
			Icon: icon,
		},
	})

	if err != nil {
		log.Fatal(err)
	}
}
