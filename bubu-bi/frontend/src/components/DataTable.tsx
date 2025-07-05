import React from 'react';
import type { CellValue } from '../types/data';

interface DataTableProps {
  columns: string[];
  rows: CellValue[][];
  className?: string;
}

export const DataTable: React.FC<DataTableProps> = ({ columns, rows, className = '' }) => {
  if (!columns || columns.length === 0) {
    return (
      <div className="text-center py-8 text-base-content/60">
        暂无数据
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="table table-zebra">
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th key={index} className="text-base-content font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-base-100">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="text-base-content">
                  {cell !== null && cell !== undefined ? String(cell) : '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;