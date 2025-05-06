export interface FileUpload {
  fileId: string;
  uploadUrl: string;
  expiresAt: string;
}

export interface DescriptiveStats {
  missing_count: number;
  count: number;
  mean: number;
  std_dev: number;
  min: number;
  percentile_5: number;
  percentile_25: number;
  percentile_50: number;
  percentile_75: number;
  percentile_95: number;
  max: number;
}

export interface CategoricalStats {
  missing_count: number;
  count: number;
  distinct_count: number;
  top_frequencies: ValueFrequency[];
}

export interface ValueFrequency {
  value: string;
  count: number;
  percentage: number;
}

export interface ColumnSummary {
  name: string;
  data_type: string;
  numeric_stats: DescriptiveStats | null;
  categorical_stats: CategoricalStats | null;
}

export interface ImportData {
  fileName: string;
  filePath: string;
  fileId: string;
  preview: string[][];
  columnNames: string[];
  totalRows: number;
  totalColumns: number;
  columnSummaries?: Record<string, ColumnSummary>;
}

export interface FileData {
  metadata: {
    preview: string[][];
    column_names: string[];
    rows: number;
    columns: number;
  };
  column_summaries: Record<string, ColumnSummary>;
}
