# 实例管理和防重复安装功能

本文档描述了为 bubu 应用实现的实例管理和防重复安装功能。

## 功能概述

### 1. 防止多进程启动（单例模式）

应用启动时会检查是否已有实例在运行，通过以下机制实现：

- **端口绑定检查**：尝试绑定特定端口（23456），如果端口已被占用则说明有实例在运行
- **锁文件机制**：在应用数据目录创建 `.bubu.lock` 文件，记录当前进程ID
- **进程存活检查**：检查锁文件中记录的进程ID是否仍在运行

### 2. 防止重复安装

通过安装标记文件跟踪应用的安装状态：

- **安装标记文件**：`.bubu.installed` 文件记录首次安装时间
- **安装状态检查**：区分首次安装和重复启动
- **安装信息追踪**：记录安装时间等元数据

## 技术实现

### 核心文件

1. **`instance_manager.go`** - 实例管理器核心实现
2. **`main.go`** - 集成实例管理功能
3. **`app.go`** - 提供前端API接口
4. **`instance_manager_test.go`** - 单元测试

### 关键组件

#### InstanceManager 结构体

```go
type InstanceManager struct {
    lockFile   string        // 锁文件路径
    listener   net.Listener  // 端口监听器
    appDataDir string        // 应用数据目录
}
```

#### 主要方法

- `CheckSingleInstance()` - 检查单例实例
- `CheckInstallation()` - 检查安装状态
- `MarkAsInstalled()` - 标记为已安装
- `Cleanup()` - 清理资源

### 应用数据目录

根据不同操作系统使用标准目录：

- **macOS**: `~/Library/Application Support/bubu`
- **Windows**: `%APPDATA%\bubu`
- **Linux**: `~/.local/share/bubu`

## API 接口

为前端提供以下API接口：

### 1. 获取安装信息

```go
func (a *App) GetInstallationInfo() (*InstallationInfo, error)
```

返回安装状态和安装时间信息。

### 2. 获取应用版本

```go
func (a *App) GetAppVersion() string
```

返回当前应用版本号。

### 3. 检查更新

```go
func (a *App) CheckForUpdates() (*UpdateInfo, error)
```

检查是否有可用更新（预留接口）。

### 4. 重启应用

```go
func (a *App) RestartApplication() error
```

用于更新后重启应用。

## 数据结构

### InstallationInfo

```go
type InstallationInfo struct {
    IsFirstInstall bool      `json:"isFirstInstall"`
    InstallTime    time.Time `json:"installTime"`
}
```

### UpdateInfo

```go
type UpdateInfo struct {
    CurrentVersion string `json:"currentVersion"`
    LatestVersion  string `json:"latestVersion"`
    HasUpdate      bool   `json:"hasUpdate"`
    UpdateURL      string `json:"updateUrl"`
    ReleaseNotes   string `json:"releaseNotes"`
}
```

## 启动流程

1. **创建实例管理器**
2. **检查单例实例** - 如果已有实例运行则退出
3. **检查安装状态** - 区分首次安装和正常启动
4. **设置优雅退出处理** - 监听系统信号
5. **启动应用主体**
6. **清理资源** - 应用退出时清理锁文件和端口

## 错误处理

- **重复启动**：显示友好提示信息并退出
- **权限问题**：尝试创建应用数据目录，失败时给出明确错误信息
- **资源清理**：确保异常退出时也能正确清理资源

## 测试

运行单元测试验证功能：

```bash
go test -v ./...
```

测试覆盖：
- 单例实例检查
- 安装状态检查
- 应用数据目录获取
- 版本信息获取

## 构建和部署

```bash
# 构建应用
wails build

# 生成的应用位于
./build/bin/bubu.app
```

## 安全考虑

1. **权限最小化**：只在用户数据目录操作，不需要管理员权限
2. **进程检查**：安全地检查进程状态，避免误杀其他进程
3. **文件权限**：锁文件和标记文件使用适当的文件权限
4. **异常处理**：妥善处理各种异常情况，避免资源泄露

## 未来扩展

1. **自动更新**：基于现有的更新检查接口实现完整的自动更新功能
2. **配置管理**：扩展应用数据目录用于存储用户配置
3. **日志管理**：在应用数据目录中管理应用日志
4. **备份恢复**：利用安装信息实现数据备份和恢复功能