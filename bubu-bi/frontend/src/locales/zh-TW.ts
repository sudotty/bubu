import { TranslationKeys } from '../hooks/useI18n';

/**
 * 繁體中文翻譯資源
 */
export const translations: TranslationKeys = {
  // 通用
  common: {
    loading: '載入中...',
    error: '錯誤',
    success: '成功',
    warning: '警告',
    info: '資訊',
    confirm: '確認',
    cancel: '取消',
    save: '儲存',
    delete: '刪除',
    edit: '編輯',
    add: '新增',
    search: '搜尋',
    filter: '篩選',
    export: '匯出',
    import: '匯入',
    refresh: '重新整理',
    close: '關閉',
    back: '返回',
    next: '下一步',
    previous: '上一步',
    submit: '提交',
    reset: '重設',
    clear: '清空',
    select: '選擇',
    selectAll: '全選',
    deselectAll: '取消全選',
    noData: '暫無資料',
    noResults: '無搜尋結果',
    total: '共',
    page: '頁',
    of: '/',
    items: '筆',
    perPage: '每頁',
  },
  
  // 表格相關
  table: {
    columns: '欄',
    rows: '列',
    sort: '排序',
    sortAsc: '升序',
    sortDesc: '降序',
    filter: '篩選',
    search: '搜尋',
    export: '匯出',
    settings: '設定',
    density: '密度',
    compact: '緊湊',
    comfortable: '舒適',
    spacious: '寬鬆',
    showColumns: '顯示欄位',
    hideColumns: '隱藏欄位',
    resetColumns: '重設欄位',
    noData: '暫無資料',
    loading: '資料載入中...',
    error: '資料載入失敗',
    selected: '已選擇',
    selectAll: '全選',
    deselectAll: '取消全選',
    actions: '操作',
    bulkActions: '批次操作',
    deleteSelected: '刪除選中項',
    exportSelected: '匯出選中項',
    rowsPerPage: '每頁顯示',
    page: '第',
    of: '頁，共',
    firstPage: '首頁',
    lastPage: '末頁',
    nextPage: '下一頁',
    previousPage: '上一頁',
    goto: '跳轉到',
    totalRows: '筆記錄',
  },
  
  // 主題相關
  theme: {
    theme: '主題',
    selectTheme: '選擇主題',
    lightThemes: '淺色主題',
    darkThemes: '深色主題',
    colorfulThemes: '彩色主題',
    minimalThemes: '簡約主題',
    currentTheme: '目前主題',
    switchTheme: '切換主題',
    themePreview: '主題預覽',
    auto: '自動',
    light: '淺色',
    dark: '深色',
    system: '跟隨系統',
  },
  
  // 語言相關
  language: {
    language: '語言',
    selectLanguage: '選擇語言',
    currentLanguage: '目前語言',
    switchLanguage: '切換語言',
  },
  
  // 錯誤訊息
  errors: {
    networkError: '網路連線錯誤，請檢查網路設定',
    serverError: '伺服器錯誤，請稍後重試',
    notFound: '請求的資源不存在',
    unauthorized: '未授權存取，請先登入',
    forbidden: '權限不足，無法存取',
    validationError: '資料驗證失敗，請檢查輸入',
    unknownError: '未知錯誤，請聯絡管理員',
  },
  
  // 成功訊息
  success: {
    saved: '儲存成功',
    deleted: '刪除成功',
    updated: '更新成功',
    created: '建立成功',
    imported: '匯入成功',
    exported: '匯出成功',
  },
};

export default translations;