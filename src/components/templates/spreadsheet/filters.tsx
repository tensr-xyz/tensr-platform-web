import { useCallback, useMemo, useState } from 'react';
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
import { LuPlus, LuX } from 'react-icons/lu';
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
        <LuX />
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
        className="max-w-xs"
        inputSize="sm"
        variant="outline"
        value={filterValue}
        onChange={e => setFilterValue(e.target.value)}
      />

      <Separator orientation="vertical" className="h-4 mx-2" />

      <Button
        className="flex flex-row items-center gap-2 h-8"
        size="sm"
        variant="outline"
        onClick={applyFilter}
      >
        <LuPlus />
        <div>Apply filter</div>
      </Button>

      <Button className="h-8" size="sm" variant="link" onClick={handleClearFilter}>
        Clear filter
      </Button>
    </div>
  );
};

export default Filters;
