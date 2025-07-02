package main

import (
	"embed"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// 初始化配置
	if err := InitConfig(""); err != nil {
		log.Fatalf("初始化配置失败: %v", err)
	}

	// 创建实例管理器
	instanceManager, err := NewInstanceManager()
	if err != nil {
		log.Fatalf("创建实例管理器失败: %v", err)
	}

	// 检查单例实例
	if err := instanceManager.CheckSingleInstance(); err != nil {
		log.Printf("应用启动失败: %v", err)
		os.Exit(1)
	}

	// 检查安装状态
	installInfo, err := instanceManager.CheckInstallation()
	if err != nil {
		log.Printf("检查安装状态失败: %v", err)
	} else {
		if installInfo.IsFirstInstall {
			log.Println("检测到首次安装，正在初始化...")
			// 标记为已安装
			if err := instanceManager.MarkAsInstalled(); err != nil {
				log.Printf("标记安装状态失败: %v", err)
			}
		} else {
			log.Printf("应用已安装，安装时间: %v", installInfo.InstallTime.Format("2006-01-02 15:04:05"))
		}
	}

	// 设置优雅退出处理
	setupGracefulShutdown(instanceManager)

	// Create an instance of the app structure
	app := NewApp()
	// 设置实例管理器
	app.SetInstanceManager(instanceManager)

	// Create application with options
	err = wails.Run(&options.App{
		Title:  "BuBu BI - 智能数据分析助手",
		Width:  1200,
		Height: 800,
		MinWidth:  800,
		MinHeight: 600,
		MaxWidth:  0, // 0 表示无限制
		MaxHeight: 0, // 0 表示无限制
		WindowStartState: options.Maximised, // 启动时最大化窗口
		DisableResize: false, // 允许调整窗口大小
		// 窗口管理优化
		HideWindowOnClose: true, // 关闭时隐藏到托盘而不是退出
		AlwaysOnTop: false,
		// 系统托盘配置
		Menu: app.ApplicationMenu(),
		// 原生通知支持
		OnDomReady: app.OnDomReady,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}

	// 应用退出时清理资源
	instanceManager.Cleanup()
}

// setupGracefulShutdown 设置优雅退出处理
func setupGracefulShutdown(instanceManager *InstanceManager) {
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-c
		log.Println("正在优雅退出应用...")
		instanceManager.Cleanup()
		os.Exit(0)
	}()
}
