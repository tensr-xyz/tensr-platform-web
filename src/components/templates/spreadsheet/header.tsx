import React, { useRef, useCallback, useState, useMemo } from 'react';
import {
  ArrowDownWideNarrow,
  ArrowUpDown,
  ArrowUpWideNarrow,
  Box,
  Eye,
  EyeOff,
  Filter as FilterIcon,
  Users as Group,
  Loader2 as Loader,
  Pencil,
  Trash2,
  Wrench,
  Info,
  Check,
  Copy,
  Pin,
  Palette,
} from 'lucide-react';
import { EditableCell, EditableCellRef } from '@/components/molecules/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/molecules/dropdown';
import { Column, Header, Table } from '@tanstack/react-table';
import { ColumnSummary } from '@/types/project';
import type { Column as TabColumn } from '@/stores/tabs-store';
import { cn } from '@/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/atoms/tooltip';
import { Sparkline } from '@/components/molecules/sparkline';
import { CategoricalFreqBars } from '@/components/molecules/categorical-freq-bars';
import {
  ColumnTypeBadge,
  getColumnSummary,
  resolveColumnIsNumeric,
} from '@/components/molecules/column-type-badge';
import { MeasurementLevelControl } from '@/components/molecules/measurement-level-control';
import type { ColumnMetadataMap } from '@/lib/dataset-metadata';
import { resolveMeasurementLevel, type MeasurementLevel } from '@/lib/measurement-level';

interface HeaderCellProps {
  column: Column<any>;
  showStats: boolean;
  stats?: ColumnSummary;
  isNumeric: boolean;
  isLoadingStats: boolean;
  onHeaderEdit?: (value: string) => void;
  onColumnAction?: (action: string, columnId: string) => void;
  datasetId?: string;
  metadataDatasetId?: string | null;
  columnMetadata?: ColumnMetadataMap;
  onMeasurementLevelChange?: (columnId: string, level: MeasurementLevel) => void;
  heatmapEnabled?: boolean;
  freezeUpToColumnId?: string | null;
  visibleColumnIds?: string[];
}

interface HeaderComponentProps {
  header: Header<any, unknown>;
  table: Table<any>;
  showStats: boolean;
  columnStats?: Record<string, ColumnSummary>;
  initialColumns?: any[];
  columnSampleValues?: Record<string, unknown[]>;
  onHeaderEdit?: (columnId: string, value: string) => void;
  isLoadingStats: boolean;
  onColumnAction?: (action: string, columnId: string) => void;
  datasetId?: string;
  metadataDatasetId?: string | null;
  columnMetadata?: ColumnMetadataMap;
  onMeasurementLevelChange?: (columnId: string, level: MeasurementLevel) => void;
  heatmapColumns?: Record<string, boolean>;
  freezeUpToColumnId?: string | null;
}

// Stats container component to ensure consistent heights
const StatsContainer = ({ children }: { children: React.ReactNode }) => (
  <div className="h-[220px] overflow-y-auto">
    <div className="p-2 text-xs">{children}</div>
  </div>
);

const HeaderCell = React.memo<HeaderCellProps>(
  ({
    column,
    showStats,
    stats,
    isNumeric,
    isLoadingStats,
    onHeaderEdit,
    onColumnAction,
    datasetId,
    metadataDatasetId = null,
    columnMetadata,
    onMeasurementLevelChange,
    heatmapEnabled = false,
    freezeUpToColumnId = null,
    visibleColumnIds = [],
  }) => {
    const hasStats = stats?.numeric_stats || stats?.categorical_stats;
    const editableCellRef = useRef<EditableCellRef>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const freezeIndex = freezeUpToColumnId ? visibleColumnIds.indexOf(freezeUpToColumnId) : -1;
    const colIndex = visibleColumnIds.indexOf(column.id);
    const isFrozen = freezeIndex >= 0 && colIndex >= 0 && colIndex <= freezeIndex;

    const sparklineData = useMemo(() => {
      if (!stats?.numeric_stats) return null;
      const n = stats.numeric_stats;
      return [
        n.min ?? n.percentile_5 ?? 0,
        n.percentile_25 ?? n.min ?? 0,
        n.percentile_50 ?? n.mean ?? 0,
        n.percentile_75 ?? n.max ?? 0,
        n.max ?? n.percentile_95 ?? 0,
      ].map(v => (v === undefined || v === null ? 0 : Number(v)));
    }, [stats?.numeric_stats]);

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

    const sortState = column.getIsSorted();
    const handleSortClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (sortState === 'asc') {
        column.toggleSorting(true);
      } else if (sortState === 'desc') {
        column.clearSorting();
      } else {
        column.toggleSorting(false);
      }
    };

    return (
      <div className="flex h-full w-full flex-col bg-muted/40">
        <div
          className={cn(
            'relative z-20 flex h-8 shrink-0 min-w-0 items-center gap-1 border-b border-border pl-2 pr-1 text-[11px] font-normal tracking-wide',
            (isEditing || dropdownOpen) && 'outline outline-2 outline-primary outline-offset-[-2px]'
          )}
        >
          <div className="flex min-w-0 flex-1 items-center overflow-hidden">
            {isEditing ? (
              <EditableCell
                ref={editableCellRef}
                value={column.columnDef.header as string}
                onEdit={value => {
                  setIsEditing(false);
                  onHeaderEdit?.(value);
                }}
                className="h-8 min-w-0 flex-1 font-normal"
                inputClassName="z-20 relative outline outline-2 -outline-offset-2 outline-primary"
                isFocused
                onBlur={() => {
                  setTimeout(() => setIsEditing(false), 50);
                }}
                onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === 'Escape') {
                    setIsEditing(false);
                  }
                }}
              />
            ) : (
              <DropdownMenu modal={false} open={dropdownOpen} onOpenChange={setDropdownOpen}>
                <DropdownMenuTrigger asChild onClick={handleDropdownTriggerClick}>
                  <button
                    type="button"
                    title={quickSummary || undefined}
                    className={cn(
                      'flex h-8 min-w-0 flex-1 items-center gap-1 overflow-hidden rounded-sm px-1.5 text-left hover:bg-muted/60',
                      dropdownOpen && 'bg-muted/60'
                    )}
                    onDoubleClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRenameClick();
                    }}
                  >
                    {heatmapEnabled ? (
                      <span
                        className="size-1.5 shrink-0 rounded-full bg-[hsl(250,100%,63%)]"
                        title="Heatmap active"
                        aria-hidden
                      />
                    ) : null}
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate font-normal',
                        heatmapEnabled && 'text-[hsl(250,100%,63%)]'
                      )}
                    >
                      {column.columnDef.header as string}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-72"
                  onCloseAutoFocus={e => e.preventDefault()}
                >
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
                    <DropdownMenuItem onClick={() => onColumnAction?.('filter', column.id)}>
                      <FilterIcon className="mr-2 h-4 w-4" />
                      <span>Filter…</span>
                    </DropdownMenuItem>
                    {isNumeric && (
                      <DropdownMenuCheckboxItem
                        checked={heatmapEnabled}
                        onCheckedChange={() => onColumnAction?.('toggle-heatmap', column.id)}
                      >
                        <Palette className="mr-2 h-4 w-4" />
                        <span>Show heatmap</span>
                        {heatmapEnabled ? <Check className="ml-auto h-4 w-4 text-primary" /> : null}
                      </DropdownMenuCheckboxItem>
                    )}
                  </DropdownMenuGroup>
                  {metadataDatasetId ? (
                    <>
                      <DropdownMenuSeparator />
                      <MeasurementLevelControl
                        value={resolveMeasurementLevel(columnMetadata?.[column.id], isNumeric)}
                        onChange={level => onMeasurementLevelChange?.(column.id, level)}
                      />
                    </>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => onColumnAction?.('group-by', column.id)}>
                      <Group className="mr-2 h-4 w-4" />
                      <span>Group by</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onColumnAction?.('aggregate-by', column.id)}>
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
                  <DropdownMenuItem
                    onClick={() => {
                      column.toggleVisibility(false);
                      onColumnAction?.('hide-column', column.id);
                    }}
                  >
                    <EyeOff className="mr-2 h-4 w-4" />
                    <span>Hide column</span>
                  </DropdownMenuItem>
                  <DropdownMenuCheckboxItem
                    checked={isFrozen}
                    onCheckedChange={() => onColumnAction?.('toggle-freeze-column', column.id)}
                  >
                    <Pin className="mr-2 h-4 w-4" />
                    <span>{isFrozen ? 'Unfreeze column' : 'Freeze column'}</span>
                    {isFrozen ? <Check className="ml-auto h-4 w-4 text-primary" /> : null}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuItem
                    onClick={() => onColumnAction?.('show-hidden-columns', column.id)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    <span>Show hidden columns</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onColumnAction?.('copy-column', column.id)}>
                    <Copy className="mr-2 h-4 w-4" />
                    <span>Copy column</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleRenameClick}>
                    <Pencil className="mr-2 h-4 w-4" />
                    <span>Rename</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onColumnAction?.('delete-column', column.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Delete column</span>
                    <DropdownMenuShortcut className="text-muted-foreground">
                      ⌘Z to undo
                    </DropdownMenuShortcut>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1 pl-0.5">
            <ColumnTypeBadge isNumeric={isNumeric} variant="hint" />

            {stats && (
              <>
                {(stats.numeric_stats?.missing_count ??
                  stats.categorical_stats?.missing_count ??
                  0) >
                  (stats.numeric_stats?.count ?? stats.categorical_stats?.count ?? 1) * 0.1 && (
                  <span
                    className="size-2 shrink-0 rounded-full bg-amber-500"
                    title="High missingness"
                  />
                )}
                {stats.numeric_stats &&
                  stats.numeric_stats.std_dev !== undefined &&
                  stats.numeric_stats.std_dev < 0.01 && (
                    <span
                      className="size-2 shrink-0 rounded-full bg-sky-500"
                      title="Low variance"
                    />
                  )}
              </>
            )}

            {sparklineData ? <Sparkline data={sparklineData} width={32} height={12} /> : null}
            {stats?.categorical_stats?.top_frequencies?.length ? (
              <CategoricalFreqBars
                frequencies={stats.categorical_stats.top_frequencies}
                width={32}
                height={12}
              />
            ) : null}

            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="grid size-[18px] shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={e => {
                      e.stopPropagation();
                      onColumnAction?.('show-insight', column.id);
                    }}
                  >
                    <Info className="size-2.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <div className="text-xs">{quickSummary || 'Column insights'}</div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <button
              type="button"
              className="grid size-[18px] shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              title={isNumeric ? 'Numeric column' : 'Text column'}
              onClick={handleSortClick}
            >
              {sortState === 'asc' ? (
                <ArrowUpWideNarrow className="size-2.5" />
              ) : sortState === 'desc' ? (
                <ArrowDownWideNarrow className="size-2.5" />
              ) : (
                <ArrowUpDown className="size-2.5" />
              )}
            </button>
          </div>
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
                    <button
                      type="button"
                      className="text-left text-[11px] font-medium text-[hsl(250,100%,63%)] hover:underline"
                      onClick={() => onColumnAction?.('toggle-heatmap', column.id)}
                    >
                      {heatmapEnabled ? 'Hide heatmap' : 'Show heatmap'}
                    </button>
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
  initialColumns,
  columnSampleValues,
  onHeaderEdit,
  isLoadingStats,
  onColumnAction = () => {},
  datasetId,
  metadataDatasetId = null,
  columnMetadata,
  onMeasurementLevelChange,
  heatmapColumns = {},
  freezeUpToColumnId = null,
}) {
  const column = header.column;
  const visibleColumnIds = table
    .getVisibleLeafColumns()
    .map(c => c.id)
    .filter(id => id !== 'select');
  const stats = getColumnSummary(column.id, columnStats);
  const colMeta = initialColumns?.find(c => c.id === column.id);
  const isNumeric = resolveColumnIsNumeric(
    column.id,
    columnStats,
    colMeta?.type,
    undefined,
    columnSampleValues?.[column.id]
  );
  if (column.id === 'select') {
    return (
      <div className="flex h-full w-full flex-col bg-muted/40">
        <div className="flex h-8 shrink-0 items-center justify-start px-3.5 border-b border-border font-mono text-[11px] font-normal text-muted-foreground">
          #
        </div>
        {showStats ? <div className="h-[220px]" /> : null}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full" style={{ width: column.getSize() }}>
      <HeaderCell
        column={column}
        showStats={showStats}
        stats={stats}
        isNumeric={isNumeric}
        onHeaderEdit={value => onHeaderEdit?.(column.id, value)}
        isLoadingStats={isLoadingStats}
        onColumnAction={onColumnAction}
        datasetId={datasetId}
        metadataDatasetId={metadataDatasetId}
        columnMetadata={columnMetadata}
        onMeasurementLevelChange={onMeasurementLevelChange}
        heatmapEnabled={!!heatmapColumns[column.id]}
        freezeUpToColumnId={freezeUpToColumnId}
        visibleColumnIds={visibleColumnIds}
      />
      <div
        onMouseDown={header.getResizeHandler()}
        onTouchStart={header.getResizeHandler()}
        className={cn(
          'absolute right-0 top-0 z-50 h-full w-1.5 -mr-0.5 cursor-col-resize touch-none select-none hover:bg-primary/40',
          header.column.getIsResizing() && 'bg-primary/50'
        )}
        style={{ touchAction: 'none' }}
        aria-hidden
      />
    </div>
  );
});

HeaderComponent.displayName = 'HeaderComponent';
