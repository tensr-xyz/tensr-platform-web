import { fireEvent, render, screen } from '@testing-library/react';
import type { AnalysisReport } from '@/lib/analysis-report-types';
import { PLUGIN_UNVERIFIED_STATEMENT } from '@/lib/analysis-runs';
import { AnalysisReportView } from '@/components/organisms/analysis-report-view';

const UNKNOWN_BANNER =
  'Traceability unknown. This run has no stored provenance. Numbers cannot be traced to the rows they came from.';
const UNAVAILABLE_BANNER =
  'Provenance unavailable: multi_origin. These numbers should not be trusted as a complete row set.';

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
    metrics: [{ label: 'F statistic', value: '12.3' }],
    tables: [],
    trust: { notes: [], warnings: [] },
    exclusion_summary: { rows_total: 505, rows_used: 504, rows_excluded: 1 },
    ...overrides,
  };
}

const completeProvenance = { row_uid_bitset: 'BQ==', row_uid_bitset_miss_count: 0 };

function getTraceabilityBanner(): HTMLElement {
  const heading = screen.getByText('Traceability');
  const region = heading.closest('[role="status"]');
  if (!region) {
    throw new Error('Traceability heading is not inside a status banner');
  }
  return region as HTMLElement;
}

describe('analysis report honesty banners (menu-catalog)', () => {
  it('prints the Stage 3 unknown banner when provenance is missing', () => {
    render(<AnalysisReportView report={sampleReport()} />);
    const banner = getTraceabilityBanner();
    expect(banner).toHaveTextContent(UNKNOWN_BANNER);
    expect(screen.queryByText(/^Unverified$/)).not.toBeInTheDocument();
  });

  it('prints unavailable with the reason, not the unknown sentence', () => {
    render(
      <AnalysisReportView
        report={sampleReport()}
        provenance={{ provenance_unavailable: 'multi_origin' }}
      />
    );
    const banner = getTraceabilityBanner();
    expect(banner).toHaveTextContent(UNAVAILABLE_BANNER);
    expect(banner).not.toHaveTextContent(/traceability unknown/i);
  });

  it('does not print a Traceability banner when the bitset is complete', () => {
    render(
      <AnalysisReportView
        report={sampleReport()}
        provenance={{ row_uid_bitset: 'BQ==', row_uid_bitset_miss_count: 0 }}
      />
    );
    expect(screen.queryByText('Traceability')).not.toBeInTheDocument();
    expect(screen.queryByText(UNKNOWN_BANNER)).not.toBeInTheDocument();
    expect(screen.queryByText(/provenance unavailable/i)).not.toBeInTheDocument();
  });

  it('prints the unverified plugin banner instead of a muted note only', () => {
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
        })}
      />
    );
    expect(screen.getByText('Unverified')).toBeInTheDocument();
    expect(screen.getByText('Unverified').closest('[role="status"]')).toHaveTextContent(
      PLUGIN_UNVERIFIED_STATEMENT
    );
    expect(screen.getByText('Heads up')).toBeInTheDocument();
    expect(screen.queryByText('Traceability')).not.toBeInTheDocument();
    expect(screen.queryByTestId('r-syntax-badge')).not.toBeInTheDocument();
  });
});

describe('analysis report F/n click-through (menu-catalog)', () => {
  it('turns F and n into buttons only when provenance is complete', () => {
    const onReveal = jest.fn();
    render(
      <AnalysisReportView
        report={sampleReport()}
        provenance={completeProvenance}
        onRevealConsumedRows={onReveal}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /show rows for f statistic/i }));
    expect(onReveal).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /show rows for n = 504/i }));
    expect(onReveal).toHaveBeenCalledTimes(2);
  });

  it('does not offer F/n click-through when provenance is unknown', () => {
    const onReveal = jest.fn();
    render(<AnalysisReportView report={sampleReport()} onRevealConsumedRows={onReveal} />);
    expect(screen.queryByRole('button', { name: /show rows for f statistic/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /show rows for n = 504/i })).toBeNull();
  });

  it('does not offer F/n click-through when provenance is unavailable', () => {
    const onReveal = jest.fn();
    render(
      <AnalysisReportView
        report={sampleReport()}
        provenance={{ provenance_unavailable: 'multi_origin' }}
        onRevealConsumedRows={onReveal}
      />
    );
    expect(screen.queryByRole('button', { name: /show rows for f statistic/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /show rows for n = 504/i })).toBeNull();
  });
});

describe('analysis report R syntax badge (menu-catalog)', () => {
  it('prints unknown when the stamp is missing rather than looking verified', () => {
    render(<AnalysisReportView report={sampleReport()} provenance={completeProvenance} />);
    const badge = screen.getByTestId('r-syntax-badge');
    expect(badge).toHaveAttribute('data-r-syntax-kind', 'unknown');
    expect(badge).toHaveTextContent(/r syntax reproduction unknown/i);
  });

  it('prints verified, verified_in_ci, and not_verified from the stamp', () => {
    const { rerender } = render(
      <AnalysisReportView
        report={sampleReport({
          r_syntax_verification: {
            kind: 'verified',
            statement: 'R syntax reproduced F, df and n (ΔF = 0, Δn = 0).',
          },
        })}
        provenance={completeProvenance}
      />
    );
    expect(screen.getByTestId('r-syntax-badge')).toHaveAttribute('data-r-syntax-kind', 'verified');
    expect(screen.getByTestId('r-syntax-badge')).toHaveTextContent(/reproduced f, df and n/i);

    rerender(
      <AnalysisReportView
        report={sampleReport({
          r_syntax_verification: {
            kind: 'verified_in_ci',
            statement: 'This syntax reproduced against a reference dataset on build abc.',
          },
        })}
        provenance={completeProvenance}
      />
    );
    expect(screen.getByTestId('r-syntax-badge')).toHaveAttribute(
      'data-r-syntax-kind',
      'verified_in_ci'
    );
    expect(screen.getByTestId('r-syntax-badge')).toHaveTextContent(/reference dataset/i);

    rerender(
      <AnalysisReportView
        report={sampleReport({
          r_syntax_verification: {
            kind: 'not_verified',
            statement: 'Generated R does not reproduce the engine result. ΔF = 1.',
          },
        })}
        provenance={completeProvenance}
      />
    );
    expect(screen.getByTestId('r-syntax-badge')).toHaveAttribute(
      'data-r-syntax-kind',
      'not_verified'
    );
    expect(screen.getByTestId('r-syntax-badge')).toHaveTextContent(/does not reproduce/i);
  });
});
