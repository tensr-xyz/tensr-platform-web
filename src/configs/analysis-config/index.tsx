import { JSX, ReactNode } from 'react';
import {
  LuCalculator,
  LuDatabase,
  LuFilter,
  LuChartLine,
  LuTableProperties,
  LuWrench,
  LuBlocks,
} from 'react-icons/lu';
import { FilePickerWrapper } from '@/components/molecules/file-picker';
import { Mean, OneWayAnova, OneSampleTTest } from '@/components/templates/analysis/index.ts';
import { ExportDialog, MergeDatasetDialog } from '@/components/templates/data';
import FindDuplicatesDialog from '@/components/templates/data/find-duplicates';
import { HandleMissingDataDialog } from '@/components/templates/data/handle-missing-data';
import { FixDataTypesDialog } from '@/components/templates/data/fix-data-types';
import StandardizeValuesDialog from '@/components/templates/data/standardise-values';
import DataQualityDialog from '@/components/templates/data/data-quality';
import ComputeVariablesDialog from '@/components/templates/transform/compute-variable';
import CountValuesDialog from '@/components/templates/transform/count-values';
import ShiftValuesDialog from '@/components/templates/transform/shift-values';

export type MenuSection = Record<string, string[]>;

export interface MenuItem {
  icon: ReactNode;
  sections: MenuSection;
}

export type MenuItems = Record<string, MenuItem>;

export type AnalysisComponent = ({ children }: { children: ReactNode }) => JSX.Element | null;

export const ANALYSIS_COMPONENTS: Record<string, AnalysisComponent> = {
  'Compare Means': Mean,
  'One Way Anova': OneWayAnova,
  'One Sample T-Test': OneSampleTTest,
  'Import Data': FilePickerWrapper,
  'Export Data': ExportDialog,
  'Merge Datasets': MergeDatasetDialog,
  'Find Duplicates': FindDuplicatesDialog,
  'Handle Missing Data': HandleMissingDataDialog,
  'Fix Data Types': FixDataTypesDialog,
  'Standardize Values': StandardizeValuesDialog,
  'Data Quality Report': DataQualityDialog,
  'Compute Variable': ComputeVariablesDialog,
  'Count Values': CountValuesDialog,
  'Shift Values': ShiftValuesDialog,
} as const;

export const MENU_ITEMS: MenuItems = {
  actions: {
    icon: <LuFilter className="h-4 w-4" />,
    sections: {},
  },
  graph_options: {
    icon: <LuChartLine className="h-4 w-4" />,
    sections: {},
  },
  plugins: {
    icon: <LuBlocks className="h-4 w-4" />,
    sections: {},
  },
  data: {
    icon: <LuDatabase className="h-4 w-4" />,
    sections: {
      'Basic Operations': ['Import Data', 'Export Data', 'Merge Datasets', 'Data Pipeline'],
      'Data Cleaning': [
        'Find Duplicates',
        'Handle Missing Data',
        'Fix Data Types',
        'Standardize Values',
        'Data Quality Report',
        'Data Validation Rules',
      ],
      'Data Management': [
        'Data Versioning',
        'Data Lineage',
        'Compare Datasets',
        'API Connections',
        'Multiple Response Sets',
        'Custom Scripts',
      ],
    },
  },
  transform: {
    icon: <LuTableProperties className="h-4 w-4" />,
    sections: {
      'Create & Transform': [
        'Compute Variable',
        'Count Values',
        'Shift Values',
        'Create Dummy Variables',
        'Create New Variables',
        'Reshape Data',
        'Aggregate Data',
        'Transpose Data',
        'Sample Data',
        'Feature Engineering',
      ],
      'Advanced Transformations': [
        'Weight Cases',
        'Split Files',
        'Propensity Matching',
        'Case Control Matching',
        'Rake Weights',
        'Text Processing',
      ],
      Recode: ['Recode Variables', 'Automatic Recode', 'Extended Recode'],
      'Time Series': ['Create Time Series', 'Date and Time Wizard', 'Replace Missing Values'],
      'Data Preparation': [
        'Visual Binning',
        'Rank Cases',
        'Standardize Variables',
        'Random Number Generator',
      ],
    },
  },
  analyze: {
    icon: <LuCalculator className="h-4 w-4" />,
    sections: {
      'Compare Means and Proportions': [
        'Compare Subgroups',
        'Compare Means',
        'One Sample T-Test',
        'Independent Samples T-Test',
        'Paired Samples T-Test',
        'One Way Anova',
      ],
    },
  },
  utilities: {
    icon: <LuWrench className="h-4 w-4" />,
    sections: {
      'Variable Management': ['Variable Sets', 'Variable Properties', 'Variable Groups'],
      'Output Options': ['Table Appearance', 'Output Formatting', 'Export Settings'],
      'Chart Templates': ['Save Chart Template', 'Load Template', 'Manage Templates'],
      Automation: ['Run Script', 'Batch Processing', 'Scoring Rules'],
      Documentation: ['Data Comments', 'Variable Definitions', 'Output Templates'],
    },
  },
} as const;
