
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
  analysisHistory?: any[];
}

const FilePanel = ({ files, tables, selectedTable, onTableSelect, onRefresh, analysisHistory = [] }: FilePanelProps) => {
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
          <h2 className="text-lg font-semibold text-base-content flex items-center space-x-2">
            <span>📁</span>
            <span>我的Excel文件</span>
          </h2>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleUploadClick}
          >
            📤 上传数据
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
        <div className="flex space-x-1">
          <button
            type="button"
            className={`btn btn-sm flex-1 ${
              currentView === 'files' ? 'btn-primary' : 'btn-ghost'
            }`}
            onClick={() => setCurrentView('files')}
          >
            📁 数据文件
          </button>
          <button
            type="button"
            className={`btn btn-sm flex-1 ${
              currentView === 'tables' ? 'btn-primary' : 'btn-ghost'
            }`}
            onClick={() => setCurrentView('tables')}
          >
            📊 数据表
          </button>
          <button
            type="button"
            className={`btn btn-sm flex-1 ${
              currentView === 'history' ? 'btn-primary' : 'btn-ghost'
            }`}
            onClick={() => setCurrentView('history')}
          >
            📈 分析历史
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
        ) : currentView === 'tables' ? (
          <TableList
            tables={tables}
            files={files}
            searchTerm={searchTerm}
            selectedTable={selectedTable}
            onTableSelect={onTableSelect}
            onViewFiles={handleViewFiles}
          />
        ) : (
          /* 分析历史视图 */
          <div className="space-y-3">
            <div className="text-sm text-base-content/70 mb-4">
              📈 最近的数据分析记录
            </div>
            {analysisHistory.length === 0 ? (
              <div className="text-center py-8 text-base-content/50">
                <div className="text-4xl mb-2">📊</div>
                <p>还没有分析记录</p>
                <p className="text-xs mt-1">开始使用AI助手分析数据吧！</p>
              </div>
            ) : (
              analysisHistory.map((analysis, index) => (
                <div key={index} className="bg-base-100 rounded-lg p-3 border border-base-300 hover:bg-base-200 transition-colors cursor-pointer">
                  <div className="flex items-start space-x-2">
                    <div className="text-lg">📊</div>
                    <div className="flex-1">
                      <div className="text-sm font-medium truncate">
                        {analysis.title || '数据分析'}
                      </div>
                      <div className="text-xs text-base-content/60 mt-1">
                        🕒 {analysis.timestamp || '刚刚'}
                      </div>
                      <div className="text-xs text-base-content/70 mt-1 truncate">
                        {analysis.description || '分析完成'}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
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

