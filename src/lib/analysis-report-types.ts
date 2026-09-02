/** Structured analysis report from tensr-api `report_builder` (matches tensr-ui). */

export type ColumnMetadata = {
  name: string;
  label?: string | null;
  type?: string;
  width?: number;
  value_labels?: Record<string, string> | null;
  missing?: { user_values?: unknown; ranges?: unknown } | null;
  measure?: 'nominal' | 'ordinal' | 'scale' | string | null;
};

export type SchemaColumn = {
  name: string;
  type: string;
  missing_count: number;
  label?: string | null;
  measure?: string | null;
  value_labels?: Record<string, string> | null;
  storage_type?: string;
  width?: number;
};

export type DatasetPreview = {
  headers: string[];
  rows: (string | number | boolean | null)[][];
};

export type AnalysisReportTrust = { notes: string[]; warnings: string[] };

export type AnalysisReportMetric = {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
};

export type AnalysisReportTable = {
  id: string;
  title: string;
  columns: string[];
  rows: string[][];
  apa_style?: boolean;
  apa_title?: string;
  notes?: string[];
  /** Narrative follow-up rendered below the table (e.g. MANOVA univariate interpretation). */
  interpretation?: string;
};

export type SpssReportBlock = AnalysisReportTable;

/** Optional axis typing hints from the API (auto-detected when omitted). */
export type ChartAxisScale = 'linear' | 'datetime' | 'category';

type ChartAxisHints = {
  x_scale?: ChartAxisScale;
  y_scale?: ChartAxisScale;
};

export type AnalysisReportChart =
  | ({
      kind: 'histogram';
      title: string;
      x_label: string;
      bins: { start: number; end: number; count: number }[];
    } & ChartAxisHints)
  | ({
      kind: 'scatter';
      title: string;
      x_label: string;
      y_label: string;
      points: { x: number; y: number; row_index?: number }[];
    } & ChartAxisHints)
  | ({
      kind: 'scatter_line';
      title: string;
      x_label: string;
      y_label: string;
      points: { x: number; y: number; row_index?: number }[];
      line: { x0: number; y0: number; x1: number; y1: number };
    } & ChartAxisHints)
  | ({
      kind: 'step_line';
      title: string;
      x_label: string;
      y_label: string;
      points: { x: number; y: number; row_index?: number }[];
      interpolation?: 'step_after';
      censored?: { x: number; y: number }[];
    } & ChartAxisHints)
  | ({
      kind: 'boxplot';
      title: string;
      y_label: string;
      groups: {
        label: string;
        min: number;
        q1: number;
        median: number;
        q3: number;
        max: number;
      }[];
    } & ChartAxisHints)
  | ({
      kind: 'bar_grouped';
      title: string;
      x_label: string;
      y_label: string;
      categories: string[];
      series: { name: string; values: number[] }[];
    } & ChartAxisHints)
  | ({
      kind: 'line';
      title: string;
      x_label: string;
      y_label: string;
      categories: string[];
      series: { name: string; values: number[] }[];
    } & ChartAxisHints)
  | {
      kind: 'path_diagram';
      title: string;
      nodes: {
        id: string;
        x: number;
        y: number;
        label: string;
        kind: 'latent' | 'observed' | string;
      }[];
      edges: { from: string; to: string; label?: string }[];
    };

export type AnalysisReportBlock =
  | { type: 'interpretation'; content: string }
  | { type: 'metrics'; metrics: AnalysisReportMetric[] }
  | { type: 'table'; table: AnalysisReportTable }
  | { type: 'chart'; chart: AnalysisReportChart };

/** Agent Plan / Why preserved on the report after Approve (not only ephemeral chat). */
export type AnalysisReportApproach = {
  exploration?: string;
  rejected_alternative?: string;
  plan?: string;
  why_this_test?: string;
};

export type AnalysisReport = {
  meta: {
    analysis_key: string;
    title: string;
    subtitle: string;
    generated_at: string;
    rows_dataset: number;
    spss_procedure?: string;
  };
  summary: string;
  /** Combined narrative text (summary + follow-up paragraphs). */
  interpretation?: string;
  /** Pre-approval plan + method rationale kept with saved/run output. */
  approach?: AnalysisReportApproach;
  /** Multi-step tool exploration summary for this turn (Plan/Agent enrichment). */
  session_trace?: string;
  /** Cross-links to chained primary / enrichment reports opened in the same turn. */
  related_analyses?: Array<{
    label: string;
    relation: 'chained_diagnostic' | 'chained_from_primary';
    tab_id?: string;
    analysis_fingerprint?: string;
    run_id?: string;
  }>;
  metrics: AnalysisReportMetric[];
  /** @deprecated use blocks or charts */
  chart?: AnalysisReportChart | null;
  charts?: AnalysisReportChart[];
  blocks?: AnalysisReportBlock[];
  tables: AnalysisReportTable[];
  spss_blocks?: SpssReportBlock[];
  trust: AnalysisReportTrust;
  analysis_spec?: { analysis_key: string; inputs: Record<string, unknown> };
  assumption_checks?: {
    notes: string[];
    warnings: string[];
    interpretations?: string[];
    summary?: string;
  };
  exclusion_summary?: { rows_total: number; rows_used: number; rows_excluded: number };
  case_exclusion_note?: string;
  analysis_log?: string;
  spss_syntax?: string;
  reproducibility?: { r_script?: string };
  r_syntax_verification?: {
    kind: 'verified' | 'verified_in_ci' | 'not_verified' | 'unknown';
    reason?: string;
    statement?: string;
    build_id?: string;
    delta?: { f?: number; df_between?: number; df_within?: number; n?: number };
  };
  plugin_verification?: {
    kind: 'not_verified' | 'unknown';
    reason?: string;
    statement?: string;
  };
};

export type AnalyzeResponse = {
  result: Record<string, unknown>;
  report: AnalysisReport;
  run_id?: string;
  provenance?: Record<string, unknown>;
  convention?: Record<string, unknown>;
};
