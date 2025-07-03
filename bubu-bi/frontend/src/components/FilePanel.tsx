
import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { UploadFile } from '../../wailsjs/go/main/App';
import FileList from './FileList';
import type { FileInfo } from '../types';

interface FilePanelProps {
  files: FileInfo[];
  onRefresh: () => Promise<void>;
  analysisHistory?: any[];
  isRefreshing?: boolean;
  selectedFiles?: FileInfo[];
  onFileSelect?: (file: FileInfo | null) => void;
  isProcessingFile?: boolean;
}

const FilePanel = ({ files, onRefresh, analysisHistory = [], isRefreshing: globalIsRefreshing = false, selectedFiles = [], onFileSelect, isProcessingFile = false }: FilePanelProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);



  const [localIsRefreshing, setLocalIsRefreshing] = useState(false);
  
  // 使用全局刷新状态或本地刷新状态
  const isRefreshing = globalIsRefreshing || localIsRefreshing;

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
      // 客户端文件大小验证
      const maxSizeMB = 300;
      const maxSizeBytes = maxSizeMB * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        showToast(`文件大小不能超过 ${maxSizeMB}MB`, 'error');
        return;
      }

      // 使用FileReader进行Base64编码，避免手动处理导致的编码错误
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // 移除data:开头的部分，只保留base64数据
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
      });
      
      reader.readAsDataURL(file);
      const base64String = await base64Promise;
      
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


  const filteredFiles = useMemo(() => files, [files]);





  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    await onRefresh();
  }, [isRefreshing, onRefresh]);

  // 监听浏览器刷新快捷键
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 检测 Ctrl+R (Windows/Linux) 或 Cmd+R (Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault(); // 阻止浏览器默认刷新行为
        handleRefresh(); // 触发数据刷新
      }
    };

    // 添加事件监听器
    window.addEventListener('keydown', handleKeyDown);

    // 清理函数
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleRefresh]);



  return (
    <div className="h-full flex flex-col relative">
      {/* 内容区域 */}
      <div className={`flex-1 overflow-y-auto p-3 pb-20 transition-all duration-300 ${
        isRefreshing ? 'opacity-60 pointer-events-none' : ''
      }`}>
        {/* 刷新时的加载遮罩 */}
        {isRefreshing && (
          <div className="absolute inset-0 flex items-center justify-center bg-base-100/50 backdrop-blur-sm z-10">
            <div className="flex flex-col items-center space-y-3">
              <div className="loading loading-spinner loading-lg text-primary"></div>
              <div className="text-sm text-base-content/70 font-medium">
                🔄 正在刷新数据...
              </div>
            </div>
          </div>
        )}
        
        <FileList
          files={filteredFiles}
          selectedFiles={selectedFiles}
          onFileSelect={onFileSelect}
          isProcessingFile={isProcessingFile}
        />
      </div>
      
      {/* 底部固定操作区域 */}
       <div className="absolute bottom-0 left-0 right-0 bg-base-200/95 backdrop-blur-sm border-t border-base-300/50 p-3">
         {/* 上传按钮 */}
         <button
           type="button"
           className="btn btn-primary w-full h-12 text-base font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]"
           onClick={handleUploadClick}
         >
           <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
           </svg>
           上传Excel文件
         </button>
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

