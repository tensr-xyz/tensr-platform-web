/**
 * Extra ⌘K sections beyond production-menu.
 * Sprint 1–4 shipped analyses live in production-menu under Data · Analyze · Transform.
 */
import type { MenuSection } from './index';

type PaletteCatalog = Record<string, { sections: MenuSection }>;

export const PALETTE_CATALOG: PaletteCatalog = {
  transform: {
    sections: {
      Transform: ['Rank Cases'],
    },
  },
  visualization: {
    sections: {
      Charts: [
        'Bar Chart',
        'Line Chart',
        'Scatter Chart',
        'Histogram',
        'Boxplot',
        'Pie Chart',
        'Area Chart',
      ],
    },
  },
  data: {
    sections: {
      'Data preparation': ['Standardize Values', 'Data Quality Report'],
    },
  },
};

/** Section titles that show a coming-soon badge. Kept empty — we do not advertise unfinished work. */
export const COMING_SOON_SECTIONS = new Set<string>();
