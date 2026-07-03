/**
 * Extra ⌘K sections beyond production-menu (browse-only / coming-soon badges).
 * Sprint 1–4 shipped analyses live in production-menu under Data · Analyze · Transform.
 * Charts / Time series / ML & AI are tab-level placeholders only (see utils.ts).
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
        'Heatmap',
        'Area Chart',
      ],
    },
  },
  analyze: {
    sections: {
      // Post-launch per launch plan v2 — section badge only, no per-item launchers.
      'Advanced analytics (coming soon)': [],
      'Nonparametric tests (coming soon)': [],
      'Regression extensions (coming soon)': [],
    },
  },
  data: {
    sections: {
      'Data preparation': ['Standardize Values', 'Data Quality Report'],
    },
  },
};

/** Section titles that show a coming-soon badge and no per-item launchers in ⌘K. */
export const COMING_SOON_SECTIONS = new Set(
  Object.values(PALETTE_CATALOG).flatMap(tab =>
    Object.keys(tab.sections).filter(name => name.toLowerCase().includes('coming soon'))
  )
);
