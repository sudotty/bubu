import { useState, memo } from 'react';
import { classifyTables } from '../utils/tableUtils';
import type { File } from '../types';

interface TableListProps {
  tables: string[];
  files: File[];
  searchTerm: string;
  selectedTable: string;
  onTableSelect: (tableName: string) => void;
  onViewFiles: () => void;
}

interface TableButtonProps {
  table: string;
  isSelected: boolean;
  icon: string;
  description: string;
  correspondingFile?: File;
  onSelect: () => void;
  onViewFiles?: () => void;
}

const TableButton = memo(({ table, isSelected, icon, description, correspondingFile, onSelect, onViewFiles }: TableButtonProps) => (
  <button
    type="button"
    onClick={onSelect}
    className={`w-full text-left p-3 rounded-lg border transition-colors ${
      isSelected
        ? 'bg-primary text-primary-content border-primary'
        : 'bg-base-100 border-base-300 hover:border-base-400'
    }`}
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="text-xl">{icon}</div>
        <div>
          <div className="font-medium">{table}</div>
          <div className="text-xs opacity-70">{description}</div>
        </div>
      </div>
      {correspondingFile && onViewFiles && (
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          title="查看源文件"
          onClick={(e) => {
            e.stopPropagation();
            onViewFiles();
          }}
        >
          📄
        </button>
      )}
    </div>
  </button>
));

TableButton.displayName = 'TableButton';

const TableList = memo(({
  tables,
  files,
  searchTerm,
  selectedTable,
  onTableSelect,
  onViewFiles
}: TableListProps) => {
  const [showSystemTables, setShowSystemTables] = useState(false);
  const { systemTables, userTables, filteredSystemTables } = classifyTables(tables, searchTerm);

  return (
    <div>
      {/* 用户数据表 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-base-content/50 flex items-center space-x-2">
            <span>🪣 数据表</span>
            <div className="badge badge-outline badge-sm">{userTables.length}</div>
          </h3>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => setShowSystemTables(!showSystemTables)}
          >
            {showSystemTables ? '隐藏系统表' : '显示系统表'}
          </button>
        </div>

        {userTables.length === 0 ? (
          <div className="text-center py-8 text-base-content/50">
            <div className="text-4xl mb-2">📊</div>
            <p className="text-sm">暂无数据表</p>
          </div>
        ) : (
          <div className="space-y-2">
            {userTables.map((table) => {
              const correspondingFile = files.find(
                file => file.filename.replace(/\.[^/\.]+$/, '') === table
              );

              return (
                <TableButton
                  key={table}
                  table={table}
                  isSelected={selectedTable === table}
                  icon="📊"
                  description="数据表"
                  correspondingFile={correspondingFile}
                  onSelect={() => onTableSelect(table)}
                  onViewFiles={onViewFiles}
                />
              );
            })}
          </div>
        )}

        {/* 系统表 */}
        {showSystemTables && systemTables.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-base-content/50 mb-3 flex items-center space-x-2">
              <span>⚙️ 系统表</span>
              <div className="badge badge-outline badge-sm">{filteredSystemTables.length}</div>
            </h3>
            <div className="space-y-2">
              {filteredSystemTables.map((table) => (
                <TableButton
                  key={table}
                  table={table}
                  isSelected={selectedTable === table}
                  icon="⚙️"
                  description="系统表 (只读)"
                  onSelect={() => onTableSelect(table)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

TableList.displayName = 'TableList';

export default TableList;