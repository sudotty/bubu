package main

import (
	"encoding/json"
	"fmt"
	"log"
	"time"
)

// CacheService 缓存服务
type CacheService struct {
	dbService *DatabaseService
}

// NewCacheService 创建缓存服务
func NewCacheService(dbService *DatabaseService) *CacheService {
	return &CacheService{
		dbService: dbService,
	}
}

// CacheType 缓存类型常量
const (
	CacheTypeQuery      = "query"          // 查询结果缓存
	CacheTypeSchema     = "schema"         // 表结构缓存
	CacheTypeAnalysis   = "analysis"       // 数据分析缓存
	CacheTypeReport     = "report"         // 报表缓存
)

// === 通用缓存操作 ===

// Set 设置缓存（通用方法）
func (cs *CacheService) Set(cacheType, key string, value interface{}, ttl time.Duration, metadata ...string) error {
	// 序列化值
	valueJSON, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("序列化缓存值失败: %v", err)
	}

	// 处理元数据
	var metadataStr string
	if len(metadata) > 0 {
		metadataStr = metadata[0]
	}

	// 计算过期时间
	expiresAt := time.Now().Add(ttl)

	return cs.dbService.SetCache(key, cacheType, string(valueJSON), metadataStr, expiresAt)
}

// Get 获取缓存（通用方法）
func (cs *CacheService) Get(cacheType, key string, result interface{}) (bool, error) {
	entry, err := cs.dbService.GetCache(key, cacheType)
	if err != nil {
		return false, err
	}

	if entry == nil {
		return false, nil // 缓存未命中
	}

	// 反序列化值
	err = json.Unmarshal([]byte(entry.CacheValue), result)
	if err != nil {
		return false, fmt.Errorf("反序列化缓存值失败: %v", err)
	}

	return true, nil
}

// Delete 删除缓存
func (cs *CacheService) Delete(cacheType, key string) error {
	return cs.dbService.DeleteCache(key, cacheType)
}

// === 专用缓存方法 ===



// SetQueryCache 设置查询结果缓存
func (cs *CacheService) SetQueryCache(queryHash string, result *QueryResult, ttl time.Duration) error {
	return cs.Set(CacheTypeQuery, queryHash, result, ttl)
}

// GetQueryCache 获取查询结果缓存
func (cs *CacheService) GetQueryCache(queryHash string) (*QueryResult, bool, error) {
	var result QueryResult
	found, err := cs.Get(CacheTypeQuery, queryHash, &result)
	if err != nil || !found {
		return nil, found, err
	}
	return &result, true, nil
}

// SetSchemaCache 设置表结构缓存
func (cs *CacheService) SetSchemaCache(tableName string, schema interface{}, ttl time.Duration) error {
	return cs.Set(CacheTypeSchema, tableName, schema, ttl)
}

// GetSchemaCache 获取表结构缓存
func (cs *CacheService) GetSchemaCache(tableName string, result interface{}) (bool, error) {
	return cs.Get(CacheTypeSchema, tableName, result)
}

// === 缓存统计和管理 ===

// GetStats 获取缓存统计信息
func (cs *CacheService) GetStats() (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// 按类型统计活跃缓存
	cacheTypes := []string{CacheTypeQuery, CacheTypeSchema, CacheTypeAnalysis, CacheTypeReport}
	for _, cacheType := range cacheTypes {
		var count int
		err := cs.dbService.db.QueryRow(
			"SELECT COUNT(*) FROM cache_entries WHERE cache_type = ? AND expires_at > CURRENT_TIMESTAMP",
			cacheType).Scan(&count)
		if err != nil {
			log.Printf("获取缓存类型 %s 统计失败: %v", cacheType, err)
			continue
		}
		stats[cacheType+"_count"] = count
	}



	// 总体统计
	var totalActive, totalExpired int
	cs.dbService.db.QueryRow(
		"SELECT COUNT(*) FROM cache_entries WHERE expires_at > CURRENT_TIMESTAMP").Scan(&totalActive)
	cs.dbService.db.QueryRow(
		"SELECT COUNT(*) FROM cache_entries WHERE expires_at <= CURRENT_TIMESTAMP").Scan(&totalExpired)

	stats["total_active_cache"] = totalActive
	stats["total_expired_cache"] = totalExpired

	return stats, nil
}

// CleanExpired 清理过期缓存
func (cs *CacheService) CleanExpired() error {
	// 清理通用缓存
	err := cs.dbService.ClearExpiredCache()
	if err != nil {
		return fmt.Errorf("清理过期通用缓存失败: %v", err)
	}



	log.Printf("缓存清理完成")
	return nil
}

// ClearByType 按类型清理缓存
func (cs *CacheService) ClearByType(cacheType string) error {
	_, err := cs.dbService.db.Exec("DELETE FROM cache_entries WHERE cache_type = ?", cacheType)
	return err
}

// ClearAll 清理所有缓存
func (cs *CacheService) ClearAll() error {
	_, err := cs.dbService.db.Exec("DELETE FROM cache_entries")
	if err != nil {
		return err
	}

	return err
}