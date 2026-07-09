'use client';

import { Button } from '@/components/atoms/button';
import { Checkbox } from '@/components/atoms/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/molecules/dropdown';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/molecules/table';
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from '@tanstack/react-table';
import { ArrowUpDown, ChevronDown, FileText, Filter, Folder, MoreHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Project, ProjectStatus } from '@/types/project';
import { cn } from '@/utils';

type DisplayStatus = 'Active' | 'Completed' | 'Archived';

const STATUS_FILTERS = ['all', 'active', 'completed', 'archived'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_STYLES: Record<DisplayStatus, { bg: string; fg: string }> = {
  Active: { bg: 'bg-emerald-500/10', fg: 'text-emerald-600 dark:text-emerald-400' },
  Completed: { bg: 'bg-primary/10', fg: 'text-primary' },
  Archived: { bg: 'bg-muted', fg: 'text-muted-foreground' },
};

interface ProjectsTableProps {
  data: Project[];
  onRowClick: (id: string) => void;
  onDelete?: (id: string) => void;
  deletingId?: string | null;
  statusFilterFn: (project: Project, filter: string) => boolean;
  projectColor: (id: string) => string;
  displayStatus: (status: ProjectStatus) => DisplayStatus;
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hr ago`;
    if (date.toDateString() === now.toDateString()) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'Unknown';
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export const ProjectsTable = ({
  data,
  onRowClick,
  onDelete,
  deletingId,
  statusFilterFn,
  projectColor,
  displayStatus,
}: ProjectsTableProps) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filteredData = useMemo(
    () => data.filter(p => statusFilterFn(p, statusFilter)),
    [data, statusFilter, statusFilterFn]
  );

  const columns: ColumnDef<Project>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={value => row.toggleSelected(!!value)}
          aria-label="Select row"
          onClick={e => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'projectName',
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="-ml-3 h-8 gap-1 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Dataset
          <ArrowUpDown className="size-3" aria-hidden />
        </Button>
      ),
      cell: ({ row }) => {
        const project = row.original;
        const color = projectColor(project.projectId);
        const isFolder = project.sourceType === 'folder' || project.sourceType === 'git';
        const fileCount = project.files?.length ?? 0;

        return (
          <div className="flex items-center gap-3">
            <span
              className="grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-muted/30"
              style={{ color }}
            >
              {isFolder ? (
                <Folder className="size-4" aria-hidden />
              ) : (
                <FileText className="size-4" aria-hidden />
              )}
            </span>
            <div className="min-w-0">
              <div className="truncate font-medium text-foreground">{project.projectName}</div>
              <div className="text-xs text-muted-foreground">
                {fileCount > 0
                  ? `${fileCount} ${fileCount === 1 ? 'file' : 'files'}`
                  : project.sourceType}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: 'displayStatus',
      header: () => (
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Status
        </span>
      ),
      cell: ({ row }) => {
        const status = displayStatus(row.original.status);
        const style = STATUS_STYLES[status];
        return (
          <span
            className={cn(
              'inline-flex h-[22px] items-center gap-1.5 rounded-full px-2.5 text-xs font-medium',
              style.bg,
              style.fg
            )}
          >
            <span className="size-1.5 rounded-full bg-current" aria-hidden />
            {status}
          </span>
        );
      },
    },
    {
      accessorKey: 'size',
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="-ml-3 h-8 gap-1 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Size
          <ArrowUpDown className="size-3" aria-hidden />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {formatSize((row.getValue('size') as number) || 0)}
        </span>
      ),
    },
    {
      id: 'fileCount',
      header: () => (
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Files
        </span>
      ),
      cell: ({ row }) => {
        const fileCount = row.original.files?.length ?? 0;
        return (
          <span className="text-sm tabular-nums text-muted-foreground">
            {fileCount} {fileCount === 1 ? 'file' : 'files'}
          </span>
        );
      },
    },
    {
      accessorKey: 'updatedAt',
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="-ml-3 h-8 gap-1 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Updated
          <ArrowUpDown className="size-3" aria-hidden />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDate((row.getValue('updatedAt') as string) || row.original.createdAt || '')}
        </span>
      ),
    },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => {
        const project = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={e => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" aria-hidden />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={e => {
                  e.stopPropagation();
                  onRowClick(project.projectId);
                }}
              >
                Open dataset
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={e => e.stopPropagation()}>Export data</DropdownMenuItem>
              <DropdownMenuItem onClick={e => e.stopPropagation()}>Share dataset</DropdownMenuItem>
              {onDelete ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    disabled={deletingId === project.projectId}
                    onClick={e => {
                      e.stopPropagation();
                      onDelete(project.projectId);
                    }}
                  >
                    {deletingId === project.projectId ? 'Deleting…' : 'Delete dataset'}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: filteredData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: { sorting, columnFilters, columnVisibility, rowSelection },
  });

  return (
    <div className="w-full text-left">
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">All datasets</span>
            <span className="font-mono text-xs text-muted-foreground">{filteredData.length}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-0.5 rounded-full border border-border bg-muted/40 p-0.5">
              {STATUS_FILTERS.map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setStatusFilter(f)}
                  className={cn(
                    'h-7 shrink-0 whitespace-nowrap rounded-full px-2.5 text-xs font-medium capitalize transition-colors',
                    statusFilter === f
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full text-xs">
                  <Filter className="size-3" aria-hidden />
                  Columns
                  <ChevronDown className="size-3" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {table
                  .getAllColumns()
                  .filter(column => column.getCanHide())
                  .map(column => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={value => column.toggleVisibility(!!value)}
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id} className="bg-muted/30 hover:bg-muted/30">
                {headerGroup.headers.map(header => (
                  <TableHead key={header.id} className="h-10">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className="cursor-pointer"
                  onClick={() => onRowClick(row.original.projectId)}
                >
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id} className="py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-12 text-left">
                  <p className="text-sm font-medium text-foreground">No datasets to show</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {data.length === 0
                      ? 'Upload a dataset using the actions above.'
                      : 'Try a different status filter or clear your search.'}
                  </p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 py-4">
        <p className="text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{' '}
          {table.getFilteredRowModel().rows.length} selected
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};
