import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CellPosition, CellRange } from '@/types/spreadsheet';
import { detectPattern, generateSequence, DetectedPattern } from '@/utils/pattern-detection';
import { getCellsInRange, getRangeDimensions } from '@/utils/range-utils';
import { cn } from '@/utils';

interface FillHandleProps {
  selection: CellRange;
  visibleColumns: string[];
  data: Record<string, any>[];
  onFill: (cells: CellPosition[], values: (string | number)[]) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export function FillHandle({
  selection,
  visibleColumns,
  data,
  onFill,
  onDragStart,
  onDragEnd,
}: FillHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragEndCell, setDragEndCell] = useState<CellPosition | null>(null);
  const [previewValues, setPreviewValues] = useState<(string | number)[]>([]);
  const [detectedPattern, setDetectedPattern] = useState<DetectedPattern | null>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<CellPosition | null>(null);

  // Detect pattern from selected cells
  useEffect(() => {
    if (!selection) return;

    const cells = getCellsInRange(selection, visibleColumns);
    const values: (string | number)[] = [];

    // Get values from selected cells, prioritizing row direction
    const startRow = Math.min(selection.start.rowIndex, selection.end.rowIndex);
    const endRow = Math.max(selection.start.rowIndex, selection.end.rowIndex);
    const startColIndex = visibleColumns.indexOf(selection.start.columnId);
    const endColIndex = visibleColumns.indexOf(selection.end.columnId);
    const minColIndex = Math.min(startColIndex, endColIndex);
    const maxColIndex = Math.max(startColIndex, endColIndex);

    // Determine if selection is primarily horizontal or vertical
    const isHorizontal = endRow - startRow < maxColIndex - minColIndex;

    if (isHorizontal) {
      // Read horizontally
      const row = startRow;
      for (let col = minColIndex; col <= maxColIndex; col++) {
        const cell = cells.find(c => c.rowIndex === row && c.columnId === visibleColumns[col]);
        if (cell) {
          values.push(data[cell.rowIndex]?.[cell.columnId] ?? '');
        }
      }
    } else {
      // Read vertically
      const col = visibleColumns[minColIndex];
      for (let row = startRow; row <= endRow; row++) {
        const cell = cells.find(c => c.rowIndex === row && c.columnId === col);
        if (cell) {
          values.push(data[cell.rowIndex]?.[cell.columnId] ?? '');
        }
      }
    }

    const pattern = detectPattern(values);
    setDetectedPattern(pattern);
  }, [selection, visibleColumns, data]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      dragStartRef.current = {
        rowIndex: Math.max(selection.start.rowIndex, selection.end.rowIndex),
        columnId:
          visibleColumns[
            Math.max(
              visibleColumns.indexOf(selection.start.columnId),
              visibleColumns.indexOf(selection.end.columnId)
            )
          ],
      };
      onDragStart?.();
    },
    [selection, visibleColumns, onDragStart]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Find which cell the mouse is over
      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (!target) return;

      const cell = target.closest('[data-row-index][data-column-id]');
      if (!cell) return;

      const rowIndex = parseInt(cell.getAttribute('data-row-index') || '0', 10);
      const columnId = cell.getAttribute('data-column-id') || '';

      if (dragStartRef.current) {
        const newEndCell: CellPosition = { rowIndex, columnId };
        setDragEndCell(newEndCell);

        // Calculate how many cells to fill
        const startRow = dragStartRef.current.rowIndex;
        const startColIndex = visibleColumns.indexOf(dragStartRef.current.columnId);
        const endRow = rowIndex;
        const endColIndex = visibleColumns.indexOf(columnId);

        // Determine fill direction
        const isHorizontal = Math.abs(endColIndex - startColIndex) > Math.abs(endRow - startRow);
        const count = isHorizontal
          ? Math.abs(endColIndex - startColIndex)
          : Math.abs(endRow - startRow);

        if (count > 0 && detectedPattern) {
          // Get base values from selection
          const cells = getCellsInRange(selection, visibleColumns);
          const startRowSel = Math.min(selection.start.rowIndex, selection.end.rowIndex);
          const endRowSel = Math.max(selection.start.rowIndex, selection.end.rowIndex);
          const startColIndexSel = visibleColumns.indexOf(selection.start.columnId);
          const endColIndexSel = visibleColumns.indexOf(selection.end.columnId);
          const minColIndexSel = Math.min(startColIndexSel, endColIndexSel);
          const maxColIndexSel = Math.max(startColIndexSel, endColIndexSel);

          const isHorizontalSel = endRowSel - startRowSel < maxColIndexSel - minColIndexSel;
          const baseValues: (string | number)[] = [];

          if (isHorizontalSel) {
            const row = startRowSel;
            for (let col = minColIndexSel; col <= maxColIndexSel; col++) {
              const cell = cells.find(
                c => c.rowIndex === row && c.columnId === visibleColumns[col]
              );
              if (cell) {
                baseValues.push(data[cell.rowIndex]?.[cell.columnId] ?? '');
              }
            }
          } else {
            const col = visibleColumns[minColIndexSel];
            for (let row = startRowSel; row <= endRowSel; row++) {
              const cell = cells.find(c => c.rowIndex === row && c.columnId === col);
              if (cell) {
                baseValues.push(data[cell.rowIndex]?.[cell.columnId] ?? '');
              }
            }
          }

          const sequence = generateSequence(detectedPattern, baseValues, count);
          setPreviewValues(sequence);
        } else {
          setPreviewValues([]);
        }
      }
    };

    const handleMouseUp = () => {
      if (isDragging && dragStartRef.current && dragEndCell) {
        // Calculate target cells
        const startRow = dragStartRef.current.rowIndex;
        const startColIndex = visibleColumns.indexOf(dragStartRef.current.columnId);
        const endRow = dragEndCell.rowIndex;
        const endColIndex = visibleColumns.indexOf(dragEndCell.columnId);

        const isHorizontal = Math.abs(endColIndex - startColIndex) > Math.abs(endRow - startRow);
        const count = isHorizontal
          ? Math.abs(endColIndex - startColIndex)
          : Math.abs(endRow - startRow);

        if (count > 0 && detectedPattern && previewValues.length > 0) {
          const targetCells: CellPosition[] = [];
          const direction = isHorizontal
            ? endColIndex > startColIndex
              ? 'right'
              : 'left'
            : endRow > startRow
              ? 'down'
              : 'up';

          if (direction === 'down') {
            for (let i = 1; i <= count; i++) {
              targetCells.push({
                rowIndex: startRow + i,
                columnId: dragStartRef.current.columnId,
              });
            }
          } else if (direction === 'up') {
            for (let i = 1; i <= count; i++) {
              targetCells.push({
                rowIndex: startRow - i,
                columnId: dragStartRef.current.columnId,
              });
            }
          } else if (direction === 'right') {
            for (let i = 1; i <= count; i++) {
              targetCells.push({
                rowIndex: startRow,
                columnId: visibleColumns[startColIndex + i],
              });
            }
          } else {
            // left
            for (let i = 1; i <= count; i++) {
              targetCells.push({
                rowIndex: startRow,
                columnId: visibleColumns[startColIndex - i],
              });
            }
          }

          onFill(targetCells, previewValues);
        }
      }

      setIsDragging(false);
      setDragEndCell(null);
      setPreviewValues([]);
      dragStartRef.current = null;
      onDragEnd?.();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    isDragging,
    dragEndCell,
    detectedPattern,
    previewValues,
    selection,
    visibleColumns,
    data,
    onFill,
    onDragEnd,
  ]);

  // Calculate position of fill handle (bottom-right corner of selection)
  const startRow = Math.min(selection.start.rowIndex, selection.end.rowIndex);
  const endRow = Math.max(selection.start.rowIndex, selection.end.rowIndex);
  const startColIndex = visibleColumns.indexOf(selection.start.columnId);
  const endColIndex = visibleColumns.indexOf(selection.end.columnId);
  const minColIndex = Math.min(startColIndex, endColIndex);
  const maxColIndex = Math.max(startColIndex, endColIndex);

  // The handle should be positioned at the bottom-right corner
  // This would need to be calculated based on actual cell positions in the DOM
  // For now, we'll use a fixed position approach

  return (
    <div
      ref={handleRef}
      onMouseDown={handleMouseDown}
      className={cn(
        'absolute bottom-0 right-0 w-3 h-3 cursor-crosshair',
        'bg-blue-500 border border-blue-700 rounded-sm',
        'hover:bg-blue-600 active:bg-blue-700',
        'z-50'
      )}
      style={{
        transform: 'translate(50%, 50%)',
      }}
      title="Drag to fill cells"
    />
  );
}
