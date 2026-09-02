import type { AnalysisReport, AnalyzeResponse } from '@/lib/analysis-report-types';
import { PLUGIN_UNVERIFIED_STATEMENT } from '@/lib/analysis-runs';
import { openAnalysisResultTab } from '@/lib/open-analysis-result-tab';
import type { PluginRecord } from '@/types/plugin';

type PluginTableResult = {
  type?: string;
  data?: {
    title?: string;
    columns?: string[];
    rows?: unknown[][];
  };
  metadata?: {
    totalRows?: number;
    columnsAnalyzed?: number;
    pluginId?: string;
    pluginVersion?: string;
  };
};

/** Map a marketplace plugin execute result into the workspace report shape. */
export function pluginResultToAnalysisReport(
  plugin: PluginRecord,
  result: unknown
): AnalysisReport {
  const r = (result && typeof result === 'object' ? result : {}) as PluginTableResult;
  const title = r.data?.title || plugin.name || 'Plugin result';
  const columns = Array.isArray(r.data?.columns) ? r.data!.columns!.map(String) : [];
  const rows = Array.isArray(r.data?.rows)
    ? r.data!.rows!.map(row =>
        (Array.isArray(row) ? row : []).map(cell => (cell == null ? '' : String(cell)))
      )
    : [];
  const totalRows = typeof r.metadata?.totalRows === 'number' ? r.metadata.totalRows : rows.length;

  const tables =
    r.type === 'table' && columns.length
      ? [
          {
            id: 'plugin-main',
            title,
            columns,
            rows,
          },
        ]
      : [];

  return {
    meta: {
      analysis_key: `plugin:${plugin.pluginId}`,
      title,
      subtitle: [plugin.name, plugin.version ? `v${plugin.version}` : null]
        .filter(Boolean)
        .join(' · '),
      generated_at: new Date().toISOString(),
      rows_dataset: totalRows,
    },
    summary:
      tables.length > 0
        ? `${plugin.name} returned a table with ${rows.length} row${rows.length === 1 ? '' : 's'}.`
        : `${plugin.name} finished successfully.`,
    metrics: [],
    tables,
    trust: {
      notes: ['Marketplace plugin (QuickJS / VPC-isolated executor)'],
      warnings: [
        PLUGIN_UNVERIFIED_STATEMENT,
        ...(tables.length ? [] : ['Result was not a table — raw payload is in the report data.']),
      ],
    },
    r_syntax_verification: {
      kind: 'not_verified',
      reason: 'plugin',
      statement: PLUGIN_UNVERIFIED_STATEMENT,
    },
    plugin_verification: {
      kind: 'not_verified',
      reason: 'plugin',
      statement: PLUGIN_UNVERIFIED_STATEMENT,
    },
  };
}

/**
 * Open plugin output as a normal workspace analysis report tab
 * (same surface as Analyze → Descriptives, etc.).
 */
export function openPluginResultTab(params: {
  plugin: PluginRecord;
  result: unknown;
  sourceDatasetId: string;
  sourceTabName?: string;
}) {
  const report = pluginResultToAnalysisReport(params.plugin, params.result);
  const envelope: AnalyzeResponse = {
    result:
      params.result && typeof params.result === 'object'
        ? (params.result as Record<string, unknown>)
        : { value: params.result },
    report,
  };

  return openAnalysisResultTab({
    op: `plugin:${params.plugin.pluginId}`,
    envelope,
    parameters: {
      pluginId: params.plugin.pluginId,
      version: params.plugin.version,
    },
    sourceDatasetId: params.sourceDatasetId,
    sourceTabName: params.sourceTabName,
  });
}
