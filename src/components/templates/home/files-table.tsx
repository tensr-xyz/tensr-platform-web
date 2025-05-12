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
import { ArrowUpDown, ChevronDown, FileText, MoreHorizontal, Upload } from 'lucide-react';
import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/molecules/table';

interface FileItem {
  fileId: string;
  fileName: string;
  fileType: string;
  size: number;
  uploadedAt?: string;
  createdAt?: string;
}

interface FilesTableProps {
  data: FileItem[];
  onRowClick: (fileId: string) => void;
  isLoading: boolean;
  onRefresh: () => void;
  error: string | null;
  hideControls?: boolean; // New prop to optionally hide the table controls
}

export const FilesTable = ({
  data,
  onRowClick,
  isLoading,
  onRefresh,
  error,
  hideControls = false,
}: FilesTableProps) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});

  // Function to format date
  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'Unknown date';

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

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Function to get file icon
  const getFileIcon = (fileType: string) => {
    const type = fileType.toLowerCase();
    if (type.includes('csv')) {
      return <FileText className="h-5 w-5 text-green-600" />;
    } else if (type.includes('xlsx') || type.includes('excel')) {
      return <FileText className="h-5 w-5 text-blue-600" />;
    } else if (type.includes('pdf')) {
      return <FileText className="h-5 w-5 text-red-600" />;
    } else {
      return <FileText className="h-5 w-5 text-gray-600" />;
    }
  };

  // Define columns
  const columns: ColumnDef<FileItem>[] = [
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
      accessorKey: 'fileName',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            File Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const file = row.original;
        return (
          <div className="flex items-center">
            <div className="shrink-0 h-10 w-10 flex items-center justify-center bg-gray-100 rounded-sm">
              {getFileIcon(file.fileType)}
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-900">{file.fileName}</div>
              <div className="text-xs text-gray-500">{file.fileId?.substring(0, 8)}...</div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'fileType',
      header: 'Type',
      cell: ({ row }) => {
        const fileType = (row.getValue('fileType') as string)?.split('/').pop();
        return <div className="text-sm">{fileType}</div>;
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
        return <div className="text-sm">{formatFileSize(size)}</div>;
      },
    },
    {
      accessorKey: 'uploadedAt',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Uploaded
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const file = row.original;
        const uploadDate = file.uploadedAt || file.createdAt;
        return <div className="text-sm">{formatDate(uploadDate)}</div>;
      },
    },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => {
        const file = row.original;

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
                  onRowClick(file.fileId);
                }}
              >
                Open file
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={e => e.stopPropagation()}>Download file</DropdownMenuItem>
              <DropdownMenuItem onClick={e => e.stopPropagation()}>Share file</DropdownMenuItem>
              <DropdownMenuItem onClick={e => e.stopPropagation()}>Add to project</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={e => e.stopPropagation()} className="text-red-600">
                Delete file
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

  // If there's an error or loading, show appropriate UI
  if (isLoading && data.length === 0) {
    return (
      <div className="px-6 py-10 text-center text-gray-500">
        <p>Loading files...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6 py-10 text-center text-red-500">
        <p>Error loading files: {error}</p>
        <button
          onClick={onRefresh}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="px-6 py-16 text-center text-gray-500">
        <div className="max-w-sm mx-auto">
          <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Upload className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-gray-700 text-lg font-medium mb-2">No files found</p>
          <p className="text-gray-500 mb-6">Upload a file to get started with your analysis</p>
          <Button className="flex items-center space-x-2 mx-auto">
            <Upload className="h-4 w-4 mr-2" />
            <span>Upload File</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Conditionally render the controls based on the hideControls prop */}
      {!hideControls && (
        <div className="flex items-center justify-between py-4">
          <input
            placeholder="Filter files..."
            value={(table.getColumn('fileName')?.getFilterValue() as string) ?? ''}
            onChange={event => table.getColumn('fileName')?.setFilterValue(event.target.value)}
            className="max-w-sm border border-border p-2 h-10 pl-4 bg-white"
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={onRefresh} className="flex items-center">
              <span className="mr-1">Refresh</span>
              {isLoading && <span className="animate-spin h-4 w-4">↻</span>}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
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
        </div>
      )}
      <div className="rounded-md border border-border bg-white">
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
                  onClick={() => onRowClick(row.original.fileId)}
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
