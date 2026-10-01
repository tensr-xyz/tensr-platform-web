import { ViewType, useTabsStore } from '@/stores/tabs-store';
import {
  SURVEY_TECHNIQUE_OPS,
  envelopeForSurveyTechnique,
  openSurveyTechniqueReport,
} from '@/lib/survey-technique-report';

function reportFor(op: string) {
  return {
    meta: {
      analysis_key: op,
      title: op,
      subtitle: '',
      generated_at: '2026-10-01T00:00:00Z',
      rows_dataset: 4,
    },
    summary: `${op} summary`,
    metrics: [{ label: 'n', value: '4' }],
    tables: [{ id: 'main', title: 'Main', columns: ['Item'], rows: [['A']] }],
    trust: { notes: [], warnings: [] },
  };
}

describe('survey technique reports', () => {
  beforeEach(() => {
    useTabsStore.setState({ tabs: [], activeTabId: null });
  });

  it.each(SURVEY_TECHNIQUE_OPS)('%s opens a report tab and does not keep the raw payload', op => {
    const response = {
      ok: true,
      utilities: { A: 1.2, B: { nested: true } },
      tables: [{ stub: 'q1', book: { cells: [{ provenance: { row_uid_bitset: 'abc' } }] } }],
      report: reportFor(op),
      provenance: { dataset_id: 'ds1', columns: ['q1'] },
    };

    const envelope = envelopeForSurveyTechnique(response);
    expect(envelope?.report.summary).toBe(`${op} summary`);
    expect(envelope?.result).toEqual({});
    expect(JSON.stringify(envelope?.result)).toBe('{}');
    expect(JSON.stringify(envelope)).not.toContain('row_uid_bitset');
    expect(JSON.stringify(envelope?.report.tables)).not.toContain('nested');

    const tabId = openSurveyTechniqueReport({
      datasetId: 'ds1',
      op,
      parameters: { column: 'q1' },
      response,
    });
    const tab = useTabsStore.getState().tabs.find(t => t.id === tabId);
    expect(tab?.type).toBe(ViewType.ANALYSIS_RESULT);
    expect(tab?.data?.analysisReport).toEqual(reportFor(op));
    expect(tab?.data?.analysisResult).toEqual({});
    expect(tab?.data?.analysisProvenance).toEqual({ dataset_id: 'ds1', columns: ['q1'] });
  });
});
