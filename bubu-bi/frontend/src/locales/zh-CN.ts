import { TranslationKeys } from '../hooks/useI18n';

/**
 * 中文简体翻译资源
 */
export const translations: TranslationKeys = {
  // 通用
  common: {
    loading: '加载中...',
    error: '错误',
    success: '成功',
    warning: '警告',
    info: '信息',
    confirm: '确认',
    cancel: '取消',
    save: '保存',
    delete: '删除',
    edit: '编辑',
    add: '添加',
    search: '搜索',
    filter: '筛选',
    export: '导出',
    import: '导入',
    refresh: '刷新',
    close: '关闭',
    back: '返回',
    next: '下一步',
    previous: '上一步',
    submit: '提交',
    reset: '重置',
    clear: '清空',
    select: '选择',
    selectAll: '全选',
    deselectAll: '取消全选',
    noData: '暂无数据',
    noResults: '无搜索结果',
    total: '共',
    page: '页',
    of: '/',
    items: '条',
    perPage: '每页',
  },
  
  // 表格相关
  table: {
    columns: '列',
    rows: '行',
    sort: '排序',
    sortAsc: '升序',
    sortDesc: '降序',
    filter: '筛选',
    search: '搜索',
    export: '导出',
    settings: '设置',
    density: '密度',
    compact: '紧凑',
    comfortable: '舒适',
    spacious: '宽松',
    showColumns: '显示列',
    hideColumns: '隐藏列',
    resetColumns: '重置列',
    noData: '暂无数据',
    loading: '数据加载中...',
    error: '数据加载失败',
    selected: '已选择',
    selectAll: '全选',
    deselectAll: '取消全选',
    actions: '操作',
    bulkActions: '批量操作',
    deleteSelected: '删除选中项',
    exportSelected: '导出选中项',
    rowsPerPage: '每页显示',
    page: '第',
    of: '页，共',
    firstPage: '首页',
    lastPage: '末页',
    nextPage: '下一页',
    previousPage: '上一页',
    goto: '跳转到',
    totalRows: '条记录',
  },
  
  // 主题相关
  theme: {
    theme: '主题',
    selectTheme: '选择主题',
    lightThemes: '浅色主题',
    darkThemes: '深色主题',
    colorfulThemes: '彩色主题',
    minimalThemes: '简约主题',
    currentTheme: '当前主题',
    switchTheme: '切换主题',
    themePreview: '主题预览',
    auto: '自动',
    light: '浅色',
    dark: '深色',
    system: '跟随系统',
  },
  
  // 语言相关
  language: {
    language: '语言',
    selectLanguage: '选择语言',
    currentLanguage: '当前语言',
    switchLanguage: '切换语言',
  },
  
  // 错误消息
  errors: {
    networkError: '网络连接错误，请检查网络设置',
    serverError: '服务器错误，请稍后重试',
    notFound: '请求的资源不存在',
    unauthorized: '未授权访问，请先登录',
    forbidden: '权限不足，无法访问',
    validationError: '数据验证失败，请检查输入',
    unknownError: '未知错误，请联系管理员',
  },
  
  // 成功消息
  success: {
    saved: '保存成功',
    deleted: '删除成功',
    updated: '更新成功',
    created: '创建成功',
    imported: '导入成功',
    exported: '导出成功',
  },
};

export default translations;