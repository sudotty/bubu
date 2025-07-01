import React, { memo } from 'react';
import FileCard from './FileCard';
import type { File } from '../types';

interface FileListProps {
  files: File[];
  selectedFiles?: File[];
  onFileSelect?: (file: File | null) => void;
  isProcessingFile?: boolean;
}

interface FileGroupSectionProps {
  title: string;
  files: File[];
  keyPrefix: string;
  badge?: number;
}

const FileGroupSection = memo(({
  title,
  files,
  keyPrefix,
  badge
}: FileGroupSectionProps) => {
  if (files.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-medium text-base-content/70 mb-3 flex items-center space-x-2">
        <span>{title}</span>
        {badge !== undefined && (
          <div className="badge badge-warning badge-sm">{badge}</div>
        )}
      </h3>
      <div className="space-y-2">
        {files.map((file) => (
          <FileCard
            key={`${keyPrefix}-${file.id}`}
            file={file}
          />
        ))}
      </div>
    </div>
  );
});

FileGroupSection.displayName = 'FileGroupSection';

const FileList = memo(({
  files,
  selectedFiles = [],
  onFileSelect,
  isProcessingFile
}: FileListProps) => {
  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-base-content/50">
        <div className="text-4xl mb-2">📁</div>
        <p className="text-sm">暂无文件</p>
        <p className="text-xs mt-1">支持 Excel (.xlsx) 和 CSV 文件</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <FileCard
          key={`file-${file.filename}-${file.file_path}`}
          file={file}
          isSelected={selectedFiles.some(f => f.filename === file.filename && f.file_path === file.file_path)}
          onSelect={() => {
            onFileSelect?.(file);
          }}
          isProcessing={isProcessingFile && selectedFiles.some(f => f.filename === file.filename && f.file_path === file.file_path)}
        />
      ))}
    </div>
  );
});

FileList.displayName = 'FileList';

export default FileList;