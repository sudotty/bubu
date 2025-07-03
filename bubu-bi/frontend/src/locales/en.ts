import { TranslationKeys } from '../hooks/useI18n';

/**
 * English translation resources
 */
export const translations: TranslationKeys = {
  // Common
  common: {
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    warning: 'Warning',
    info: 'Info',
    confirm: 'Confirm',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    search: 'Search',
    filter: 'Filter',
    export: 'Export',
    import: 'Import',
    refresh: 'Refresh',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    submit: 'Submit',
    reset: 'Reset',
    clear: 'Clear',
    select: 'Select',
    selectAll: 'Select All',
    deselectAll: 'Deselect All',
    noData: 'No Data',
    noResults: 'No Results',
    total: 'Total',
    page: 'Page',
    of: 'of',
    items: 'items',
    perPage: 'per page',
  },
  
  // Table related
  table: {
    columns: 'Columns',
    rows: 'Rows',
    sort: 'Sort',
    sortAsc: 'Sort Ascending',
    sortDesc: 'Sort Descending',
    filter: 'Filter',
    search: 'Search',
    export: 'Export',
    settings: 'Settings',
    density: 'Density',
    compact: 'Compact',
    comfortable: 'Comfortable',
    spacious: 'Spacious',
    showColumns: 'Show Columns',
    hideColumns: 'Hide Columns',
    resetColumns: 'Reset Columns',
    noData: 'No Data Available',
    loading: 'Loading data...',
    error: 'Failed to load data',
    selected: 'selected',
    selectAll: 'Select All',
    deselectAll: 'Deselect All',
    actions: 'Actions',
    bulkActions: 'Bulk Actions',
    deleteSelected: 'Delete Selected',
    exportSelected: 'Export Selected',
    rowsPerPage: 'Rows per page',
    page: 'Page',
    of: 'of',
    firstPage: 'First Page',
    lastPage: 'Last Page',
    nextPage: 'Next Page',
    previousPage: 'Previous Page',
    goto: 'Go to',
    totalRows: 'total rows',
  },
  
  // Theme related
  theme: {
    theme: 'Theme',
    selectTheme: 'Select Theme',
    lightThemes: 'Light Themes',
    darkThemes: 'Dark Themes',
    colorfulThemes: 'Colorful Themes',
    minimalThemes: 'Minimal Themes',
    currentTheme: 'Current Theme',
    switchTheme: 'Switch Theme',
    themePreview: 'Theme Preview',
    auto: 'Auto',
    light: 'Light',
    dark: 'Dark',
    system: 'Follow System',
  },
  
  // Language related
  language: {
    language: 'Language',
    selectLanguage: 'Select Language',
    currentLanguage: 'Current Language',
    switchLanguage: 'Switch Language',
  },
  
  // Error messages
  errors: {
    networkError: 'Network connection error, please check your network settings',
    serverError: 'Server error, please try again later',
    notFound: 'The requested resource was not found',
    unauthorized: 'Unauthorized access, please login first',
    forbidden: 'Insufficient permissions to access',
    validationError: 'Data validation failed, please check your input',
    unknownError: 'Unknown error, please contact administrator',
  },
  
  // Success messages
  success: {
    saved: 'Saved successfully',
    deleted: 'Deleted successfully',
    updated: 'Updated successfully',
    created: 'Created successfully',
    imported: 'Imported successfully',
    exported: 'Exported successfully',
  },
};

export default translations;