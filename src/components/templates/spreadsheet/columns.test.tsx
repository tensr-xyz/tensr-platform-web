import React from 'react';
import { render, screen } from '@testing-library/react';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { createColumns } from './columns';

function IdColumnProbe() {
  const data = [
    { id: 1, score: 10 },
    { id: 2, score: 20 },
  ];
  const columns = createColumns({
    initialColumns: [
      { id: 'id', header: 'id' },
      { id: 'score', header: 'score' },
    ],
    extraColumnsCount: 0,
    setData: () => undefined,
    DEFAULT_COLUMN_WIDTH: 120,
  });
  const table = useReactTable({
    data,
    columns,
    getRowId: (_row, index) => `row-${index}`,
    getCoreRowModel: getCoreRowModel(),
  });
  return (
    <div>
      {table.getRowModel().rows.map(row => (
        <div key={row.id}>
          {row.getVisibleCells().map(cell => (
            <span key={cell.id}>{String(cell.getValue() ?? '')}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

describe('spreadsheet columns', () => {
  it('renders a column named id', () => {
    render(<IdColumnProbe />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });
});
