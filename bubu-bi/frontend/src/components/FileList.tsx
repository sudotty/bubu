import { memo } from 'react';
import FileCard from './FileCard';
import { groupFilesByDate } from '../utils/fileUtils';
import type { File } from '../types';

interface FileListProps {
  files: File[];
  tables: string[];
  favorites: Set<number>;
  onToggleFavorite: (fileId: number) => void;
  onViewTable: (tableName: string) => void;
}

interface FileGroupSectionProps {
  title: string;
  files: File[];
  keyPrefix: string;
  badge?: number;
  tables: string[];
  favorites: Set<number>;
  onToggleFavorite: (fileId: number) => void;
  onViewTable: (tableName: string) => void;
}

const FileGroupSection = memo(({
  title,
  files,
  keyPrefix,
  badge,
  tables,
  favorites,
  onToggleFavorite,
  onViewTable
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
            tables={tables}
            favorites={favorites}
            onToggleFavorite={onToggleFavorite}
            onViewTable={onViewTable}
          />
        ))}
      </div>
    </div>
  );
});

FileGroupSection.displayName = 'FileGroupSection';

const FileList = memo(({
  files,
  tables,
  favorites,
  onToggleFavorite,
  onViewTable
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

  const groups = groupFilesByDate(files, true, favorites);
  const favoriteFiles = files.filter(f => favorites.has(f.id));

  return (
    <div className="space-y-6">
      <FileGroupSection
        title="⭐ 收藏"
        files={favoriteFiles}
        keyPrefix="favorite"
        badge={favoriteFiles.length}
        tables={tables}
        favorites={favorites}
        onToggleFavorite={onToggleFavorite}
        onViewTable={onViewTable}
      />
      <FileGroupSection
        title="今天"
        files={groups.today}
        keyPrefix="today"
        tables={tables}
        favorites={favorites}
        onToggleFavorite={onToggleFavorite}
        onViewTable={onViewTable}
      />
      <FileGroupSection
        title="昨天"
        files={groups.yesterday}
        keyPrefix="yesterday"
        tables={tables}
        favorites={favorites}
        onToggleFavorite={onToggleFavorite}
        onViewTable={onViewTable}
      />
      <FileGroupSection
        title="本周"
        files={groups.thisWeek}
        keyPrefix="week"
        tables={tables}
        favorites={favorites}
        onToggleFavorite={onToggleFavorite}
        onViewTable={onViewTable}
      />
      <FileGroupSection
        title="本月"
        files={groups.thisMonth}
        keyPrefix="month"
        tables={tables}
        favorites={favorites}
        onToggleFavorite={onToggleFavorite}
        onViewTable={onViewTable}
      />
      <FileGroupSection
        title="更早"
        files={groups.older}
        keyPrefix="older"
        tables={tables}
        favorites={favorites}
        onToggleFavorite={onToggleFavorite}
        onViewTable={onViewTable}
      />
    </div>
  );
});

FileList.displayName = 'FileList';

export default FileList;