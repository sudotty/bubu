import { memo } from 'react';
import type { File } from '../types';
import { formatFileSize, formatDate } from '../utils/fileUtils';

interface FileCardProps {
  file: File;
  tables: string[];
  favorites: Set<number>;
  onToggleFavorite: (fileId: number) => void;
  onViewTable: (tableName: string) => void;
}

const FileCard = memo(({
  file,
  tables,
  favorites,
  onToggleFavorite,
  onViewTable
}: FileCardProps) => {
  const tableName = file.filename.replace(/\.[^/\.]+$/, '');
  const hasCorrespondingTable = tables.includes(tableName);
  const isFavorite = favorites.has(file.id);

  return (
    <div className="card bg-base-100 shadow-sm border border-base-300 p-3 hover:shadow-md transition-shadow">
      <div className="flex items-center space-x-3">
        <div className="text-2xl">
          {file.file_type === 'xlsx' ? '📊' : '📄'}
        </div>
        <div className="flex-1">
          <div className="font-medium text-sm">{file.filename}</div>
          <div className="text-xs text-base-content/60">
            {formatFileSize(file.file_size)} • {formatDate(file.upload_time)}
          </div>
        </div>
        <div className="flex items-center space-x-1">
          {hasCorrespondingTable && (
            <button
              type="button"
              className="btn btn-ghost btn-xs text-primary"
              onClick={() => onViewTable(tableName)}
              title="查看对应表"
            >
              📋
            </button>
          )}
          <button
            type="button"
            className={`btn btn-ghost btn-xs ${
              isFavorite ? 'text-warning' : 'text-base-content/50'
            }`}
            onClick={() => onToggleFavorite(file.id)}
            title={isFavorite ? '取消收藏' : '收藏'}
          >
            {isFavorite ? '⭐' : '☆'}
          </button>
        </div>
      </div>
    </div>
  );
});

FileCard.displayName = 'FileCard';

export default FileCard;