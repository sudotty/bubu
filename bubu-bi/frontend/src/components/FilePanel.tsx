
import { useRef, useState, useCallback, useMemo } from 'react';
import { UploadFile } from '../../wailsjs/go/main/App';
import FileList from './FileList';
import TableList from './TableList';
import type { File, ViewType } from '../types';

interface FilePanelProps {
  files: File[];
  tables: string[];
  selectedTable: string;
  onTableSelect: (tableName: string) => void;
  onRefresh: () => void;
}

const FilePanel = ({ files, tables, selectedTable, onTableSelect, onRefresh }: FilePanelProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentView, setCurrentView] = useState<ViewType>('files');
  const [favorites, setFavorites] = useState<Set<number>>(new Set());

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    const toast = document.createElement('div');
    toast.className = 'toast toast-top toast-end';
    toast.innerHTML = `
      <div class="alert alert-${type}">
        <span>${type === 'success' ? '✅' : '❌'} ${message}</span>
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => document.body.removeChild(toast), 3000);
  }, []);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const base64String = btoa(String.fromCharCode(...uint8Array));
      
      await UploadFile(file.name, base64String);
      showToast('文件上传成功', 'success');
      onRefresh();
    } catch (error) {
      console.error('Upload error:', error);
      showToast('文件上传失败', 'error');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [onRefresh, showToast]);
  const toggleFavorite = useCallback((fileId: number) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(fileId)) {
        newFavorites.delete(fileId);
      } else {
        newFavorites.add(fileId);
      }
      return newFavorites;
    });
  }, []);

  const filteredFiles = useMemo(() => 
    files.filter(file => 
      file.filename.toLowerCase().includes(searchTerm.toLowerCase())
    ), [files, searchTerm]
  );

  const handleViewTable = useCallback((tableName: string) => {
    onTableSelect(tableName);
  }, [onTableSelect]);

  const handleViewFiles = useCallback(() => {
    setCurrentView('files');
  }, []);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);



  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="flex-shrink-0 p-4 border-b border-base-300">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-base-content">数据管理</h2>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleUploadClick}
          >
            📤 上传文件
          </button>
        </div>
        
        {/* 搜索框 */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="搜索文件或表..."
            className="input input-bordered w-full pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-base-content/50">
            🔍
          </div>
        </div>
        
        {/* 视图切换 */}
        <div className="flex space-x-2">
          <button
            type="button"
            className={`btn btn-sm ${
              currentView === 'files' ? 'btn-primary' : 'btn-ghost'
            }`}
            onClick={() => setCurrentView('files')}
          >
            📁 文件
          </button>
          <button
            type="button"
            className={`btn btn-sm ${
              currentView === 'tables' ? 'btn-primary' : 'btn-ghost'
            }`}
            onClick={() => setCurrentView('tables')}
          >
            📊 表
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-4">
        {currentView === 'files' ? (
          <FileList
            files={filteredFiles}
            tables={tables}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            onViewTable={handleViewTable}
          />
        ) : (
          <TableList
            tables={tables}
            files={files}
            searchTerm={searchTerm}
            selectedTable={selectedTable}
            onTableSelect={onTableSelect}
            onViewFiles={handleViewFiles}
          />
        )}
      </div>
      
      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
};

export default FilePanel;

