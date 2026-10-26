import React from 'react';
import { render, screen } from '@testing-library/react';
import { AnalysisReportRail } from '@/components/organisms/analysis-report-rail';
import type { AnalysisReport } from '@/lib/analysis-report-types';
import { useTabsStore, ViewType, type Column } from '@/stores/tabs-store';

const initialColumns: Column[] = [
  { id: 'Age', accessor: 'Age', header: 'Age', width: 80, type: 'number' },
];

const report = {
  meta: {
    analysis_key: 'linear_regression',
    title: 'Age on the outcome',
    subtitle: '',
    generated_at: '2026-10-26T12:00:00.000Z',
    rows_dataset: 10,
  },
  summary: '',
  metrics: [],
  tables: [],
  trust: { notes: [], warnings: [] },
  analysis_spec: {
    analysis_key: 'linear_regression',
    inputs: { dependent_variable: 'Age' },
  },
} as AnalysisReport;

describe('AnalysisReportRail column snapshot', () => {
  beforeEach(() => {
    useTabsStore.setState({
      tabs: [
        {
          id: 'sheet-1',
          name: 'cars',
          content: '',
          isDirty: false,
          type: ViewType.SPREADSHEET,
          data: { initialColumns },
        },
      ],
      activeTabId: 'sheet-1',
    });
  });

  it('renders the rail twice with the same store state and stays at one render', () => {
    let renders = 0;
    const Observed = React.memo(function ObservedRail() {
      renders += 1;
      return <AnalysisReportRail report={report} outline={[]} />;
    });

    const { rerender } = render(<Observed />);
    rerender(<Observed />);

    expect(renders).toBe(1);
    expect(screen.getAllByText('Age')).toHaveLength(1);
  });
});
