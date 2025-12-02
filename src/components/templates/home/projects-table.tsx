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
import {
  AlertCircle,
  Archive,
  ArrowUpDown,
  CheckCircle,
  ChevronDown,
  FileText,
  MoreHorizontal,
} from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/atoms/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/molecules/table';

interface Project {
  id?: string;
  projectId?: string;
  name: string;
  created: string;
  status: 'Active' | 'Completed' | 'Archived' | string;
  dataPoints: number;
  analysisTypes: string[];
  lastModified: string;
}

interface ProjectsTableProps {
  data: Project[];
  onRowClick: (id: string) => void;
}

export const ProjectsTable = ({ data, onRowClick }: ProjectsTableProps) => {
  // Debug logging
  console.log('ProjectsTable - data received:', data);
  console.log('ProjectsTable - first project:', data[0]);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});

  // Format date function
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();

      // If today
      if (date.toDateString() === now.toDateString()) {
        return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }

      // If yesterday
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
        return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }

      // Otherwise show the full date
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (e) {
      return 'Unknown date';
    }
  };

  // Define columns
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
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Project Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const project = row.original;
        return (
          <div className="flex items-center">
            <div className="shrink-0 h-10 w-10 flex items-center justify-center bg-blue-50 rounded-sm">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div className="ml-4">
              <div className="text-sm text-gray-900">{project.projectName}</div>
              <div className="text-xs text-gray-500">Created: {formatDate(project.createdAt)}</div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        const getStatusColor = (status: string): string => {
          switch (status) {
            case 'Active':
              return 'bg-green-100 text-green-800';
            case 'Completed':
              return 'bg-blue-100 text-blue-800';
            case 'Archived':
              return 'bg-gray-100 text-gray-800';
            default:
              return 'bg-yellow-100 text-yellow-800';
          }
        };

        const getStatusIcon = (status: string) => {
          switch (status) {
            case 'Active':
              return <CheckCircle className="mr-1 h-4 w-4" />;
            case 'Completed':
              return <CheckCircle className="mr-1 h-4 w-4" />;
            case 'Archived':
              return <Archive className="mr-1 h-4 w-4" />;
            default:
              return <AlertCircle className="mr-1 h-4 w-4" />;
          }
        };

        return (
          <div
            className={`flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}
          >
            {getStatusIcon(status)}
            <span>{status}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'size',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Size
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const size = row.getValue('size') as number;
        const formatSize = (bytes: number): string => {
          if (bytes === 0) return '0 B';
          const k = 1024;
          const sizes = ['B', 'KB', 'MB', 'GB'];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        };
        return <div className="text-sm">{formatSize(size || 0)}</div>;
      },
    },
    {
      accessorKey: 'fileCount',
      header: 'Files',
      cell: ({ row }) => {
        const fileCount = (row.getValue('fileCount') as number) || 0;
        return (
          <div className="text-sm">
            {fileCount} file{fileCount !== 1 ? 's' : ''}
          </div>
        );
      },
    },
    {
      accessorKey: 'updatedAt',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Last Modified
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const updatedAt = row.getValue('updatedAt') as string;
        return <div className="text-sm">{formatDate(updatedAt || '')}</div>;
      },
    },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => {
        const project = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={e => {
                  e.stopPropagation();
                  console.log(
                    'ProjectsTable - Open project clicked with projectId:',
                    project.projectId
                  );
                  onRowClick(project.projectId);
                }}
              >
                Open project
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={e => e.stopPropagation()}>Export data</DropdownMenuItem>
              <DropdownMenuItem onClick={e => e.stopPropagation()}>Share project</DropdownMenuItem>
              <DropdownMenuItem onClick={e => e.stopPropagation()}>
                Duplicate project
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={e => e.stopPropagation()} className="text-red-600">
                Delete project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  return (
    <div className="w-full">
      <div className="flex items-center py-4">
        <Input
          placeholder="Filter projects..."
          value={(table.getColumn('projectName')?.getFilterValue() as string) ?? ''}
          onChange={event => table.getColumn('projectName')?.setFilterValue(event.target.value)}
          className="max-w-sm bg-background"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              Columns <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter(column => column.getCanHide())
              .map(column => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={value => column.toggleVisibility(!!value)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="rounded-md border border-border bg-background">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  onClick={() => {
                    console.log('ProjectsTable - Row clicked, row.original:', row.original);
                    onRowClick(row.original.projectId || row.original.id);
                  }}
                  className="cursor-pointer"
                >
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{' '}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
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
