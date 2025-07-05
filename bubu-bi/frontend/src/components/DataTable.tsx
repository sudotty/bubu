import React from 'react';
import type { CellValue } from '../types/data';

interface DataTableProps {
  columns: string[];
  rows: CellValue[][];
  total?: number;
  className?: string;
}

export const DataTable: React.FC<DataTableProps> = ({ columns, rows, total, className = '' }) => {
  if (!columns || columns.length === 0) {
    return (
      <div className="text-center py-8 text-base-content/60">
        暂无数据
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="overflow-auto max-h-96 border border-base-300 rounded-lg">
        <table className="table table-zebra w-full">
        <thead className="sticky top-0 bg-base-200 z-10">
          <tr>
            {columns.map((column, index) => (
              <th key={index} className="text-base-content font-semibold whitespace-nowrap px-4 py-2 min-w-32">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-base-100">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="text-base-content whitespace-nowrap px-4 py-2 min-w-32">
                  {cell !== null && cell !== undefined ? String(cell) : '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
};

export default DataTable;