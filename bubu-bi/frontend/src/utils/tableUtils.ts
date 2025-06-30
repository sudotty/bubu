/**
 * 表格分类工具函数
 * 统一管理用户表格和系统表格的识别逻辑
 */

/**
 * 判断是否为系统表格
 * @param tableName 表格名称
 * @returns 是否为系统表格
 */
export const isSystemTable = (tableName: string): boolean => {
	const table = tableName.toLowerCase();

	// SQLite 系统表
	if (
		table.startsWith('sqlite_') ||
		table === 'sqlite_master' ||
		table === 'sqlite_sequence'
	) {
		return true;
	}

	// 系统前缀表
	if (table.startsWith('sys_') || table.startsWith('__')) {
		return true;
	}

	// 临时和备份表
	if (table.includes('_temp_') || table.includes('_backup_')) {
		return true;
	}

	// 数据库结构相关表
	if (
		table.includes('schema') ||
		table.includes('index') ||
		table.includes('trigger') ||
		table.includes('view')
	) {
		return true;
	}

	// 应用系统表（根据用户反馈添加）
	const systemTableNames = [
		'query_templates', // 查询模板表
		'template_usage_history', // 模板使用历史表
		'llm_processing_logs', // LLM处理日志表
		'components', // 组件表
		'execution_history', // 执行历史表
		'files', // 文件管理表
		'query_history', // 查询历史表
		'user_preferences', // 用户偏好表
		'system_config', // 系统配置表
		'audit_logs', // 审计日志表
		'session_data', // 会话数据表
		'cache_data', // 缓存数据表
	];

	return systemTableNames.includes(table);
};

/**
 * 获取系统表格列表
 * @param tables 所有表格列表
 * @returns 系统表格列表
 */
export const getSystemTables = (tables: string[]): string[] => {
	return tables.filter((table) => isSystemTable(table));
};

/**
 * 获取用户表格列表
 * @param tables 所有表格列表
 * @param searchTerm 搜索关键词
 * @returns 用户表格列表
 */
export const getUserTables = (
	tables: string[],
	searchTerm: string = '',
): string[] => {
	return tables
		.filter((table) => !isSystemTable(table))
		.filter((table) => table.toLowerCase().includes(searchTerm.toLowerCase()));
};

/**
 * 获取过滤后的系统表格列表
 * @param tables 所有表格列表
 * @param searchTerm 搜索关键词
 * @returns 过滤后的系统表格列表
 */
export const getFilteredSystemTables = (
	tables: string[],
	searchTerm: string = '',
): string[] => {
	return getSystemTables(tables).filter((table) =>
		table.toLowerCase().includes(searchTerm.toLowerCase()),
	);
};

import type { TableClassification } from '../types';

/**
 * 对表格进行分类
 * @param tables 所有表格列表
 * @param searchTerm 搜索关键词
 * @returns 表格分类结果
 */
export const classifyTables = (
	tables: string[],
	searchTerm: string = '',
): TableClassification => {
	const systemTables = getSystemTables(tables);
	const userTables = getUserTables(tables, searchTerm);
	const filteredSystemTables = getFilteredSystemTables(tables, searchTerm);

	return {
		systemTables,
		userTables,
		filteredSystemTables,
	};
};
