import { ViewType, useTabsStore } from '@/stores/tabs-store';
import { openAnalysisResultTab } from '@/lib/open-analysis-result-tab';

describe('openAnalysisResultTab', () => {
  beforeEach(() => {
    useTabsStore.setState({ tabs: [], activeTabId: null });
  });

  it('stores analysisReport when given the full analyze envelope', () => {
    const tabId = openAnalysisResultTab({
      op: 'linear_regression',
      sourceDatasetId: 'ds1',
      parameters: { dependent: 'PTS', independents: ['Age'] },
      envelope: {
        result: { r_squared: 0.5, dependent: 'PTS' },
        report: { summary: 'R² = 0.50', title: 'Linear Regression' } as never,
        run_id: 'run-1',
      },
    });

    const tab = useTabsStore.getState().tabs.find(t => t.id === tabId);
    expect(tab?.type).toBe(ViewType.ANALYSIS_RESULT);
    expect(tab?.data?.analysisReport).toEqual({
      summary: 'R² = 0.50',
      title: 'Linear Regression',
    });
    expect(tab?.data?.analysisResult).toEqual({ r_squared: 0.5, dependent: 'PTS' });
    expect(tab?.data?.analysisRunId).toBe('run-1');
    expect(tab?.data?.analysisProvenance).toBeUndefined();
  });

  it('stores envelope provenance on the tab for the three-state banner', () => {
    const tabId = openAnalysisResultTab({
      op: 'anova_oneway',
      sourceDatasetId: 'ds1',
      parameters: { group_column: 'Pos', value_column: 'Age' },
      envelope: {
        result: { f_statistic: 12 },
        report: { summary: 'Groups differed' } as never,
        run_id: 'run-2',
        provenance: { row_uid_bitset: 'BQ==', row_uid_bitset_miss_count: 0 },
      },
    });
    const tab = useTabsStore.getState().tabs.find(t => t.id === tabId);
    expect(tab?.data?.analysisProvenance).toEqual({
      row_uid_bitset: 'BQ==',
      row_uid_bitset_miss_count: 0,
    });
  });

  it('opens a permanent loading placeholder when only raw stats are passed as envelope', () => {
    // Regression guard for agent-loop Approve path that used to pass
    // entry.result.result (stats only) instead of the full tool envelope.
    const tabId = openAnalysisResultTab({
      op: 'linear_regression',
      sourceDatasetId: 'ds1',
      parameters: { dependent: 'PTS', independents: ['Age'] },
      envelope: {
        r_squared: 0.5,
        dependent: 'PTS',
      } as never,
    });

    const tab = useTabsStore.getState().tabs.find(t => t.id === tabId);
    expect(tab?.data?.analysisReport).toBeUndefined();
    expect(tab?.data?.analysisParameters).toEqual({
      dependent: 'PTS',
      independents: ['Age'],
    });
  });
});
