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

export type AnalysisReportChart =
  | {
      kind: 'histogram';
      title: string;
      x_label: string;
      bins: { start: number; end: number; count: number }[];
    }
  | {
      kind: 'scatter';
      title: string;
      x_label: string;
      y_label: string;
      points: { x: number; y: number }[];
    }
  | {
      kind: 'scatter_line';
      title: string;
      x_label: string;
      y_label: string;
      points: { x: number; y: number }[];
      line: { x0: number; y0: number; x1: number; y1: number };
    }
  | {
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
    }
  | {
      kind: 'bar_grouped';
      title: string;
      x_label: string;
      y_label: string;
      categories: string[];
      series: { name: string; values: number[] }[];
    }
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
};

export type AnalyzeResponse = {
  result: Record<string, unknown>;
  report: AnalysisReport;
  run_id?: string;
};
