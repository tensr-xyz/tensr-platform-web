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
import { RankCasesDialog } from '@/components/templates/transform/rank-cases';
import ComputeVariablesDialog from '@/components/templates/transform/compute-variable';
import ShiftValuesDialog from '@/components/templates/transform/shift-values';
import {
  LagCasesDialog,
  LeadCasesDialog,
} from '@/components/templates/transform/lag-lead-variables';
import { DataQualityReportDialog } from '@/components/templates/data/data-quality-report';
import { FindOutliersDialog } from '@/components/templates/data/find-outliers';
import { HandleOutliersDialog } from '@/components/templates/data/handle-outliers';
import { FixDataTypesDialog } from '@/components/templates/data/fix-data-types';
import { FuseDatasetsDialog } from '@/components/templates/data/fuse-datasets';
import { ChartBuilderDialog } from '@/components/templates/visualization/chart-builder';
import {
  MddImportDialog,
  QPackIngestDialog,
  QualtricsDefinitionDialog,
  QuantumAxisDialog,
  SpsTranslateDialog,
  TripleSImportDialog,
  WincrossJobImportDialog,
} from '@/components/templates/data/intake';
import {
  createTechniqueDialog,
  TECHNIQUE_CONFIGS,
} from '@/components/templates/analysis/techniques';
import {
  BatchTablesDialog,
  ConjointDialog,
  CorrespondenceDialog,
  CustomTablesDialog,
  DriversDialog,
  FuseWavesDialog,
  FunnelDialog,
  GaborGrangerDialog,
  MaxDiffDialog,
  NpsDialog,
  OpenTextCodingDialog,
  RakeWeightsDialog,
  TurfDialog,
  VanWestendorpDialog,
} from '@/components/templates/analysis/agency-dialogs';

const chartMenuItem =
  (name: string): AnalysisComponent =>
  ({ children }) => <ChartBuilderDialog chartMenuName={name}>{children}</ChartBuilderDialog>;

const techniqueMenuEntries = Object.fromEntries(
  Object.keys(TECHNIQUE_CONFIGS).map(label => [label, createTechniqueDialog(label)])
) as Record<string, AnalysisComponent>;

/**
 * Technique dialogs first; development agency dialogs overwrite shared labels
 * (Custom Tables, Batch Tables, Fuse Waves, Rake, Survey techniques, …).
 */
const DIALOG_MENU: Record<string, AnalysisComponent> = {
  ...techniqueMenuEntries,
  'Import Data': LazyFilePickerWrapper,
  'Export Data': ExportDialog,
  'Merge Datasets': MergeDatasetDialog,
  'Fuse Waves': FuseWavesDialog,
  'Fuse Datasets': FuseDatasetsDialog,
  'Handle Missing Data': HandleMissingDataDialog,
  'Find Duplicates': FindDuplicatesDialog,
  'Find Outliers': FindOutliersDialog,
  'Handle Outliers': HandleOutliersDialog,
  'Fix Data Types': FixDataTypesDialog,
  'Standardize Variables': StandardizeVariablesDialog,
  'Standardize Values': StandardizeVariablesDialog,
  'Visual Binning': BinVariablesDialog,
  'Recode Variables': RecodeVariablesDialog,
  'Compute Variable': ComputeVariablesDialog,
  'Rake Weights': RakeWeightsDialog,
  'Custom Tables': CustomTablesDialog,
  'Batch Tables': BatchTablesDialog,
  'Open-text coding': OpenTextCodingDialog,
  TURF: TurfDialog,
  'Driver Analysis': DriversDialog,
  'Correspondence Analysis': CorrespondenceDialog,
  'Van Westendorp': VanWestendorpDialog,
  'Gabor-Granger': GaborGrangerDialog,
  NPS: NpsDialog,
  'Brand Funnel': FunnelDialog,
  'MaxDiff (counting / MNL)': MaxDiffDialog,
  'Conjoint (MNL)': ConjointDialog,
  'Shift Values': ShiftValuesDialog,
  'Lag Cases': LagCasesDialog,
  'Lead Cases': LeadCasesDialog,
  'Rank Cases': RankCasesDialog,
  'Data Quality Report': DataQualityReportDialog,
  'WinCross Job Import': WincrossJobImportDialog,
  'Qualtrics Definition': QualtricsDefinitionDialog,
  'QPack Ingest': QPackIngestDialog,
  'Triple-S Import': TripleSImportDialog,
  'MDD Import': MddImportDialog,
  'SPS Translate': SpsTranslateDialog,
  'Quantum Axis': QuantumAxisDialog,
  'Bar Chart': chartMenuItem('Bar Chart'),
  'Line Chart': chartMenuItem('Line Chart'),
  'Scatter Chart': chartMenuItem('Scatter Chart'),
  Histogram: chartMenuItem('Histogram'),
  Boxplot: chartMenuItem('Boxplot'),
  'Pie Chart': chartMenuItem('Pie Chart'),
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
