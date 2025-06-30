package main

import (
	"path/filepath"
	"testing"
	"time"
)

func TestInstanceManager(t *testing.T) {
	// 创建临时目录用于测试
	tempDir := t.TempDir()

	// 创建实例管理器
	im := &InstanceManager{
		lockFile:   filepath.Join(tempDir, LOCK_FILE_NAME),
		appDataDir: tempDir,
	}

	// 测试首次检查单例实例
	err := im.CheckSingleInstance()
	if err != nil {
		t.Fatalf("首次检查单例实例失败: %v", err)
	}

	// 测试重复检查单例实例（应该失败）
	im2 := &InstanceManager{
		lockFile:   filepath.Join(tempDir, LOCK_FILE_NAME),
		appDataDir: tempDir,
	}
	err = im2.CheckSingleInstance()
	if err == nil {
		t.Error("重复检查单例实例应该失败，但没有失败")
	}

	// 清理第一个实例
	im.Cleanup()

	// 现在第二个实例应该可以成功
	err = im2.CheckSingleInstance()
	if err != nil {
		t.Fatalf("清理后检查单例实例失败: %v", err)
	}

	// 清理第二个实例
	im2.Cleanup()
}

func TestInstallationCheck(t *testing.T) {
	// 创建临时目录用于测试
	tempDir := t.TempDir()

	// 创建实例管理器
	im := &InstanceManager{
		lockFile:   filepath.Join(tempDir, LOCK_FILE_NAME),
		appDataDir: tempDir,
	}

	// 测试首次安装检查
	installInfo, err := im.CheckInstallation()
	if err != nil {
		t.Fatalf("检查安装状态失败: %v", err)
	}

	if !installInfo.IsFirstInstall {
		t.Error("应该是首次安装，但检测结果不是")
	}

	// 标记为已安装
	err = im.MarkAsInstalled()
	if err != nil {
		t.Fatalf("标记安装状态失败: %v", err)
	}

	// 再次检查安装状态
	installInfo2, err := im.CheckInstallation()
	if err != nil {
		t.Fatalf("再次检查安装状态失败: %v", err)
	}

	if installInfo2.IsFirstInstall {
		t.Error("应该不是首次安装，但检测结果是首次安装")
	}

	// 检查安装时间是否合理（应该在最近1分钟内）
	if time.Since(installInfo2.InstallTime) > time.Minute {
		t.Error("安装时间不合理")
	}
}

func TestGetAppDataDir(t *testing.T) {
	appDataDir, err := getAppDataDir()
	if err != nil {
		t.Fatalf("获取应用数据目录失败: %v", err)
	}

	if appDataDir == "" {
		t.Error("应用数据目录不能为空")
	}

	// 检查目录路径是否包含应用名称
	if !filepath.IsAbs(appDataDir) {
		t.Error("应用数据目录应该是绝对路径")
	}

	t.Logf("应用数据目录: %s", appDataDir)
}

func TestGetAppVersion(t *testing.T) {
	version := GetAppVersion()
	if version == "" {
		t.Error("应用版本不能为空")
	}

	t.Logf("应用版本: %s", version)
}
