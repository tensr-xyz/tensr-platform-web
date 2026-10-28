import { fireEvent, render, screen } from '@testing-library/react';

import type { SchemaColumn } from '@/lib/analysis-report-types';

import { MultiColumnPicker } from './multi-column-picker';

const SCHEMA: SchemaColumn[] = [{ name: 'Q1_top2', type: 'numeric', missing_count: 0 }];

describe('MultiColumnPicker minimum', () => {
  it('waits to say select at least one variable until the user edits or Run', () => {
    render(
      <MultiColumnPicker
        selected={[]}
        onChange={() => undefined}
        schema={SCHEMA}
        minSelected={1}
        selectionNoun="variable"
        revealSelectionError={false}
      />
    );
    expect(screen.queryByText('Select at least one variable.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Q1_top2/ }));
    expect(screen.getByText('Select at least one variable.')).toBeInTheDocument();
  });

  it('shows the variable error when Run asks for it', () => {
    render(
      <MultiColumnPicker
        selected={[]}
        onChange={() => undefined}
        schema={SCHEMA}
        minSelected={1}
        selectionNoun="variable"
        revealSelectionError
      />
    );
    expect(screen.getByText('Select at least one variable.')).toBeInTheDocument();
  });
});
