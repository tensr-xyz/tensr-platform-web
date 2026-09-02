import { render, screen } from '@testing-library/react';
import type { AnalysisReport } from '@/lib/analysis-report-types';
import { PLUGIN_UNVERIFIED_STATEMENT } from '@/lib/analysis-runs';
import { AnalysisReportView } from './index';

function sampleReport(overrides: Partial<AnalysisReport> = {}): AnalysisReport {
  return {
    meta: {
      analysis_key: 'anova_oneway',
      title: 'One-Way ANOVA',
      subtitle: 'Age by Pos',
      generated_at: '2026-01-01T00:00:00.000Z',
      rows_dataset: 40,
    },
    summary: 'Groups differed.',
    metrics: [{ label: 'F', value: '12.3' }],
    tables: [],
    trust: { notes: [], warnings: [] },
    ...overrides,
  };
}

describe('AnalysisReportView provenance banner', () => {
  it('prints the Stage 3 unknown sentence when provenance is missing', () => {
    render(<AnalysisReportView report={sampleReport()} />);
    expect(screen.getByRole('status')).toHaveTextContent(/traceability unknown/i);
    expect(screen.getByRole('status')).toHaveTextContent(/no stored provenance/i);
    expect(screen.getByRole('status')).toHaveTextContent(
      /cannot be traced to the rows they came from/i
    );
  });

  it('prints unavailable with the reason, not the unknown sentence', () => {
    render(
      <AnalysisReportView
        report={sampleReport()}
        provenance={{ provenance_unavailable: 'multi_origin' }}
      />
    );
    expect(screen.getByRole('status')).toHaveTextContent(/provenance unavailable: multi_origin/i);
    expect(screen.queryByText(/traceability unknown/i)).not.toBeInTheDocument();
  });

  it('shows no provenance banner when the bitset is complete', () => {
    render(
      <AnalysisReportView
        report={sampleReport()}
        provenance={{ row_uid_bitset: 'BQ==', row_uid_bitset_miss_count: 0 }}
      />
    );
    expect(screen.queryByText(/traceability unknown/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/provenance unavailable/i)).not.toBeInTheDocument();
  });

  it('shows the unverified plugin banner in amber, not a muted note only', () => {
    render(
      <AnalysisReportView
        report={sampleReport({
          meta: {
            analysis_key: 'plugin:column-summary',
            title: 'Column Summary',
            subtitle: 'Column Summary · v1.0.0',
            generated_at: '2026-01-01T00:00:00.000Z',
            rows_dataset: 505,
          },
          trust: {
            notes: ['Marketplace plugin (QuickJS / VPC-isolated executor)'],
            warnings: [PLUGIN_UNVERIFIED_STATEMENT],
          },
          plugin_verification: {
            kind: 'not_verified',
            reason: 'plugin',
            statement: PLUGIN_UNVERIFIED_STATEMENT,
          },
          r_syntax_verification: {
            kind: 'not_verified',
            reason: 'plugin',
            statement: PLUGIN_UNVERIFIED_STATEMENT,
          },
        })}
      />
    );
    expect(screen.getAllByText(/plugin output is unverified/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Unverified')).toBeInTheDocument();
    expect(screen.getByText('Heads up')).toBeInTheDocument();
  });
});
