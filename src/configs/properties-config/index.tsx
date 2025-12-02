import {
  PropertiesSection,
  StatisticsSection,
  ErrorTermsSection,
  // ValidationSection,
  // EstimationSection
} from '@/components/templates/model-builder/sections';
import {
  Calculator,
  BarChart3 as ChartBar,
  Settings,
  Activity as SquareActivity,
  Waves,
} from 'lucide-react';
import { FC, ReactNode } from 'react';

// Define the possible props that any section component might need
// Make all props optional to accommodate different component requirements
interface SectionComponentProps {
  selectedNode?: any | null;
  modelFitIndices?: any | null;
  availableVariables?: any[];
  onNodeUpdate?: (node: any) => void;
  nodes?: any[];
  errorTerms?: any[];
  onUpdateErrorTerm?: (errorTerm: any) => void;
}

// Define the section structure with proper typing
interface PropertySection {
  icon: ReactNode;
  title: string;
  component: FC<SectionComponentProps> | null;
}

// Type for the entire config object
type PropertiesSectionsType = {
  [key: string]: PropertySection;
};

export const PROPERTIES_SECTIONS: PropertiesSectionsType = {
  properties: {
    icon: <Settings className="h-4 w-4" />,
    title: 'Properties',
    component: PropertiesSection as FC<SectionComponentProps>,
  },
  statistics: {
    icon: <ChartBar className="h-4 w-4" />,
    title: 'Statistics',
    component: StatisticsSection as FC<SectionComponentProps>,
  },
  errors: {
    title: 'Error Terms',
    icon: <Waves className="h-4 w-4" />,
    component: ErrorTermsSection as FC<SectionComponentProps>,
  },
  // validation: {
  //   title: 'Model Fit',
  //   icon: <SquareActivity className="h-4 w-4" />,
  //   component: ValidationSection
  // },
  // estimation: {
  //   title: 'Estimation',
  //   icon: <Calculator className="h-4 w-4" />,
  //   component: EstimationSection
  // }
};
