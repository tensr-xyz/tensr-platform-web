import {
  bannerBookFileStem,
  bannerBookFromTables,
  deckBatchPayload,
  everySavedTableSpecIds,
  overviewBannerBookArgs,
  pipelineExportPayload,
  reportExportFormatMeta,
  tableSpecIdsFromReportDocument,
  tableSpecIdsFromReportPages,
  uniqueSpecIds,
  workbookFromRunDocument,
} from '@/components/flow/export-dialog';
import { groupReportExportPages, pagesFromReportDocument } from '@/lib/office-deck-job';

jest.mock('@/lib/report-export', () => ({
  downloadReportXlsx: jest.fn(async () => undefined),
}));

const flowJson = jest.fn();
const downloadExport = jest.fn(async () => undefined);

jest.mock('@/lib/flow-api', () => ({
  flowJson: (...args: unknown[]) => flowJson(...args),
}));

jest.mock('@/components/flow/survey-screens', () => ({
  downloadExport: (...args: unknown[]) => downloadExport(...args),
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

describe('tableSpecIdsFromReportPages', () => {
  it('matches picker page ids even when raw pages have no id', () => {
    const document = {
      pages: [
        {
          title: 'Reach',
          section: 'Insights',
          objects: [{ kind: 'table', table_spec_id: 'spec-reach' }],
        },
        {
          title: 'Age',
          section: 'Insights',
          objects: [{ kind: 'table', table_spec_id: 'spec-age' }],
        },
      ],
    };
    const pages = pagesFromReportDocument(document);
    expect(pages.map(page => page.id)).toEqual(['page-1', 'page-2']);
    expect(tableSpecIdsFromReportPages(document, [pages[0].id])).toEqual(['spec-reach']);
    expect(tableSpecIdsFromReportPages(document, [pages[1].id])).toEqual(['spec-age']);
  });
});

describe('uniqueSpecIds', () => {
  it('dedupes and drops blanks while keeping order', () => {
    expect(uniqueSpecIds(['a', '', 'b', 'a', null, 'c'])).toEqual(['a', 'b', 'c']);
  });
});

describe('bannerBookFileStem', () => {
  it('uses the project or book label and never keeps an audience phrase as-is', () => {
    expect(bannerBookFileStem('IGI demo')).toBe('IGI-demo');
    expect(bannerBookFileStem('UK HNW · big travellers')).toBe('UK-HNW-big-travellers');
    expect(bannerBookFileStem('')).toBe('banner-book');
    expect(bannerBookFileStem(null)).toBe('banner-book');
    expect(bannerBookFileStem('   ')).toBe('banner-book');
  });
});

describe('overviewBannerBookArgs', () => {
  it('always requests every saved table and stems from the project name', () => {
    expect(
      overviewBannerBookArgs({
        datasetId: 'ds-1',
        projectId: 'proj-1',
        projectName: 'Media tracker Q3',
      })
    ).toEqual({
      datasetId: 'ds-1',
      stem: 'Media-tracker-Q3',
      opts: { projectId: 'proj-1', everySaved: true },
    });
    expect(
      overviewBannerBookArgs({
        datasetId: 'ds-2',
        projectName: 'UK HNW · big travellers',
      })
    ).toEqual({
      datasetId: 'ds-2',
      stem: 'UK-HNW-big-travellers',
      opts: { everySaved: true },
    });
    expect(overviewBannerBookArgs({ datasetId: 'ds-3' })).toEqual({
      datasetId: 'ds-3',
      stem: 'banner-book',
      opts: { everySaved: true },
    });
  });
});

describe('everySavedTableSpecIds', () => {
  beforeEach(() => {
    flowJson.mockReset();
  });

  it('returns every dataset table id when the list route works', async () => {
    flowJson.mockResolvedValueOnce({
      specs: [{ spec_id: 't1' }, { id: 't2' }, { spec_id: 't1' }, { spec_id: '' }],
    });
    await expect(everySavedTableSpecIds('ds-1', 'proj-1')).resolves.toEqual(['t1', 't2']);
    expect(flowJson).toHaveBeenCalledWith('/datasets/ds-1/tables');
  });

  it('falls back to the project list when the dataset route fails', async () => {
    flowJson.mockRejectedValueOnce(new Error('500')).mockResolvedValueOnce({
      specs: [{ spec_id: 'p1' }, { spec_id: 'p2' }, { id: 'p3' }],
    });
    await expect(everySavedTableSpecIds('ds-1', 'proj-1')).resolves.toEqual(['p1', 'p2', 'p3']);
    expect(flowJson).toHaveBeenCalledWith('/api/projects/proj-1/tables');
  });

  it('falls back to the project list when the dataset list is empty', async () => {
    flowJson.mockResolvedValueOnce({ specs: [] }).mockResolvedValueOnce({
      specs: [{ spec_id: 'only-project' }],
    });
    await expect(everySavedTableSpecIds('ds-1', 'proj-1')).resolves.toEqual(['only-project']);
  });
});

describe('bannerBookFromTables', () => {
  beforeEach(() => {
    flowJson.mockReset();
    downloadExport.mockClear();
  });

  it('POSTs a banner book then downloads export.xlsx', async () => {
    flowJson
      .mockResolvedValueOnce({
        has_document: true,
        document: {
          pages: [
            {
              id: 'p1',
              title: 'Reach',
              section: 'Insights',
              objects: [{ kind: 'table', table_spec_id: 'spec-1' }],
            },
          ],
        },
      })
      .mockResolvedValueOnce({ book: { id: 'book-1' } });
    await bannerBookFromTables('ds-1', 'audience', { pageIds: ['p1'] });
    expect(flowJson).toHaveBeenCalledWith('/datasets/ds-1/banner-books', {
      method: 'POST',
      body: JSON.stringify({ name: 'Banner book', spec_ids: ['spec-1'] }),
    });
    expect(downloadExport).toHaveBeenCalledWith(
      '/datasets/ds-1/banner-books/book-1/export.xlsx',
      'audience-banner-book.xlsx',
      {
        method: 'POST',
        body: JSON.stringify({ target_dataset_id: 'ds-1', mapping: {} }),
      }
    );
  });

  it('skips Report pages and posts every saved table when everySaved is set', async () => {
    flowJson
      .mockResolvedValueOnce({
        specs: [
          { spec_id: 't1' },
          { spec_id: 't2' },
          { id: 't3' },
          { spec_id: 't4' },
          { spec_id: 't5' },
          { spec_id: 't6' },
          { spec_id: 't7' },
          { spec_id: 't8' },
        ],
      })
      .mockResolvedValueOnce({ book: { id: 'book-all' } });
    await bannerBookFromTables('ds-1', 'overview', { projectId: 'proj-1', everySaved: true });
    expect(flowJson).toHaveBeenCalledWith('/datasets/ds-1/tables');
    expect(flowJson).toHaveBeenCalledWith('/datasets/ds-1/banner-books', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Banner book',
        spec_ids: ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'],
      }),
    });
    expect(downloadExport).toHaveBeenCalled();
  });

  it('throws when there are no tables to export', async () => {
    flowJson
      .mockResolvedValueOnce({ has_document: false, document: null })
      .mockResolvedValueOnce({ specs: [] });
    await expect(bannerBookFromTables('ds-1', 'empty')).rejects.toThrow(/save a table/i);
    expect(downloadExport).not.toHaveBeenCalled();
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
