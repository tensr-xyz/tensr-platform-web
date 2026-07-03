import React, { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { EditableCell, EditableCellRef } from '@/components/templates/visualiser/molecules/table';
import { Header } from '@tanstack/react-table';
import { cn } from '@/utils';

interface HeaderComponentProps {
  header: Header<Record<string, unknown>, unknown>;
  onHeaderEdit?: (columnId: string, value: string) => void;
}

export const HeaderComponent = React.memo<HeaderComponentProps>(({ header, onHeaderEdit }) => {
  const editableCellRef = useRef<EditableCellRef>(null);
  const [isEditing, setIsEditing] = useState(false);
  const column = header.column;
  const canSort = column.getCanSort();
  const sortDirection = column.getIsSorted();

  const handleSort = () => {
    if (canSort) {
      if (sortDirection === false) {
        column.toggleSorting(false);
      } else if (sortDirection === 'asc') {
        column.toggleSorting(true);
      } else {
        column.clearSorting();
      }
    }
  };

  const handleHeaderEdit = (value: string) => {
    if (onHeaderEdit) {
      onHeaderEdit(column.id, value);
    }
    setIsEditing(false);
  };

  const headerValue = header.column.columnDef.header as string;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-7 items-center justify-between px-2">
        <div
          className="flex-1 cursor-pointer"
          onDoubleClick={() => {
            setIsEditing(true);
            requestAnimationFrame(() => {
              editableCellRef.current?.focus();
            });
          }}
        >
          {isEditing ? (
            <EditableCell
              ref={editableCellRef}
              value={headerValue}
              onEdit={handleHeaderEdit}
              onBlur={() => setIsEditing(false)}
              className="h-6 text-xs font-medium"
            />
          ) : (
            <span className="text-xs font-medium">{headerValue}</span>
          )}
        </div>
        {canSort && (
          <button
            onClick={handleSort}
            className={cn(
              'ml-2 flex items-center justify-center p-1 hover:bg-accent rounded',
              sortDirection && 'bg-accent'
            )}
          >
            {sortDirection === 'asc' ? (
              <ArrowUp className="h-3 w-3" />
            ) : sortDirection === 'desc' ? (
              <ArrowDown className="h-3 w-3" />
            ) : (
              <ArrowUpDown className="h-3 w-3" />
            )}
          </button>
        )}
      </div>
    </div>
  );
});

HeaderComponent.displayName = 'HeaderComponent';
