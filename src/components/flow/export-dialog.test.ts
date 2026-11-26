import {
  deckBatchPayload,
  pipelineExportPayload,
  reportExportFormatMeta,
  tableSpecIdsFromReportDocument,
  workbookFromRunDocument,
} from '@/components/flow/export-dialog';
import { groupReportExportPages, pagesFromReportDocument } from '@/lib/office-deck-job';

jest.mock('@/lib/report-export', () => ({
  downloadReportXlsx: jest.fn(async () => undefined),
}));

describe('reportExportFormatMeta', () => {
  it('lists Word, PowerPoint, Excel, PDF, Markdown and SPSS data (Paper 6i)', () => {
    const formats = reportExportFormatMeta();
    expect(formats.map(item => item.id)).toEqual(['docx', 'pptx', 'xlsx', 'pdf', 'md', 'sav']);
    expect(formats.find(item => item.id === 'pdf')?.note).toMatch(/Fixed layout/i);
    expect(formats.find(item => item.id === 'md')?.label).toBe('Markdown');
    expect(formats.find(item => item.id === 'sav')?.ext).toBe('.SAV + .SPS');
    expect(formats.find(item => item.id === 'sav')?.label).toBe('Data for SPSS');
  });
});

describe('pipelineExportPayload', () => {
  it('sends the project id so the study brief can be a context page', () => {
    const body = JSON.parse(
      pipelineExportPayload({
        runIds: ['run-1', 'run-2'],
        style: 'apa',
        includeMethods: true,
        projectId: 'proj-brief',
      })
    );
    expect(body.run_ids).toEqual(['run-1', 'run-2']);
    expect(body.project_id).toBe('proj-brief');
    expect(body.include_methods).toBe(true);
  });

  it('sends an empty project id when the export is not from a project', () => {
    const body = JSON.parse(pipelineExportPayload({ runIds: ['run-1'] }));
    expect(body.project_id).toBe('');
  });
});

describe('deckBatchPayload', () => {
  it('sends the group column and selected values for one copy per group', () => {
    const body = JSON.parse(
      deckBatchPayload({
        specIds: ['spec-a', 'spec-b'],
        groupColumn: 'region',
        values: ['North', 'South'],
        name: 'Overview',
      })
    );
    expect(body.spec_ids).toEqual(['spec-a', 'spec-b']);
    expect(body.group_column).toBe('region');
    expect(body.values).toEqual(['North', 'South']);
    expect(body.name).toBe('Overview');
  });
});

describe('tableSpecIdsFromReportDocument', () => {
  it('collects unique table_spec_id values in page order', () => {
    const ids = tableSpecIdsFromReportDocument({
      pages: [
        {
          title: 'Exec',
          objects: [{ kind: 'text', text: 'Summary' }],
        },
        {
          title: 'Region',
          objects: [{ kind: 'table', table_spec_id: 'spec-region' }],
        },
        {
          title: 'Age',
          objects: [
            { kind: 'table', tableSpecId: 'spec-age' },
            { kind: 'table', table_spec_id: 'spec-region' },
          ],
        },
      ],
    });
    expect(ids).toEqual(['spec-region', 'spec-age']);
  });

  it('returns an empty list when the document has no linked tables', () => {
    expect(tableSpecIdsFromReportDocument({ pages: [{ objects: [] }] })).toEqual([]);
    expect(tableSpecIdsFromReportDocument(null)).toEqual([]);
  });
});

describe('workbookFromRunDocument', () => {
  it('sends the output tables to the report Excel export', async () => {
    const { downloadReportXlsx } = jest.requireMock('@/lib/report-export') as {
      downloadReportXlsx: jest.Mock;
    };
    downloadReportXlsx.mockClear();
    await workbookFromRunDocument(
      {
        title: 'Reach by region',
        op: 'banner_table',
        summary: 'North leads.',
        base: null,
        createdAt: '2026-11-26T00:00:00Z',
        tables: [
          {
            title: 'Reach by region',
            columns: ['Stub', 'Total'],
            rows: [['North', '41%']],
          },
        ],
        checks: [],
        script: '',
      },
      'reach-by-region',
      { datasetId: 'ds-1' }
    );
    expect(downloadReportXlsx).toHaveBeenCalledTimes(1);
    const [report, options] = downloadReportXlsx.mock.calls[0];
    expect(report.meta.title).toBe('reach-by-region');
    expect(report.tables[0].rows).toEqual([['North', '41%']]);
    expect(options).toEqual({ datasetId: 'ds-1' });
  });
});

describe('grouped report page picker', () => {
  it('builds Summary / Insights / Appendix groups for the export dialog', () => {
    const pages = pagesFromReportDocument({
      pages: [
        { id: 's1', title: 'Study intro', section: 'Executive summary' },
        { id: 'i1', title: 'Region mix', section: 'Insights' },
        { id: 'a1', title: 'Q1 Region', section: 'Appendix' },
      ],
    });
    const groups = groupReportExportPages(pages);
    expect(groups.map(group => group.label)).toEqual([
      'Summary',
      'Insights',
      'Appendix, one per question',
    ]);
  });
});
