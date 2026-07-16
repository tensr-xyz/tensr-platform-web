import type { AnalysisReport } from '@/lib/analysis-report-types';
import { reportToHtml, reportToMarkdown } from '@/lib/report-export';

function sampleReport(overrides: Partial<AnalysisReport> = {}): AnalysisReport {
  return {
    meta: {
      analysis_key: 'descriptives',
      title: 'Descriptives: Revenue',
      subtitle: 'By Region',
      generated_at: '2026-07-16T12:00:00.000Z',
      rows_dataset: 100,
      spss_procedure: 'Descriptives',
    },
    summary: 'London revenue is higher than Wales on average.',
    metrics: [{ label: 'N', value: '100' }],
    tables: [
      {
        id: 'descriptives',
        title: 'Group means',
        columns: ['Region', 'Mean'],
        rows: [
          ['London', '150'],
          ['Wales', '60'],
        ],
      },
    ],
    charts: [
      {
        kind: 'bar_grouped',
        title: 'Mean Revenue by Region',
        x_label: 'Region',
        y_label: 'Mean Revenue',
        categories: ['London', 'Wales'],
        series: [{ name: 'Mean Revenue', values: [150, 60] }],
      },
    ],
    trust: {
      notes: ['Values computed with listwise exclusion for missing data.'],
      warnings: [],
    },
    exclusion_summary: {
      rows_used: 98,
      rows_total: 100,
      rows_excluded: 2,
    },
    ...overrides,
  };
}

describe('reportToHtml', () => {
  it('builds a self-contained HTML document with answer-first narrative', () => {
    const html = reportToHtml(sampleReport());

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<strong>Answer</strong>');
    expect(html).toContain('London revenue is higher than Wales on average.');
    expect(html).toContain('Descriptives: Revenue');
    expect(html).toContain('Methodology');
    expect(html).toContain('descriptives');
  });

  it('embeds bar chart sketch and table data', () => {
    const html = reportToHtml(sampleReport());

    expect(html).toContain('Mean Revenue by Region');
    expect(html).toContain('<table>');
    expect(html).toContain('London');
    expect(html).toContain('Wales');
    expect(html).toContain('Used 98 of 100 rows');
  });

  it('escapes HTML in user-facing strings', () => {
    const html = reportToHtml(
      sampleReport({
        summary: 'A <script>alert(1)</script> & "quote"',
        meta: {
          analysis_key: 'descriptives',
          title: 'Title <b>x</b>',
          subtitle: '',
          generated_at: '2026-07-16T12:00:00.000Z',
          rows_dataset: 1,
        },
      })
    );

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Title &lt;b&gt;x&lt;/b&gt;');
  });

  it('renders histogram bins when present', () => {
    const html = reportToHtml(
      sampleReport({
        charts: [
          {
            kind: 'histogram',
            title: 'Distribution of Age',
            x_label: 'Age',
            bins: [
              { start: 0, end: 10, count: 3 },
              { start: 10, end: 20, count: 7 },
            ],
          },
        ],
      })
    );

    expect(html).toContain('Distribution of Age');
    expect(html).toContain('title="7"');
  });
});

describe('reportToMarkdown', () => {
  it('still exports markdown with summary and chart titles', () => {
    const md = reportToMarkdown(sampleReport());
    expect(md).toContain('# Descriptives: Revenue');
    expect(md).toContain('## Summary');
    expect(md).toContain('Mean Revenue by Region');
  });
});
