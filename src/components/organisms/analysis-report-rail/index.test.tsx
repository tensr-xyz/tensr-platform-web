import React from 'react';
import { render, screen } from '@testing-library/react';
import { AnalysisReportRail } from '@/components/organisms/analysis-report-rail';
import type { AnalysisReport } from '@/lib/analysis-report-types';
import cases from '@/lib/analysis-spec-dialog-cases.json';
import {
  installAnalysisSpecs,
  resetAnalysisSpecs,
  type AnalysisSpec,
} from '@/lib/analysis-spec-setup';
import { isRawParamLabel, railParamLabel } from '@/lib/analysis-report-rail-labels';
import { useTabsStore, ViewType, type Column } from '@/stores/tabs-store';

type DialogCase = {
  key: string;
  params: {
    name: string;
    type: string;
    role: string;
    label: string;
    default: unknown;
    displayDefault?: string;
    columnTypes?: string[];
  }[];
};

const DIALOG_CASES = cases as DialogCase[];

function specFrom(row: DialogCase): AnalysisSpec {
  return {
    key: row.key,
    family: 'test',
    rReference: 'hand-written',
    outputs: [],
    params: row.params.map(param => ({
      name: param.name,
      type: param.type,
      role: param.role,
      label: param.label,
      default: param.default,
      displayDefault: param.displayDefault,
      columnTypes: param.columnTypes,
    })),
  };
}

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

  it('shows On and Off for boolean settings', () => {
    const withFlags = {
      ...report,
      analysis_spec: {
        analysis_key: 'linear_regression',
        inputs: { dependent_variable: 'Age', column_percent: true, include_constant: false },
      },
    } as AnalysisReport;
    render(<AnalysisReportRail report={withFlags} outline={[]} />);
    expect(screen.getByText('On')).toBeInTheDocument();
    expect(screen.getByText('Off')).toBeInTheDocument();
  });
});

describe('AnalysisReportRail spec labels', () => {
  beforeEach(() => {
    installAnalysisSpecs(DIALOG_CASES.map(specFrom));
    useTabsStore.setState({
      tabs: [
        {
          id: 'sheet-1',
          name: 'cars',
          content: '',
          isDirty: false,
          type: ViewType.SPREADSHEET,
          data: {
            initialColumns: [
              { id: 'Q7', accessor: 'Q7', header: 'Q7', width: 80, type: 'number' },
              { id: 'gender', accessor: 'gender', header: 'gender', width: 80, type: 'string' },
            ],
          },
        },
      ],
      activeTabId: 'sheet-1',
    });
  });

  afterEach(() => {
    resetAnalysisSpecs();
  });

  it('shows chi-square row and column chips with types and the spec option labels', () => {
    const chiSquare = {
      ...report,
      meta: { ...report.meta, analysis_key: 'chi_square' },
      analysis_spec: {
        analysis_key: 'chi_square',
        inputs: {
          column_a: 'Q7',
          column_b: 'gender',
          include_phi: true,
          include_cramers_v: true,
          use_fishers_exact: true,
        },
      },
    } as AnalysisReport;

    render(<AnalysisReportRail report={chiSquare} outline={[]} />);

    const row = screen.getByText('Q7').closest('button');
    const column = screen.getByText('gender').closest('button');
    expect(row?.textContent).toContain('Row variable');
    expect(row?.textContent).toContain('#');
    expect(column?.textContent).toContain('Column variable');
    expect(column?.textContent).toContain('T');
    expect(screen.getByText('Phi')).toBeInTheDocument();
    expect(screen.getByText("Cramér's V")).toBeInTheDocument();
    expect(screen.getByText("Fisher's exact test")).toBeInTheDocument();
    expect(screen.queryByText('include phi')).not.toBeInTheDocument();
    expect(screen.queryByText('include cramers v')).not.toBeInTheDocument();
    expect(screen.queryByText('use fishers exact')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Open the setup dialog to change variables and run again')
    ).not.toBeInTheDocument();
  });

  it('fails when any op would show a raw parameter name', () => {
    for (const row of DIALOG_CASES) {
      for (const param of row.params) {
        const label = railParamLabel(row.key, param.name);
        expect({ key: row.key, name: param.name, label }).toEqual({
          key: row.key,
          name: param.name,
          label: param.label,
        });
        expect(isRawParamLabel(param.name, label)).toBe(false);
      }
    }
  });
});
