import {
  enrichmentCompletionNote,
  relatedLinkDisplayLabel,
  wireAnalysisChainLinks,
} from '@/lib/analysis-chain-links';
import { openAnalysisResultTab } from '@/lib/open-analysis-result-tab';
import { ViewType, useTabsStore } from '@/stores/tabs-store';

describe('enrichmentCompletionNote', () => {
  it('names the correlation diagnostic and tab label', () => {
    const note = enrichmentCompletionNote('correlation', {
      columns: ['PTS', 'Age', 'G'],
    });
    expect(note).toContain('correlation diagnostic');
    expect(note).toContain('Bivariate Correlations');
    expect(note).toContain('PTS');
  });
});

describe('relatedLinkDisplayLabel', () => {
  it('qualifies diagnostic vs primary', () => {
    expect(
      relatedLinkDisplayLabel({
        tabId: 'a',
        label: 'Bivariate Correlations',
        relation: 'chained_diagnostic',
      })
    ).toBe('Bivariate Correlations (chained diagnostic)');
    expect(
      relatedLinkDisplayLabel({
        tabId: 'b',
        label: 'Linear Regression — PTS',
        relation: 'chained_from_primary',
      })
    ).toBe('Linear Regression — PTS (primary analysis)');
  });
});

describe('wireAnalysisChainLinks', () => {
  beforeEach(() => {
    useTabsStore.setState({ tabs: [], activeTabId: null });
    let n = 0;
    jest
      .spyOn(crypto, 'randomUUID')
      .mockImplementation(
        () => `tab-${++n}` as `${string}-${string}-${string}-${string}-${string}`
      );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('cross-links primary and enrichment tabs both ways', () => {
    const primaryId = openAnalysisResultTab({
      op: 'linear_regression',
      sourceDatasetId: 'ds1',
      parameters: { dependent: 'PTS', independents: ['Age'] },
      envelope: {
        result: {},
        report: {
          meta: {
            analysis_key: 'linear_regression',
            title: 'Linear Regression',
            subtitle: 'PTS',
            generated_at: '2026-01-01T00:00:00Z',
            rows_dataset: 10,
          },
          summary: 'ok',
          metrics: [],
          tables: [],
          trust: { notes: [], warnings: [] },
        },
        run_id: 'run-primary',
      },
    });
    const enrichId = openAnalysisResultTab({
      op: 'correlation',
      sourceDatasetId: 'ds1',
      parameters: { columns: ['PTS', 'Age'] },
      activate: false,
      envelope: {
        result: {},
        report: {
          meta: {
            analysis_key: 'correlation',
            title: 'Bivariate Correlations',
            subtitle: 'PTS, Age',
            generated_at: '2026-01-01T00:00:00Z',
            rows_dataset: 10,
          },
          summary: 'ok',
          metrics: [],
          tables: [],
          trust: { notes: [], warnings: [] },
        },
        run_id: 'run-enrich',
      },
    });

    expect(enrichId).toBeTruthy();
    expect(enrichId).not.toBe(primaryId);
    expect(useTabsStore.getState().activeTabId).toBe(primaryId);

    wireAnalysisChainLinks([
      {
        tabId: primaryId!,
        isEnrichment: false,
        label: 'Linear Regression — PTS',
        fingerprint: 'fp-primary',
        runId: 'run-primary',
      },
      {
        tabId: enrichId!,
        isEnrichment: true,
        label: 'Bivariate Correlations — PTS, Age',
        fingerprint: 'fp-enrich',
        runId: 'run-enrich',
      },
    ]);

    const primary = useTabsStore.getState().tabs.find(t => t.id === primaryId);
    const enrich = useTabsStore.getState().tabs.find(t => t.id === enrichId);
    expect(primary?.type).toBe(ViewType.ANALYSIS_RESULT);
    expect(primary?.data?.analysisRelated).toEqual([
      expect.objectContaining({
        tabId: enrichId,
        relation: 'chained_diagnostic',
      }),
    ]);
    expect(enrich?.data?.analysisRelated).toEqual([
      expect.objectContaining({
        tabId: primaryId,
        relation: 'chained_from_primary',
      }),
    ]);
    expect(primary?.data?.analysisReport?.related_analyses?.[0]?.relation).toBe(
      'chained_diagnostic'
    );
  });
});
