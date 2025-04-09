import {
  PropertiesSection,
  StatisticsSection,
  ErrorTermsSection,
  // ValidationSection,
  // EstimationSection
} from '@/components/templates/model-builder/sections';
import { LuCalculator, LuChartBar, LuSettings, LuSquareActivity, LuWaves } from 'react-icons/lu';

export const PROPERTIES_SECTIONS = {
  properties: {
    icon: <LuSettings className="h-4 w-4" />,
    title: 'Properties',
    component: PropertiesSection,
  },
  statistics: {
    icon: <LuChartBar className="h-4 w-4" />,
    title: 'Statistics',
    component: StatisticsSection,
  },
  errors: {
    title: 'Error Terms',
    icon: <LuWaves className="h-4 w-4" />,
    component: ErrorTermsSection,
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
} as const;
