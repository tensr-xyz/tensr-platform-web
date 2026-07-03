import { ColumnDef } from '@tanstack/react-table';
import React from 'react';
import { EditableCell } from '@/components/templates/visualiser/molecules/table';
import { Column } from '@/types/visualiser/spreadsheet';

export interface CreateColumnsProps {
  initialColumns: Column[];
  extraColumnsCount: number;
  setData: React.Dispatch<React.SetStateAction<Record<string, any>[]>>;
  DEFAULT_COLUMN_WIDTH: number;
}

interface CellRendererProps {
  value: any;
  onEdit: (value: any) => void;
  isFocused: boolean;
  onFocus: () => void;
}

const CellRenderer = React.memo(function CellRenderer({
  value,
  onEdit,
  isFocused,
  onFocus,
}: CellRendererProps) {
  return (
    <EditableCell
      value={value ?? ''}
      onEdit={onEdit}
      className="h-7"
      isFocused={isFocused}
      onFocus={onFocus}
    />
  );
});

CellRenderer.displayName = 'CellRenderer';

const selectColumn: ColumnDef<any> = {
  id: 'select',
  cell: ({ row }) => (
    <div className="flex w-full items-center gap-2 pl-2">
      <span className="text-xs font-medium">{row.index + 1}</span>
    </div>
  ),
  enableSorting: false,
  enableHiding: false,
  size: 70,
};

export const createColumns = ({
  initialColumns,
  extraColumnsCount,
  setData,
  DEFAULT_COLUMN_WIDTH,
}: CreateColumnsProps): ColumnDef<Record<string, any>>[] => {
  return [
    selectColumn,
    ...initialColumns.map(col => ({
      id: col.id,
      accessorKey: col.id,
      header: col.header || col.id,
      size: col.width || DEFAULT_COLUMN_WIDTH,
      cell: ({
        row,
        column,
        getValue,
      }: {
        row: { index: number };
        column: { id: string };
        getValue: () => any;
      }) => (
        <CellRenderer
          value={getValue()}
          onEdit={(newValue: string) => {
            setData(old => {
              const newData = [...old];
              if (!newData[row.index]) {
                newData[row.index] = {};
              }
              newData[row.index] = {
                ...newData[row.index],
                [column.id]: newValue,
              };
              return newData;
            });
          }}
          isFocused={false}
          onFocus={() => {}}
        />
      ),
    })),
    ...Array(extraColumnsCount)
      .fill(null)
      .map((_, i) => ({
        id: `col-${initialColumns.length + i}`,
        header: 'New Column',
        accessorKey: `col-${initialColumns.length + i}`,
        size: DEFAULT_COLUMN_WIDTH,
        cell: ({
          row,
          column,
          getValue,
        }: {
          row: { index: number };
          column: { id: string };
          getValue: () => any;
        }) => (
          <CellRenderer
            value={getValue()}
            onEdit={(newValue: string) => {
              setData(old => {
                const newData = [...old];
                if (!newData[row.index]) {
                  newData[row.index] = {};
                }
                newData[row.index] = {
                  ...newData[row.index],
                  [column.id]: newValue,
                };
                return newData;
              });
            }}
            isFocused={false}
            onFocus={() => {}}
          />
        ),
      })),
  ];
};
