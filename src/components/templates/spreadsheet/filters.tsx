import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Table } from '@tanstack/react-table';
import { Button } from '@/components/atoms/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { Input } from '@/components/atoms/input';
import { Plus, X } from 'lucide-react';
import { Separator } from '@/components/atoms/separator';

const FILTER_OPERATORS = {
  greaterThan: 'greater than',
  lessThan: 'less than',
  equals: 'equals',
  contains: 'contains',
};

interface TableFilterProps {
  table: Table<any>;
  onClearFilters: () => void;
  onCloseFilters: () => void;
  onFetchFilteredData: any;
}

const Filters = ({
  table,
  onClearFilters,
  onCloseFilters,
  onFetchFilteredData,
}: TableFilterProps) => {
  const [selectedColumn, setSelectedColumn] = useState('');
  const [selectedOperator, setSelectedOperator] = useState('greaterThan');
  const [filterValue, setFilterValue] = useState('');
  const valueInputRef = useRef<HTMLInputElement>(null);

  // Listen for "filter this column" requests from the column header dropdown
  // and from the agent panel (chat). The agent payload may include an
  // operator/value so the filter row is pre-populated.
  useEffect(() => {
    const onFilterColumn = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          columnId?: string;
          operator?: string;
          value?: unknown;
        }>
      ).detail;
      if (!detail?.columnId) return;
      setSelectedColumn(detail.columnId);
      if (detail.operator && detail.operator in FILTER_OPERATORS) {
        setSelectedOperator(detail.operator);
      }
      if (detail.value !== undefined && detail.value !== null) {
        setFilterValue(String(detail.value));
      }
      requestAnimationFrame(() => valueInputRef.current?.focus());
    };
    window.addEventListener('tensr:filter-column', onFilterColumn as EventListener);
    return () => window.removeEventListener('tensr:filter-column', onFilterColumn as EventListener);
  }, []);

  const columns = useMemo(() => {
    return table
      .getAllColumns()
      .filter(column => column.id !== 'select' && !column.id.startsWith('extra'))
      .map(column => ({
        id: column.id,
        title: column.columnDef.header?.toString() || column.id,
      }));
  }, [table]);

  const applyFilter = useCallback(() => {
    if (!selectedColumn || !filterValue) return;

    const column = table.getColumn(selectedColumn);
    if (!column) {
      return;
    }

    const newFilter = {
      id: selectedColumn,
      value: {
        operator: selectedOperator,
        value: filterValue,
      },
    };

    // Directly call the fetch method with the new filter
    onFetchFilteredData([newFilter]);

    // Clear input fields after applying
    setSelectedColumn('');
    setFilterValue('');
  }, [table, selectedColumn, selectedOperator, filterValue, onFetchFilteredData]);

  const handleClearFilter = useCallback(() => {
    setSelectedColumn('');
    setSelectedOperator('greaterThan');
    setFilterValue('');
    onClearFilters();
  }, [onClearFilters]);

  return (
    <div className="flex flex-row items-center gap-4 p-1 min-h-12">
      <Button className="h-8 min-w-8" size="icon" variant="ghost" onClick={onCloseFilters}>
        <X />
      </Button>

      {/* Column Select */}
      <Select value={selectedColumn} onValueChange={setSelectedColumn}>
        <SelectTrigger className="h-8 max-w-64">
          <SelectValue placeholder="Select column" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {columns.map(column => (
              <SelectItem key={column.id} value={column.id}>
                {column.title}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      {/* Operator Select */}
      <Select value={selectedOperator} onValueChange={setSelectedOperator}>
        <SelectTrigger className="h-8 max-w-64">
          <SelectValue placeholder="Select operator" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {Object.entries(FILTER_OPERATORS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      {/* Value Input */}
      <Input
        ref={valueInputRef}
        className="max-w-xs"
        inputSize="sm"
        variant="outline"
        value={filterValue}
        onChange={e => setFilterValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            applyFilter();
          }
        }}
      />

      <Separator orientation="vertical" className="h-4 mx-2" />

      <Button
        className="flex flex-row items-center gap-2 h-8"
        size="sm"
        variant="outline"
        onClick={applyFilter}
      >
        <Plus />
        <div>Apply filter</div>
      </Button>

      <Button className="h-8" size="sm" variant="link" onClick={handleClearFilter}>
        Clear filter
      </Button>
    </div>
  );
};

export default Filters;
