import { fireEvent, render, screen } from '@testing-library/react';
import { VariablePreviewCard } from './variable-preview-card';
import { VariableLineagePanel } from './variable-lineage-panel';

describe('VariablePreviewCard', () => {
  it('renders Paper 10d preview with Open in Responses and Used in', () => {
    const onOpen = jest.fn();
    const onUsed = jest.fn();
    render(
      <VariablePreviewCard
        label="Satisfaction with service"
        kind="Single · 5-point"
        fileNote="panel.csv · 3 answered"
        bars={[
          { label: 'Very satisfied', percent: 28 },
          { label: 'Satisfied', percent: 43 },
        ]}
        usedByCount={4}
        onOpenInResponses={onOpen}
        onUsedIn={onUsed}
      />
    );
    expect(screen.getByText('Satisfaction with service')).toBeInTheDocument();
    expect(screen.getByText('Single · 5-point')).toBeInTheDocument();
    expect(screen.getByText('Very satisfied')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open in Responses' }));
    expect(onOpen).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Used in 4 places' }));
    expect(onUsed).toHaveBeenCalled();
  });
});

describe('VariableLineagePanel', () => {
  it('shows Built from, Used by, and Restore for removed respondents', () => {
    const onRestore = jest.fn();
    render(
      <VariableLineagePanel
        label="Satisfaction with service"
        builtFrom={[{ title: 'As uploaded in panel.csv', kind: 'file', name: 'panel.csv' }]}
        usedBy={[
          { title: 'Satisfaction (top-2 box) · derived', kind: 'column', id: 'sat_top2' },
          { title: 'T7 · Satisfaction by region', kind: 'table', id: 't7' },
        ]}
        removedCases={[
          { case_id: 'a', respondent_label: 'R1' },
          { case_id: 'b', respondent_label: 'R2' },
        ]}
        onRestore={onRestore}
      />
    );
    expect(screen.getByText('Built from')).toBeInTheDocument();
    expect(screen.getByText('Used by')).toBeInTheDocument();
    expect(screen.getByText('2 removed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(onRestore).toHaveBeenCalledWith(['a', 'b']);
  });
});
