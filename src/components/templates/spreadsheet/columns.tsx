import { ColumnDef } from '@tanstack/react-table';
import { Checkbox } from '@/components/atoms/checkbox';
import React from 'react';
import { EditableCell } from '@/components/molecules/table';

interface InitialColumn {
  id: string;
  header: string;
  size?: number;
}

export interface CreateColumnsProps {
  initialColumns: InitialColumn[];
  extraColumnsCount: number;
  setData: React.Dispatch<React.SetStateAction<Record<string, any>[]>>;
  DEFAULT_COLUMN_WIDTH: number;
}

interface CellRendererProps {
  value: any;
  onEdit: (value: any) => void;
}

// Define CellRenderer once, outside of createColumns
const CellRenderer = React.memo(function CellRenderer({ value, onEdit }: CellRendererProps) {
  return <EditableCell value={value ?? ''} onEdit={onEdit} className="h-7" />;
});

CellRenderer.displayName = 'CellRenderer';

// Separate the select column definition for cleaner code
const selectColumn: ColumnDef<any> = {
  id: 'select',
  cell: ({ row }) => (
    <div className="flex w-full items-center gap-2 pl-2">
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={checked => {
          row.toggleSelected(!!checked);
        }}
        aria-label="Select row"
      />
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
      ...col,
      accessorFn: (row: Record<string, any>) => row[col.id],
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
              newData[row.index] = {
                ...newData[row.index],
                [column.id]: newValue,
              };
              return newData;
            });
          }}
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
            onEdit={(value: string) => {
              setData(old => {
                const newData = [...old];
                newData[row.index] = {
                  ...newData[row.index],
                  [column.id]: value,
                };
                return newData;
              });
            }}
          />
        ),
      })),
  ];
};
