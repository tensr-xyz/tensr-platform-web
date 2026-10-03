import type { AnalysisReport } from '@/lib/analysis-report-types';
import {
  bannerSpecId,
  pipelineExportRequest,
  reportTablesToCsv,
  reportToHtml,
  reportToMarkdown,
  toolTraceFromReport,
} from '@/lib/report-export';
import { provenanceBannerText } from '@/lib/analysis-runs';

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

  it('stamps run id, dataset id, fingerprint, and the same trace banner as the UI', () => {
    const banner = provenanceBannerText({ kind: 'unknown' });
    const identity = {
      runId: 'run-abc',
      datasetId: 'ccd0d02c-cf1d-4e40-8a60-2759d3cfa4f1',
      contentFingerprint: 'fp-deadbeef',
      traceState: 'unknown',
      traceBanner: banner,
    };
    const md = reportToMarkdown(sampleReport(), identity);
    const html = reportToHtml(sampleReport(), { identity });
    const csv = reportTablesToCsv(sampleReport(), identity);
    for (const body of [md, html, csv]) {
      expect(body).toContain('run-abc');
      expect(body).toContain('ccd0d02c-cf1d-4e40-8a60-2759d3cfa4f1');
      expect(body).toContain('fp-deadbeef');
      expect(body).toContain('Traceability unknown');
      expect(body).toContain('Numbers cannot be traced to the rows they came from');
    }
  });
});

describe('pipeline export request', () => {
  it('sends one run id for a single analysis', () => {
    expect(
      pipelineExportRequest({ runId: 'run-1', toolTrace: [{ name: 'run_analysis' }] })
    ).toEqual({
      run_id: 'run-1',
    });
  });

  it('sends every related run for a pipeline', () => {
    expect(pipelineExportRequest({ runId: 'run-1', relatedRunIds: ['run-2', 'run-1'] })).toEqual({
      run_ids: ['run-1', 'run-2'],
    });
  });

  it('sends the on-screen report when nothing was saved', () => {
    const trace = toolTraceFromReport(sampleReport());
    expect(pipelineExportRequest({ toolTrace: trace })).toEqual({ tool_trace: trace });
    expect(String((trace[0].result as { answer_markdown: string }).answer_markdown)).toContain(
      'London revenue is higher'
    );
  });

  it('reads a banner spec id only for a banner table', () => {
    const banner = sampleReport({
      meta: {
        analysis_key: 'banner_table',
        title: 'Brand by gender',
        subtitle: '',
        generated_at: '2026-07-16T12:00:00.000Z',
        rows_dataset: 40,
      },
    });
    expect(bannerSpecId(banner, { spec_id: 'spec-1' })).toBe('spec-1');
    expect(bannerSpecId(sampleReport(), { spec_id: 'spec-1' })).toBeNull();
  });
});
