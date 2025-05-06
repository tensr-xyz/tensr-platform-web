import React, { useRef, useCallback, useState } from 'react';
import {
  LuArrowDownWideNarrow,
  LuArrowUpWideNarrow,
  LuBox,
  LuChevronDown,
  LuEye,
  LuGroup,
  LuLoader,
  LuPencil,
  LuWrench,
} from 'react-icons/lu';
import { Resizable } from 'react-resizable';
import { EditableCell, EditableCellRef } from '@/components/molecules/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/molecules/dropdown';
import { Column, Header, Table } from '@tanstack/react-table';
import { ColumnSummary } from '@/types/project';
import { cn } from '@/utils';

interface HeaderCellProps {
  column: Column<any>;
  showStats: boolean;
  stats?: ColumnSummary;
  isLoadingStats: boolean;
  onHeaderEdit?: (value: string) => void;
}

interface HeaderComponentProps {
  header: Header<any, unknown>;
  table: Table<any>;
  showStats: boolean;
  columnStats?: Record<string, ColumnSummary>;
  onHeaderEdit?: (columnId: string, value: string) => void;
  isLoadingStats: boolean;
}

// Stats container component to ensure consistent heights
const StatsContainer = ({ children }: { children: React.ReactNode }) => (
  <div className="h-[220px] overflow-y-auto">
    <div className="p-2 text-xs">{children}</div>
  </div>
);

const HeaderCell = React.memo<HeaderCellProps>(
  ({ column, showStats, stats, isLoadingStats, onHeaderEdit }) => {
    const hasStats = stats?.numeric_stats || stats?.categorical_stats;
    const editableCellRef = useRef<EditableCellRef>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const renderNumericValue = useCallback((value: number | undefined | null) => {
      if (value === undefined || value === null) return '-';
      return value.toLocaleString(undefined, {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
      });
    }, []);

    const renderPercentage = useCallback((value: number) => {
      return `${(value * 100).toFixed(1)}%`;
    }, []);

    const handleRenameClick = useCallback(() => {
      // Close dropdown first to avoid focus issues
      setDropdownOpen(false);

      // Focus the edit cell directly without delay
      // We'll use requestAnimationFrame instead of setTimeout
      // to ensure the dropdown is closed before focusing
      requestAnimationFrame(() => {
        setIsEditing(true);
        if (editableCellRef.current) {
          editableCellRef.current.focus();
        }
      });
    }, []);

    // Prevent dropdown from opening when editing
    const handleDropdownTriggerClick = useCallback(
      (e: React.MouseEvent) => {
        if (isEditing) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      },
      [isEditing]
    );

    return (
      <div className="w-full bg-background h-full flex flex-col">
        {/* Header Section - Fixed height */}
        <div
          className={cn(
            'h-7 flex-none z-20',
            (isEditing || dropdownOpen) && 'outline outline-2 outline-primary'
          )}
          style={{
            outlineOffset: '-2px',
          }}
        >
          <DropdownMenu
            open={dropdownOpen && !isEditing}
            onOpenChange={open => {
              // Only allow opening dropdown if not editing
              if (isEditing && open) return;
              setDropdownOpen(open);
            }}
          >
            <DropdownMenuTrigger asChild onClick={handleDropdownTriggerClick}>
              <div
                className={cn(
                  'flex items-center justify-between h-7 w-full cursor-pointer',
                  dropdownOpen ? 'bg-muted' : 'hover:bg-muted/50'
                )}
              >
                <div className="flex-1 min-w-0 ">
                  <EditableCell
                    ref={editableCellRef}
                    value={column.columnDef.header as string}
                    onEdit={value => {
                      setIsEditing(false);
                      if (onHeaderEdit) {
                        onHeaderEdit(value);
                      }
                    }}
                    className="h-7 w-full "
                    inputClassName="z-20 relative outline outline-2 -outline-offset-2 outline-primary"
                    isFocused={isEditing}
                    onFocus={() => setIsEditing(true)}
                    onBlur={() => {
                      // Add slight delay to allow click events to process first
                      setTimeout(() => setIsEditing(false), 50);
                    }}
                    // Handle special key presses
                    onKeyDown={e => {
                      // Stop propagation to prevent dropdown trigger
                      e.stopPropagation();

                      // If Escape is pressed, cancel edit
                      if (e.key === 'Escape') {
                        setIsEditing(false);
                      }
                    }}
                  />
                </div>
                <LuChevronDown className="mx-2 h-4 w-4" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => column.toggleSorting(false)}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <LuArrowUpWideNarrow className="mr-2 h-4 w-4" />
                    <span>Sort ascending</span>
                  </div>
                  {column.getIsSorted() === 'asc' && (
                    <span className="text-muted-foreground text-xs">⌘↑</span>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => column.toggleSorting(true)}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <LuArrowDownWideNarrow className="mr-2 h-4 w-4" />
                    <span>Sort descending</span>
                  </div>
                  {column.getIsSorted() === 'desc' && (
                    <span className="text-muted-foreground text-xs">⌘↓</span>
                  )}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <LuGroup className="mr-2 h-4 w-4" />
                  <span>Group by</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <LuBox className="mr-2 h-4 w-4" />
                  <span>Aggregate by</span>
                  <DropdownMenuShortcut>⌘+T</DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <LuWrench className="mr-2 h-4 w-4" />
                <span>Change column type</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <LuEye className="mr-2 h-4 w-4" />
                <span>Hide column</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleRenameClick}>
                <LuPencil className="mr-2 h-4 w-4" />
                <span>Rename</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Stats Section - Fixed height container */}
        {showStats && (
          <StatsContainer>
            {isLoadingStats ? (
              <div className="h-full flex items-center justify-center">
                <LuLoader className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : hasStats ? (
              <div className="space-y-3">
                {/* General Stats */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Type:</span>
                    <span>{stats.data_type || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Missing:</span>
                    <span>
                      {stats.numeric_stats?.missing_count ||
                        stats.categorical_stats?.missing_count ||
                        0}
                    </span>
                  </div>
                </div>

                {/* Numeric Stats */}
                {stats.numeric_stats && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Count:</span>
                      <span>{renderNumericValue(stats.numeric_stats.count)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Mean:</span>
                      <span>{renderNumericValue(stats.numeric_stats.mean)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Std Dev:</span>
                      <span>{renderNumericValue(stats.numeric_stats.std_dev)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Min:</span>
                      <span>{renderNumericValue(stats.numeric_stats.min)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">5%:</span>
                      <span>{renderNumericValue(stats.numeric_stats.percentile_5)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">25%:</span>
                      <span>{renderNumericValue(stats.numeric_stats.percentile_25)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Median:</span>
                      <span>{renderNumericValue(stats.numeric_stats.percentile_50)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">75%:</span>
                      <span>{renderNumericValue(stats.numeric_stats.percentile_75)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">95%:</span>
                      <span>{renderNumericValue(stats.numeric_stats.percentile_95)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Max:</span>
                      <span>{renderNumericValue(stats.numeric_stats.max)}</span>
                    </div>
                  </div>
                )}

                {/* Categorical Stats */}
                {stats.categorical_stats && (
                  <div className="space-y-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Count:</span>
                        <span>{stats.categorical_stats.count}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Distinct:</span>
                        <span>{stats.categorical_stats.distinct_count}</span>
                      </div>
                    </div>

                    {stats.categorical_stats.top_frequencies?.length > 0 && (
                      <div>
                        <div className="font-medium mb-1">Top Values</div>
                        <div className="space-y-1">
                          {stats.categorical_stats.top_frequencies.map((freq, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-2">
                              <span className="truncate max-w-[120px]" title={freq.value}>
                                {freq.value}
                              </span>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <span>{freq.count}</span>
                                <span className="min-w-[45px] text-right">
                                  {renderPercentage(freq.percentage)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No stats available
              </div>
            )}
          </StatsContainer>
        )}
      </div>
    );
  }
);

HeaderCell.displayName = 'HeaderCell';

export const HeaderComponent = React.memo<HeaderComponentProps>(function HeaderComponent({
  header,
  table,
  showStats,
  columnStats,
  onHeaderEdit,
  isLoadingStats,
}) {
  const column = header.column;
  const stats = columnStats?.[column.id];
  const [width, setWidth] = useState(column.getSize());

  const handleResize = useCallback(
    (_e: React.SyntheticEvent, { size }: { size: { width: number } }) => {
      setWidth(size.width);
      table.setColumnSizing(prev => ({
        ...prev,
        [column.id]: size.width,
      }));
    },
    [column.id, table]
  );

  if (column.id === 'select') {
    return (
      <div className="h-full w-full">
        <div className="h-7 flex items-center px-2">
          <span className="text-xs">#</span>
        </div>
        {showStats && <div className="h-[220px]" />}
      </div>
    );
  }

  return (
    <Resizable
      width={width}
      height={showStats ? 250 : 28}
      onResize={handleResize}
      draggableOpts={{ enableUserSelectHack: false, grid: [1, 0] }}
      handle={
        <div
          className="absolute right-0 top-0 h-full w-1 cursor-col-resize z-10"
          style={{ touchAction: 'none' }}
        />
      }
      resizeHandles={['e']}
    >
      <div style={{ width: `${width}px` }}>
        <HeaderCell
          column={column}
          showStats={showStats}
          stats={stats}
          onHeaderEdit={value => onHeaderEdit?.(column.id, value)}
          isLoadingStats={isLoadingStats}
        />
      </div>
    </Resizable>
  );
});

HeaderComponent.displayName = 'HeaderComponent';
