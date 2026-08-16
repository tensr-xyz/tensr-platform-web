import { pluginResultToAnalysisReport } from '@/lib/open-plugin-result-tab';
import type { PluginRecord } from '@/types/plugin';

const plugin = {
  pluginId: 'column-summary',
  name: 'Column Summary',
  version: '1.0.0',
} as PluginRecord;

describe('pluginResultToAnalysisReport', () => {
  it('maps table results into report tables', () => {
    const report = pluginResultToAnalysisReport(plugin, {
      type: 'table',
      data: {
        title: 'Column Summary',
        columns: ['Column', 'Mean'],
        rows: [['Age', 26.0]],
      },
      metadata: { totalRows: 505 },
    });
    expect(report.meta.title).toBe('Column Summary');
    expect(report.meta.rows_dataset).toBe(505);
    expect(report.tables).toHaveLength(1);
    expect(report.tables[0].rows[0]).toEqual(['Age', '26']);
  });
});
