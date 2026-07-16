import type { AnalysisReport } from './analysis-report-types';
import {
  formatSoftwareEnvironmentText,
  getSoftwareEnvironmentLines,
  reportToMarkdown,
} from './report-export';

function sampleReport(overrides?: Partial<AnalysisReport>): AnalysisReport {
  return {
    meta: {
      title: 'Descriptives',
      generated_at: '2026-01-01T00:00:00.000Z',
      rows_dataset: 100,
      build_id: 'build-abc',
      engine_versions: {
        numpy: '1.26.4',
        scipy: '1.11.4',
        pandas: '2.2.3',
        statsmodels: '0.14.4',
        'scikit-learn': '1.4.2',
      },
    },
    summary: 'Summary text',
    metrics: [],
    tables: [],
    trust: { notes: [], warnings: [] },
    ...overrides,
  };
}

describe('report provenance export', () => {
  it('formats each package on its own line', () => {
    const report = sampleReport();
    const lines = getSoftwareEnvironmentLines(report);
    expect(lines).toEqual([
      'Build: build-abc',
      'numpy: 1.26.4',
      'scipy: 1.11.4',
      'pandas: 2.2.3',
      'statsmodels: 0.14.4',
      'scikit-learn: 1.4.2',
    ]);
    expect(formatSoftwareEnvironmentText(report)).toBe(lines.join('\n'));
  });

  it('includes reproducibility note and software environment in markdown', () => {
    const report = sampleReport({
      determinism_note: 'Results may vary slightly between runs.',
    });
    const md = reportToMarkdown(report);
    expect(md).toContain('## Reproducibility note\n\nResults may vary slightly between runs.');
    expect(md).toContain('## Software environment\n\nBuild: build-abc\nnumpy: 1.26.4');
    expect(md).toContain('scikit-learn: 1.4.2');
  });

  it('omits provenance sections when fields are missing', () => {
    const report = sampleReport({
      meta: {
        title: 'Legacy',
        generated_at: '2026-01-01T00:00:00.000Z',
        rows_dataset: 10,
      },
      determinism_note: undefined,
    });
    const md = reportToMarkdown(report);
    expect(md).not.toContain('## Software environment');
    expect(md).not.toContain('## Reproducibility note');
    expect(getSoftwareEnvironmentLines(report)).toEqual([]);
  });
});
