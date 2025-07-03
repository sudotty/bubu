import { TranslationKeys } from '../hooks/useI18n';

/**
 * 日本語翻訳リソース
 */
export const translations: TranslationKeys = {
  // 共通
  common: {
    loading: '読み込み中...',
    error: 'エラー',
    success: '成功',
    warning: '警告',
    info: '情報',
    confirm: '確認',
    cancel: 'キャンセル',
    save: '保存',
    delete: '削除',
    edit: '編集',
    add: '追加',
    search: '検索',
    filter: 'フィルター',
    export: 'エクスポート',
    import: 'インポート',
    refresh: '更新',
    close: '閉じる',
    back: '戻る',
    next: '次へ',
    previous: '前へ',
    submit: '送信',
    reset: 'リセット',
    clear: 'クリア',
    select: '選択',
    selectAll: 'すべて選択',
    deselectAll: 'すべて選択解除',
    noData: 'データがありません',
    noResults: '検索結果がありません',
    total: '合計',
    page: 'ページ',
    of: '/',
    items: '件',
    perPage: 'ページあたり',
  },
  
  // テーブル関連
  table: {
    columns: '列',
    rows: '行',
    sort: 'ソート',
    sortAsc: '昇順',
    sortDesc: '降順',
    filter: 'フィルター',
    search: '検索',
    export: 'エクスポート',
    settings: '設定',
    density: '密度',
    compact: 'コンパクト',
    comfortable: '快適',
    spacious: 'ゆったり',
    showColumns: '列を表示',
    hideColumns: '列を非表示',
    resetColumns: '列をリセット',
    noData: 'データがありません',
    loading: 'データを読み込み中...',
    error: 'データの読み込みに失敗しました',
    selected: '選択済み',
    selectAll: 'すべて選択',
    deselectAll: 'すべて選択解除',
    actions: 'アクション',
    bulkActions: '一括操作',
    deleteSelected: '選択項目を削除',
    exportSelected: '選択項目をエクスポート',
    rowsPerPage: 'ページあたりの行数',
    page: 'ページ',
    of: '/',
    firstPage: '最初のページ',
    lastPage: '最後のページ',
    nextPage: '次のページ',
    previousPage: '前のページ',
    goto: 'ジャンプ',
    totalRows: '件のレコード',
  },
  
  // テーマ関連
  theme: {
    theme: 'テーマ',
    selectTheme: 'テーマを選択',
    lightThemes: 'ライトテーマ',
    darkThemes: 'ダークテーマ',
    colorfulThemes: 'カラフルテーマ',
    minimalThemes: 'ミニマルテーマ',
    currentTheme: '現在のテーマ',
    switchTheme: 'テーマを切り替え',
    themePreview: 'テーマプレビュー',
    auto: '自動',
    light: 'ライト',
    dark: 'ダーク',
    system: 'システムに従う',
  },
  
  // 言語関連
  language: {
    language: '言語',
    selectLanguage: '言語を選択',
    currentLanguage: '現在の言語',
    switchLanguage: '言語を切り替え',
  },
  
  // エラーメッセージ
  errors: {
    networkError: 'ネットワーク接続エラーです。ネットワーク設定を確認してください',
    serverError: 'サーバーエラーです。しばらくしてから再試行してください',
    notFound: '要求されたリソースが見つかりません',
    unauthorized: '認証されていません。まずログインしてください',
    forbidden: 'アクセス権限が不足しています',
    validationError: 'データ検証に失敗しました。入力内容を確認してください',
    unknownError: '不明なエラーです。管理者にお問い合わせください',
  },
  
  // 成功メッセージ
  success: {
    saved: '保存しました',
    deleted: '削除しました',
    updated: '更新しました',
    created: '作成しました',
    imported: 'インポートしました',
    exported: 'エクスポートしました',
  },
};

export default translations;