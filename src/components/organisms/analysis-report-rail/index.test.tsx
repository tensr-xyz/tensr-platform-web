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

  it('lists every banner stub with the spreadsheet column type and drops legacy aliases', () => {
    const datasetId = '1b401802-7ee5-42f5-9144-6f37bc084e42';
    useTabsStore.setState({
      tabs: [
        {
          id: 'sheet-1',
          name: 'cars',
          content: '',
          isDirty: false,
          type: ViewType.SPREADSHEET,
          data: {
            datasetId,
            initialColumns: [
              { id: 'Q7', accessor: 'Q7', header: 'Q7', width: 80, type: 'number' },
              { id: 'Q8', accessor: 'Q8', header: 'Q8', width: 80, type: 'string' },
              { id: 'Age', accessor: 'Age', header: 'Age', width: 80, type: 'number' },
              { id: 'Region', accessor: 'Region', header: 'Region', width: 80, type: 'string' },
            ],
          },
        },
        {
          id: 'report-1',
          name: 'Banner',
          content: '',
          isDirty: false,
          type: ViewType.ANALYSIS_RESULT,
          data: { sourceDatasetId: datasetId },
        },
      ],
      activeTabId: 'report-1',
    });
    const banner = {
      ...report,
      analysis_spec: {
        analysis_key: 'banner_table',
        inputs: {
          stub_column: 'Q7',
          stubs: [{ column: 'Q7' }, { column: 'Q8' }, { column: 'Age' }],
          banner_column: 'Region',
          column_a: 'Q7',
          column_b: 'Age',
        },
      },
    } as AnalysisReport;

    render(<AnalysisReportRail report={banner} outline={[]} />);

    expect(screen.getAllByText('Q7')).toHaveLength(1);
    expect(screen.getByText('Q8')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(screen.getByText('Region')).toBeInTheDocument();
    const q7 = screen.getByText('Q7').closest('button');
    expect(q7?.textContent).toContain('#');
    expect(q7?.textContent).not.toContain('T');
  });
});
