import { fireEvent, render, screen } from '@testing-library/react';
import { TableSignificancePanel } from './table-significance-panel';
import { DEFAULT_TABLE_SIGNIFICANCE } from '@/lib/table-significance';

describe('TableSignificancePanel', () => {
  it('renders Paper 9b fields and closes on Escape', () => {
    const onChange = jest.fn();
    const onClose = jest.fn();
    render(
      <TableSignificancePanel
        settings={DEFAULT_TABLE_SIGNIFICANCE}
        onChange={onChange}
        onClose={onClose}
        controlOptions={[{ value: 'North', label: 'North' }]}
      />
    );

    expect(screen.getByRole('heading', { name: 'Significance' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Letters' })).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('button', { name: 'Arrows vs total' })).toBeInTheDocument();
    expect(screen.getByLabelText('Many columns at once')).toBeInTheDocument();
    expect(screen.getByLabelText('Comparing means')).toBeInTheDocument();
    expect(screen.getByText('Make this the project default')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('updates show-as when a pill is pressed', () => {
    const onChange = jest.fn();
    render(
      <TableSignificancePanel
        settings={DEFAULT_TABLE_SIGNIFICANCE}
        onChange={onChange}
        controlOptions={[]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Off' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ showAs: 'off', confidence: 95 })
    );
  });
});
