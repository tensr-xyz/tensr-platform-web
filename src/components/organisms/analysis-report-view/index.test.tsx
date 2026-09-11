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
    const banner = screen.getByText('Traceability').closest('[role="status"]');
    expect(banner).toHaveTextContent(/traceability unknown/i);
    expect(banner).toHaveTextContent(/no stored provenance/i);
    expect(banner).toHaveTextContent(/cannot be traced to the rows they came from/i);
  });

  it('prints unavailable with the reason, not the unknown sentence', () => {
    render(
      <AnalysisReportView
        report={sampleReport()}
        provenance={{ provenance_unavailable: 'multi_origin' }}
      />
    );
    const banner = screen.getByText('Traceability').closest('[role="status"]');
    expect(banner).toHaveTextContent(/provenance unavailable: multi_origin/i);
    expect(screen.queryByText(/traceability unknown/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('provenance-inspector')).not.toBeInTheDocument();
  });

  it('leads with Verified against R and source-row lineage, not convention jargon', () => {
    render(
      <AnalysisReportView
        report={sampleReport({
          exclusion_summary: { rows_total: 505, rows_used: 504, rows_excluded: 1 },
          r_syntax_verification: {
            kind: 'verified',
            statement: 'R reproduced F, df and n.',
          },
          reproducibility: { r_script: 'aov(Time_90 ~ Interval, data = d)' },
          spss_syntax: 'ONEWAY Time_90 BY Interval.',
        })}
        provenance={{
          row_uid_bitset: 'BQ==',
          row_uid_bitset_miss_count: 0,
          convention: { variance_mode: 'q_taylor_srs', test_type: 't' },
        }}
        onRevealConsumedRows={() => undefined}
      />
    );
    expect(screen.getByTestId('r-syntax-badge')).toHaveTextContent('Verified against R ✓');
    expect(screen.getByTestId('r-equivalent-syntax')).toHaveTextContent(
      'aov(Time_90 ~ Interval, data = d)'
    );
    expect(screen.getByTestId('spss-equivalent-syntax')).toHaveTextContent(
      'ONEWAY Time_90 BY Interval.'
    );
    expect(
      screen.getByRole('button', { name: /504 of 505 source rows used/i })
    ).toBeInTheDocument();
    expect(screen.queryByText('variance_mode')).not.toBeInTheDocument();
    expect(screen.queryByTestId('provenance-inspector')).not.toBeInTheDocument();
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
