# SQLite缓存系统设计文档

## 概述

本系统将原有的内存缓存迁移到SQLite数据库中，提供持久化、统一管理的缓存解决方案。缓存系统支持多种业务类型，具有过期管理、统计监控等功能。

## 系统架构

### 核心组件

1. **DatabaseService**: 底层数据库操作服务
2. **CacheService**: 高级缓存抽象服务
3. **App**: 应用层缓存管理API

### 数据库表结构

#### 1. 通用缓存表 (cache_entries)

```sql
CREATE TABLE IF NOT EXISTS cache_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cache_key TEXT NOT NULL,
    cache_type TEXT NOT NULL,
    cache_value TEXT NOT NULL,
    metadata TEXT,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cache_key, cache_type)
);
```

#### 2. 智能建议缓存表 (suggestion_cache)

```sql
CREATE TABLE IF NOT EXISTS suggestion_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_key TEXT NOT NULL UNIQUE,
    suggestions TEXT NOT NULL,
    ddl_hash TEXT,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 索引设计

```sql
-- 通用缓存索引
CREATE INDEX IF NOT EXISTS idx_cache_entries_type_key ON cache_entries(cache_type, cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_entries_expires ON cache_entries(expires_at);

-- 智能建议缓存索引
CREATE INDEX IF NOT EXISTS idx_suggestion_cache_expires ON suggestion_cache(expires_at);
```

## 缓存类型定义

系统支持以下缓存类型：

- `suggestion`: 智能建议缓存
- `query`: 查询结果缓存
- `schema`: 表结构缓存
- `analysis`: 数据分析缓存
- `report`: 报表缓存

## 使用示例

### 1. 智能建议缓存

```go
// 设置智能建议缓存
err := app.cacheService.SetSuggestionCache(
    "file123", 
    []string{"建议1", "建议2", "建议3"}, 
    "ddl_hash_value", 
    24*time.Hour,
)

// 获取智能建议缓存
suggestions, found, err := app.cacheService.GetSuggestionCache("file123", "ddl_hash_value")
if found {
    // 使用缓存的建议
    fmt.Println("缓存命中:", suggestions)
}
```

### 2. 通用缓存操作

```go
// 设置查询结果缓存
queryResult := &QueryResult{...}
err := app.cacheService.Set(
    CacheTypeQuery, 
    "query_hash", 
    queryResult, 
    1*time.Hour,
)

// 获取查询结果缓存
var result QueryResult
found, err := app.cacheService.Get(CacheTypeQuery, "query_hash", &result)
if found {
    // 使用缓存的查询结果
    fmt.Println("查询结果缓存命中")
}
```

### 3. 缓存管理

```go
// 获取缓存统计信息
stats, err := app.GetCacheStats()
fmt.Printf("活跃缓存数量: %d\n", stats["total_active_cache"])

// 清理过期缓存
err := app.ManualCleanExpiredCache()

// 按类型清理缓存
err := app.ClearCacheByType(CacheTypeQuery)

// 清理所有缓存
err := app.ClearAllCache()
```

## API接口

### 前端可调用的缓存管理API

1. `GetCacheStats()`: 获取缓存统计信息
2. `ClearSuggestionCache(fileKey)`: 清除指定文件的智能建议缓存
3. `ClearAllSuggestionCache()`: 清除所有智能建议缓存
4. `ClearCacheByType(cacheType)`: 按类型清除缓存
5. `ClearAllCache()`: 清除所有缓存
6. `ManualCleanExpiredCache()`: 手动清理过期缓存

## 特性优势

### 1. 持久化存储
- 缓存数据存储在SQLite数据库中，应用重启后缓存依然有效
- 避免了内存缓存在应用重启后丢失的问题

### 2. 统一管理
- 所有缓存类型使用统一的存储和管理机制
- 支持按类型、按键值进行精确管理

### 3. 过期管理
- 自动过期检查和清理机制
- 定期清理任务（每小时执行一次）
- 支持手动清理过期缓存

### 4. 性能优化
- 合理的索引设计，确保查询性能
- 异步缓存写入，不影响主业务流程
- DDL哈希验证，确保数据结构变化时缓存失效

### 5. 监控统计
- 详细的缓存统计信息
- 按类型统计活跃和过期缓存数量
- 支持缓存命中率分析

## 配置说明

### 缓存过期时间

- 智能建议缓存：24小时
- 查询结果缓存：1小时（可配置）
- 表结构缓存：6小时（可配置）
- 其他缓存：根据业务需求配置

### 清理策略

- 定期清理：每小时自动清理过期缓存
- 手动清理：支持通过API手动触发清理
- 启动清理：应用启动时清理过期缓存

## 迁移指南

### 从内存缓存迁移到SQLite缓存

1. **前端代码无需修改**：缓存逻辑在后端透明处理
2. **后端API保持兼容**：现有的缓存相关API接口保持不变
3. **性能提升**：持久化缓存减少重复计算，提升整体性能
4. **监控增强**：新增缓存统计和管理功能

### 注意事项

1. **数据库文件大小**：长期使用后需要定期清理或压缩数据库
2. **并发访问**：SQLite支持多读单写，适合当前应用场景
3. **备份策略**：缓存数据可以重新生成，通常不需要备份

## 未来扩展

1. **缓存预热**：应用启动时预加载常用缓存
2. **缓存分层**：结合内存缓存实现多级缓存
3. **缓存压缩**：对大型缓存数据进行压缩存储
4. **缓存同步**：支持多实例间的缓存同步
5. **缓存分析**：提供缓存使用情况的详细分析报告