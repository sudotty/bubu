export interface File {
  id: number;
  filename: string;
  file_path: string;
  file_type: string;
  upload_time: string;
  file_size: number;
  status: string;
}

export type ViewType = 'files' | 'tables' | 'history';



export interface TableClassification {
  systemTables: string[];
  userTables: string[];
  filteredSystemTables: string[];
}

export interface SystemInfo {
  upload_path: string;
  database_path: string;
  upload_size: number;
  database_size: number;
}