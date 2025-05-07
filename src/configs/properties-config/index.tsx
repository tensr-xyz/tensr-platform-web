import {
  PropertiesSection,
  StatisticsSection,
  ErrorTermsSection,
  // ValidationSection,
  // EstimationSection
} from '@/components/templates/model-builder/sections';
import { LuCalculator, LuChartBar, LuSettings, LuSquareActivity, LuWaves } from 'react-icons/lu';
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
    icon: <LuSettings className="h-4 w-4" />,
    title: 'Properties',
    component: PropertiesSection as FC<SectionComponentProps>,
  },
  statistics: {
    icon: <LuChartBar className="h-4 w-4" />,
    title: 'Statistics',
    component: StatisticsSection as FC<SectionComponentProps>,
  },
  errors: {
    title: 'Error Terms',
    icon: <LuWaves className="h-4 w-4" />,
    component: ErrorTermsSection as FC<SectionComponentProps>,
  },
  // validation: {
  //   title: 'Model Fit',
  //   icon: <LuSquareActivity className="h-4 w-4" />,
  //   component: ValidationSection
  // },
  // estimation: {
  //   title: 'Estimation',
  //   icon: <LuCalculator className="h-4 w-4" />,
  //   component: EstimationSection
  // }
};
