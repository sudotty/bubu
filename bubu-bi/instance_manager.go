package main

import (
	"fmt"
	"net"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"syscall"
	"time"
)

const (
	// 应用单例端口，用于检测是否已有实例运行
	SINGLETON_PORT = 23456
	// 锁文件名
	LOCK_FILE_NAME = ".bubu.lock"
	// 安装标记文件名
	INSTALL_MARKER = ".bubu.installed"
)

// InstanceManager 实例管理器
type InstanceManager struct {
	lockFile   string
	listener   net.Listener
	appDataDir string
}

// NewInstanceManager 创建实例管理器
func NewInstanceManager() (*InstanceManager, error) {
	// 获取应用数据目录
	appDataDir, err := getAppDataDir()
	if err != nil {
		return nil, fmt.Errorf("获取应用数据目录失败: %v", err)
	}

	// 确保目录存在
	if err := os.MkdirAll(appDataDir, 0755); err != nil {
		return nil, fmt.Errorf("创建应用数据目录失败: %v", err)
	}

	lockFile := filepath.Join(appDataDir, LOCK_FILE_NAME)

	return &InstanceManager{
		lockFile:   lockFile,
		appDataDir: appDataDir,
	}, nil
}

// CheckSingleInstance 检查是否为单例实例
func (im *InstanceManager) CheckSingleInstance() error {
	// 方法1: 尝试绑定端口
	if err := im.tryBindPort(); err != nil {
		return fmt.Errorf("应用已在运行中，请检查系统托盘或任务管理器")
	}

	// 方法2: 创建锁文件
	if err := im.createLockFile(); err != nil {
		return fmt.Errorf("无法创建应用锁文件: %v", err)
	}

	return nil
}

// tryBindPort 尝试绑定单例端口
func (im *InstanceManager) tryBindPort() error {
	listener, err := net.Listen("tcp", fmt.Sprintf(":%d", SINGLETON_PORT))
	if err != nil {
		return err
	}
	im.listener = listener
	return nil
}

// createLockFile 创建锁文件
func (im *InstanceManager) createLockFile() error {
	// 检查锁文件是否存在
	if _, err := os.Stat(im.lockFile); err == nil {
		// 锁文件存在，检查进程是否还在运行
		if im.isProcessRunning() {
			return fmt.Errorf("应用已在运行")
		}
		// 进程不在运行，删除旧的锁文件
		os.Remove(im.lockFile)
	}

	// 创建新的锁文件，写入当前进程ID
	pid := os.Getpid()
	return os.WriteFile(im.lockFile, []byte(strconv.Itoa(pid)), 0644)
}

// isProcessRunning 检查锁文件中的进程是否还在运行
func (im *InstanceManager) isProcessRunning() bool {
	data, err := os.ReadFile(im.lockFile)
	if err != nil {
		return false
	}

	pid, err := strconv.Atoi(string(data))
	if err != nil {
		return false
	}

	// 检查进程是否存在
	process, err := os.FindProcess(pid)
	if err != nil {
		return false
	}

	// 在不同操作系统上检查进程状态
	if runtime.GOOS == "windows" {
		// Windows上使用Signal(0)检查
		err = process.Signal(syscall.Signal(0))
		return err == nil
	} else {
		// Unix系统上使用kill(pid, 0)检查
		err = process.Signal(syscall.Signal(0))
		return err == nil
	}
}

// CheckInstallation 检查安装状态，防止重复安装
func (im *InstanceManager) CheckInstallation() (*InstallationInfo, error) {
	markerFile := filepath.Join(im.appDataDir, INSTALL_MARKER)

	// 检查安装标记文件
	if _, err := os.Stat(markerFile); os.IsNotExist(err) {
		// 首次安装
		return &InstallationInfo{
			IsFirstInstall: true,
			InstallTime:    time.Now(),
		}, nil
	}

	// 读取安装信息
	data, err := os.ReadFile(markerFile)
	if err != nil {
		return nil, fmt.Errorf("读取安装信息失败: %v", err)
	}

	// 解析安装时间
	installTime, err := time.Parse(time.RFC3339, string(data))
	if err != nil {
		// 如果解析失败，使用当前时间
		installTime = time.Now()
	}

	return &InstallationInfo{
		IsFirstInstall: false,
		InstallTime:    installTime,
	}, nil
}

// MarkAsInstalled 标记应用已安装
func (im *InstanceManager) MarkAsInstalled() error {
	markerFile := filepath.Join(im.appDataDir, INSTALL_MARKER)
	installTime := time.Now().Format(time.RFC3339)
	return os.WriteFile(markerFile, []byte(installTime), 0644)
}

// Cleanup 清理资源
func (im *InstanceManager) Cleanup() {
	// 关闭端口监听
	if im.listener != nil {
		im.listener.Close()
	}

	// 删除锁文件
	if im.lockFile != "" {
		os.Remove(im.lockFile)
	}
}

// InstallationInfo 安装信息
type InstallationInfo struct {
	IsFirstInstall bool      `json:"isFirstInstall"`
	InstallTime    time.Time `json:"installTime"`
}

// getAppDataDir 获取应用数据目录
func getAppDataDir() (string, error) {
	var appDataDir string

	switch runtime.GOOS {
	case "windows":
		// Windows: %APPDATA%\bubu
		appData := os.Getenv("APPDATA")
		if appData == "" {
			return "", fmt.Errorf("无法获取APPDATA环境变量")
		}
		appDataDir = filepath.Join(appData, "bubu")
	case "darwin":
		// macOS: ~/Library/Application Support/bubu
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		appDataDir = filepath.Join(homeDir, "Library", "Application Support", "bubu")
	default:
		// Linux: ~/.local/share/bubu
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		appDataDir = filepath.Join(homeDir, ".local", "share", "bubu")
	}

	return appDataDir, nil
}

// GetAppVersion 获取应用版本（从编译时注入或配置文件读取）
func GetAppVersion() string {
	// 这里可以从编译时注入的变量或配置文件中读取版本号
	// 示例：通过ldflags在编译时注入版本号
	// go build -ldflags "-X main.Version=1.0.0"
	return "1.0.0" // 默认版本
}
