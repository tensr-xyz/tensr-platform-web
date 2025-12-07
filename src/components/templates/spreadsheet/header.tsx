import React, { useRef, useCallback, useState, useMemo } from 'react';
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  Box,
  ChevronDown,
  Eye,
  Users as Group,
  Loader2 as Loader,
  Pencil,
  Wrench,
  Info,
} from 'lucide-react';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/atoms/tooltip';
import { Sparkline } from '@/components/molecules/sparkline';

interface HeaderCellProps {
  column: Column<any>;
  showStats: boolean;
  stats?: ColumnSummary;
  isLoadingStats: boolean;
  onHeaderEdit?: (value: string) => void;
  onColumnAction?: (action: string, columnId: string) => void;
  datasetId?: string;
}

interface HeaderComponentProps {
  header: Header<any, unknown>;
  table: Table<any>;
  showStats: boolean;
  columnStats?: Record<string, ColumnSummary>;
  onHeaderEdit?: (columnId: string, value: string) => void;
  isLoadingStats: boolean;
  onColumnAction?: (action: string, columnId: string) => void;
  datasetId?: string;
}

// Stats container component to ensure consistent heights
const StatsContainer = ({ children }: { children: React.ReactNode }) => (
  <div className="h-[220px] overflow-y-auto">
    <div className="p-2 text-xs">{children}</div>
  </div>
);

const HeaderCell = React.memo<HeaderCellProps>(
  ({ column, showStats, stats, isLoadingStats, onHeaderEdit, onColumnAction, datasetId }) => {
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

    const quickSummary = useMemo(() => {
      if (!stats) return '';

      const parts: string[] = [];
      if (stats.data_type) {
        parts.push(`Type: ${stats.data_type}`);
      }

      const missing = stats.numeric_stats?.missing_count ?? stats.categorical_stats?.missing_count;
      if (missing !== undefined) {
        parts.push(`Missing: ${missing}`);
      }

      if (stats.numeric_stats) {
        const mean = stats.numeric_stats.mean;
        const sd = stats.numeric_stats.std_dev;
        if (mean !== undefined && mean !== null) {
          parts.push(`Mean: ${renderNumericValue(mean)}`);
        }
        if (sd !== undefined && sd !== null) {
          parts.push(`SD: ${renderNumericValue(sd)}`);
        }
      }

      if (stats.categorical_stats) {
        const distinct = stats.categorical_stats.distinct_count;
        if (distinct !== undefined && distinct !== null) {
          parts.push(`Distinct: ${distinct}`);
        }
      }

      return parts.join(' • ');
    }, [stats, renderNumericValue]);

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
          <TooltipProvider>
            <Tooltip delayDuration={200}>
              <DropdownMenu
                open={dropdownOpen && !isEditing}
                onOpenChange={open => {
                  // Only allow opening dropdown if not editing
                  if (isEditing && open) return;
                  setDropdownOpen(open);
                }}
              >
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild onClick={handleDropdownTriggerClick}>
                    <div
                      className={cn(
                        'flex items-center justify-between h-7 w-full cursor-pointer',
                        dropdownOpen ? 'bg-muted' : 'hover:bg-muted/50'
                      )}
                    >
                      <div className="flex-1 min-w-0 flex items-center gap-1">
                        <EditableCell
                          ref={editableCellRef}
                          value={column.columnDef.header as string}
                          onEdit={value => {
                            setIsEditing(false);
                            if (onHeaderEdit) {
                              onHeaderEdit(value);
                            }
                          }}
                          className="h-7 flex-1"
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
                        {/* AI Insight Icon */}
                        <Tooltip delayDuration={300}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="h-4 w-4 text-muted-foreground hover:text-foreground flex-shrink-0"
                              onClick={e => {
                                e.stopPropagation();
                                onColumnAction?.('show-insight', column.id);
                              }}
                            >
                              <Info className="h-3 w-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs">
                            <div className="text-xs">
                              {quickSummary || 'Click for column insights'}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                        {/* Badges for data quality issues */}
                        {stats && (
                          <>
                            {(stats.numeric_stats?.missing_count ??
                              stats.categorical_stats?.missing_count ??
                              0) >
                              (stats.numeric_stats?.count ?? stats.categorical_stats?.count ?? 1) *
                                0.1 && (
                              <span
                                className="h-3 w-3 rounded-full bg-yellow-500 flex-shrink-0"
                                title="High missingness"
                              />
                            )}
                            {stats.numeric_stats &&
                              stats.numeric_stats.std_dev !== undefined &&
                              stats.numeric_stats.std_dev < 0.01 && (
                                <span
                                  className="h-3 w-3 rounded-full bg-blue-500 flex-shrink-0"
                                  title="Low variance"
                                />
                              )}
                          </>
                        )}
                        {/* Sparkline for numeric columns */}
                        {stats?.numeric_stats && showStats && (
                          <div className="flex-shrink-0">
                            <Sparkline
                              data={[
                                stats.numeric_stats.percentile_5 || 0,
                                stats.numeric_stats.percentile_25 || 0,
                                stats.numeric_stats.percentile_50 || 0,
                                stats.numeric_stats.percentile_75 || 0,
                                stats.numeric_stats.percentile_95 || 0,
                              ]}
                              width={40}
                              height={12}
                            />
                          </div>
                        )}
                      </div>
                      <ChevronDown className="mx-2 h-4 w-4 flex-shrink-0" />
                    </div>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <DropdownMenuContent align="start" className="w-72">
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onClick={() => column.toggleSorting(false)}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center">
                        <ArrowUpWideNarrow className="mr-2 h-4 w-4" />
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
                        <ArrowDownWideNarrow className="mr-2 h-4 w-4" />
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
                      <Group className="mr-2 h-4 w-4" />
                      <span>Group by</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Box className="mr-2 h-4 w-4" />
                      <span>Aggregate by</span>
                      <DropdownMenuShortcut>⌘+T</DropdownMenuShortcut>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onClick={() => onColumnAction?.('suggest-transformations', column.id)}
                    >
                      <Wrench className="mr-2 h-4 w-4" />
                      <span>Suggest transformations</span>
                    </DropdownMenuItem>
                    {stats?.categorical_stats && (
                      <DropdownMenuItem
                        onClick={() => onColumnAction?.('clean-categories', column.id)}
                      >
                        <Wrench className="mr-2 h-4 w-4" />
                        <span>Clean categories</span>
                      </DropdownMenuItem>
                    )}
                    {stats?.numeric_stats && (
                      <DropdownMenuItem
                        onClick={() => onColumnAction?.('detect-outliers', column.id)}
                      >
                        <Info className="mr-2 h-4 w-4" />
                        <span>Detect outliers</span>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => onColumnAction?.('check-relationships', column.id)}
                    >
                      <Info className="mr-2 h-4 w-4" />
                      <span>Check relationships</span>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Wrench className="mr-2 h-4 w-4" />
                    <span>Change column type</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Eye className="mr-2 h-4 w-4" />
                    <span>Hide column</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleRenameClick}>
                    <Pencil className="mr-2 h-4 w-4" />
                    <span>Rename</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {quickSummary && (
                <TooltipContent side="bottom">
                  <div className="max-w-xs text-xs">{quickSummary}</div>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Stats Section - Fixed height container */}
        {showStats && (
          <StatsContainer>
            {isLoadingStats ? (
              <div className="h-full flex items-center justify-center">
                <Loader className="h-4 w-4 animate-spin text-muted-foreground" />
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
  onColumnAction = () => {},
  datasetId,
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
          onColumnAction={onColumnAction}
          datasetId={datasetId}
        />
      </div>
    </Resizable>
  );
});

HeaderComponent.displayName = 'HeaderComponent';
