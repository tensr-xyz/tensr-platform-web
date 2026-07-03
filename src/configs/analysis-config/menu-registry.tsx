import { lazy, Suspense, type ReactNode } from 'react';
import { createAnalysisLauncher } from '@/components/templates/analysis/analysis-launcher';
import type { AnalysisKey } from '@/lib/analysis-definitions';
import { PRODUCTION_ANALYSIS_LABELS } from './production-menu';

type AnalysisComponent = ({ children }: { children: ReactNode }) => React.JSX.Element | null;

const LazyFilePickerWrapper: AnalysisComponent = ({ children }) => {
  const Picker = lazy(() =>
    import('@/components/molecules/file-picker').then(m => ({ default: m.FilePickerWrapper }))
  );
  return (
    <Suspense fallback={null}>
      <Picker>{children}</Picker>
    </Suspense>
  );
};

import { ExportDialog } from '@/components/templates/data';
import { MergeDatasetDialog } from '@/components/templates/data/merge-datasets';
import { HandleMissingDataDialog } from '@/components/templates/data/handle-missing-data';
import FindDuplicatesDialog from '@/components/templates/data/find-duplicates';
import { StandardizeVariablesDialog } from '@/components/templates/transform/standardize-variables';
import { BinVariablesDialog } from '@/components/templates/transform/bin-variables';
import { RecodeVariablesDialog } from '@/components/templates/transform/recode-variables';
import ComputeVariablesDialog from '@/components/templates/transform/compute-variable';
import CountValuesDialog from '@/components/templates/transform/count-values';
import ShiftValuesDialog from '@/components/templates/transform/shift-values';
import { RankCasesDialog } from '@/components/templates/transform/rank-cases';
import {
  LagCasesDialog,
  LeadCasesDialog,
} from '@/components/templates/transform/lag-lead-variables';
import { DataQualityReportDialog } from '@/components/templates/data/data-quality-report';
import { ChartBuilderDialog } from '@/components/templates/visualization/chart-builder';

const chartMenuItem =
  (name: string): AnalysisComponent =>
  ({ children }) => <ChartBuilderDialog chartMenuName={name}>{children}</ChartBuilderDialog>;

const DIALOG_MENU: Record<string, AnalysisComponent> = {
  'Import Data': LazyFilePickerWrapper,
  'Export Data': ExportDialog,
  'Merge Datasets': MergeDatasetDialog,
  'Handle Missing Data': HandleMissingDataDialog,
  'Find Duplicates': FindDuplicatesDialog,
  'Compute Variable': ComputeVariablesDialog,
  'Count Values': CountValuesDialog,
  'Shift Values': ShiftValuesDialog,
  'Standardize Variables': StandardizeVariablesDialog,
  'Standardize Values': StandardizeVariablesDialog,
  'Visual Binning': BinVariablesDialog,
  'Recode Variables': RecodeVariablesDialog,
  'Lag Cases': LagCasesDialog,
  'Lead Cases': LeadCasesDialog,
  'Rank Cases': RankCasesDialog,
  'Data Quality Report': DataQualityReportDialog,
  'Bar Chart': chartMenuItem('Bar Chart'),
  'Line Chart': chartMenuItem('Line Chart'),
  'Scatter Chart': chartMenuItem('Scatter Chart'),
  Histogram: chartMenuItem('Histogram'),
  Boxplot: chartMenuItem('Boxplot'),
  'Pie Chart': chartMenuItem('Pie Chart'),
  Heatmap: chartMenuItem('Heatmap'),
  'Area Chart': chartMenuItem('Area Chart'),
};

const ML_MENU_INITIAL_BODY: Record<string, Record<string, unknown>> = {
  'Gradient Boosting (Classification)': { mode: 'classification' },
  'Gradient Boosting (Regression)': { mode: 'regression' },
  'Neural Network MLP (Classification)': { mode: 'classification' },
  'Neural Network MLP (Regression)': { mode: 'regression' },
};

export function getAnalysisOpForMenuName(name: string): AnalysisKey | undefined {
  if (name in DIALOG_MENU) return undefined;
  return PRODUCTION_ANALYSIS_LABELS[name];
}

export function isDialogMenuItem(name: string): boolean {
  return name in DIALOG_MENU;
}

export function getMenuItemComponent(name: string): AnalysisComponent {
  if (DIALOG_MENU[name]) return DIALOG_MENU[name];

  const op = getAnalysisOpForMenuName(name);
  if (op) return createAnalysisLauncher(op, ML_MENU_INITIAL_BODY[name] ?? null);

  return () => null;
}

export const ANALYSIS_OP_BY_MENU_NAME = PRODUCTION_ANALYSIS_LABELS;
