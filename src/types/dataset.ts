export type ColumnType = 'numeric' | 'categorical' | 'ordinal' | 'id' | 'date';

export interface ColumnMeta {
  id: string;
  name: string;
  type: ColumnType;
  description?: string;
}

export interface ColumnStats {
  nTotal: number;
  nMissing: number;
  min?: number;
  max?: number;
  mean?: number;
  sd?: number;
  skew?: number;
  uniqueCount?: number;
  flags?: {
    hasOutliers?: boolean;
    highMissingness?: boolean;
    lowVariance?: boolean;
    inconsistentCategories?: boolean;
  };
}

export interface DatasetMeta {
  id?: string;
  name: string;
  nRows: number;
  nCols: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DatasetProfile {
  columns: ColumnMeta[];
  stats?: Record<string, ColumnStats>;
}

export type FilterOperator = '>' | '>=' | '<' | '<=' | '==' | '!=' | 'in' | 'not_in' | 'contains';

export interface FilterSpec {
  id: string;
  columnId: string;
  operator: FilterOperator;
  value: any;
}

export interface SortSpec {
  columnId: string;
  direction: 'asc' | 'desc';
}

export type Transformation =
  | { type: 'addColumn'; name: string; expression: string }
  | { type: 'dropColumn'; name: string }
  | { type: 'filter'; filter: FilterSpec }
  | { type: 'transform'; columnId: string; expression: string };

export interface AnalysisSpec {
  type: 'regression' | 'anova' | 'correlations' | 'ttest' | 'chiSquare';
  dependent?: string;
  predictors?: string[];
  independent?: string;
  groups?: string[];
  variables?: string[];
  family?: 'gaussian' | 'binomial';
  link?: string;
  controls?: string[];
}

export interface AnalysisResult {
  id: string;
  type: string;
  coefficients?: Array<{
    variable: string;
    coefficient: number;
    stdError?: number;
    tValue?: number;
    pValue?: number;
  }>;
  rSquared?: number;
  adjRSquared?: number;
  aic?: number;
  bic?: number;
  fStatistic?: {
    value: number;
    pValue: number;
  };
  diagnostics?: {
    normalityP?: number;
    vif?: Record<string, number>;
  };
  metadata: {
    datasetId: string;
    filters?: FilterSpec[];
    createdAt: string;
  };
  summary?: string;
}

export interface ColumnInsight {
  summary: string;
  actions: Array<{ id: string; label: string }>;
  flags: {
    hasOutliers?: boolean;
    highMissingness?: boolean;
    lowVariance?: boolean;
    inconsistentCategories?: boolean;
  };
}

export interface RowInsight {
  explanation: string;
  actions: Array<{ id: string; label: string }>;
  similarRows?: number[];
}

export interface RelationshipInsight {
  targetColumnId: string;
  relationships: Array<{
    columnId: string;
    correlation: number;
    label: string;
  }>;
  summary: string;
  actions: Array<{ id: string; label: string }>;
}

export interface NewColumnResponse {
  name: string;
  expression: string;
  explanation: string;
}

export interface FiltersResponse {
  filters: FilterSpec[];
  description: string;
}

export interface AnalysisPlannerResponse {
  analysisType: string;
  spec: AnalysisSpec;
  rationale: string;
  nextActions: Array<{ id: string; label: string }>;
}

export interface APAWriteupResponse {
  apaText: string;
  summary: string;
  limitationsNote?: string;
}
