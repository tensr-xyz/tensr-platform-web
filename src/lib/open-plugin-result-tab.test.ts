import { pluginResultToAnalysisReport, openPluginResultTab } from '@/lib/open-plugin-result-tab';
import { canRevealConsumedRows, PLUGIN_UNVERIFIED_STATEMENT } from '@/lib/analysis-runs';
import type { PluginRecord } from '@/types/plugin';
import { useTabsStore } from '@/stores/tabs-store';

const plugin = {
  pluginId: 'column-summary',
  name: 'Column Summary',
  version: '1.0.0',
} as PluginRecord;

const tableResult = {
  type: 'table',
  data: {
    title: 'Column Summary',
    columns: ['Column', 'Mean'],
    rows: [['Age', 26.0]],
  },
  metadata: { totalRows: 505 },
};

describe('pluginResultToAnalysisReport', () => {
  it('maps table results into report tables', () => {
    const report = pluginResultToAnalysisReport(plugin, tableResult);
    expect(report.meta.title).toBe('Column Summary');
    expect(report.meta.rows_dataset).toBe(505);
    expect(report.tables).toHaveLength(1);
    expect(report.tables[0].rows[0]).toEqual(['Age', '26']);
  });

  it('stamps not_verified and an amber unverified warning even when the result is a table', () => {
    const report = pluginResultToAnalysisReport(plugin, tableResult);
    expect(report.r_syntax_verification).toEqual({
      kind: 'not_verified',
      reason: 'plugin',
      statement: PLUGIN_UNVERIFIED_STATEMENT,
    });
    expect(report.plugin_verification).toEqual({
      kind: 'not_verified',
      reason: 'plugin',
      statement: PLUGIN_UNVERIFIED_STATEMENT,
    });
    expect(report.trust.warnings).toContain(PLUGIN_UNVERIFIED_STATEMENT);
  });
});

describe('openPluginResultTab', () => {
  beforeEach(() => {
    useTabsStore.setState({ tabs: [], activeTabId: null });
  });

  it('opens a report tab with no run_id and no click-through', () => {
    const tabId = openPluginResultTab({
      plugin,
      result: tableResult,
      sourceDatasetId: 'ds1',
    });
    const tab = useTabsStore.getState().tabs.find(t => t.id === tabId);
    expect(tab?.data?.analysisRunId).toBeUndefined();
    expect(tab?.data?.analysisProvenance).toBeUndefined();
    expect(canRevealConsumedRows(tab?.data?.analysisProvenance)).toBe(false);
    expect(tab?.data?.analysisReport?.trust.warnings).toContain(PLUGIN_UNVERIFIED_STATEMENT);
  });
});
