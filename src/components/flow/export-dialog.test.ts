import {
  deckBatchPayload,
  pipelineExportPayload,
  tableSpecIdsFromReportDocument,
} from '@/components/flow/export-dialog';
import { groupReportExportPages, pagesFromReportDocument } from '@/lib/office-deck-job';

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
