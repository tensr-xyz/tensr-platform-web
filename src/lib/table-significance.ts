/** Tables significance options (Paper 9b). Labels only — never codes in UI copy. */

export type SigShowAs = 'letters' | 'arrows' | 'off';
export type SigConfidence = 90 | 95 | 99;
export type SigMcc = 'none' | 'bonferroni' | 'fdr';
export type SigMeansPostHoc = 'tukey' | 'fisher_lsd' | 'dunnett' | 'duncan' | 'snk';

export type TableSignificanceSettings = {
  showAs: SigShowAs;
  confidence: SigConfidence;
  multipleComparison: SigMcc;
  meansPostHoc: SigMeansPostHoc;
  dunnettControl: string;
  asProjectDefault: boolean;
};

export const DEFAULT_TABLE_SIGNIFICANCE: TableSignificanceSettings = {
  showAs: 'letters',
  confidence: 95,
  // Displayr column comparisons default to no MCC (Q defaults to FDR).
  multipleComparison: 'none',
  meansPostHoc: 'tukey',
  dunnettControl: '',
  asProjectDefault: false,
};

export const MCC_OPTIONS: { value: SigMcc; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'bonferroni', label: 'Bonferroni' },
  { value: 'fdr', label: 'False discovery rate' },
];

export const MEANS_POST_HOC_OPTIONS: { value: SigMeansPostHoc; label: string }[] = [
  { value: 'tukey', label: 'Tukey HSD' },
  { value: 'fisher_lsd', label: 'Fisher LSD' },
  { value: 'dunnett', label: 'Dunnett (vs a control)' },
  { value: 'duncan', label: 'Duncan' },
  { value: 'snk', label: 'SNK' },
];

const STORAGE_PREFIX = 'tensr-table-significance:';

export function alphaFromConfidence(confidence: SigConfidence): number {
  if (confidence === 90) return 0.1;
  if (confidence === 99) return 0.01;
  return 0.05;
}

export function confidenceFromAlpha(alpha: unknown): SigConfidence {
  const value = typeof alpha === 'number' ? alpha : Number(alpha);
  if (value === 0.1) return 90;
  if (value === 0.01) return 99;
  return 95;
}

export function showAsFromDisplay(display: unknown, comparisonType?: unknown): SigShowAs {
  const shown = String(display || '')
    .trim()
    .toLowerCase();
  if (!shown || shown === 'none') return 'off';
  if (shown === 'cell_comparisons' || shown === 'arrows') return 'arrows';
  if (
    String(comparisonType || '')
      .trim()
      .toLowerCase() === 'subgroup_vs_total' &&
    shown !== 'column_letters'
  ) {
    return 'arrows';
  }
  return 'letters';
}

export function displayFromShowAs(
  showAs: SigShowAs
): 'column_letters' | 'cell_comparisons' | 'none' {
  if (showAs === 'off') return 'none';
  if (showAs === 'arrows') return 'cell_comparisons';
  return 'column_letters';
}

export function comparisonTypeFromShowAs(
  showAs: SigShowAs
): 'column_pair' | 'subgroup_vs_total' | 'cell_vs_row_complement' {
  if (showAs === 'arrows') return 'subgroup_vs_total';
  // Letters keep pairwise column tests (engine still runs them for letter placement).
  return 'cell_vs_row_complement';
}

export function mccLabel(method: SigMcc): string {
  if (method === 'bonferroni') return 'Bonferroni';
  if (method === 'fdr') return 'False discovery rate';
  return 'None';
}

export function meansPostHocLabel(method: SigMeansPostHoc): string {
  return MEANS_POST_HOC_OPTIONS.find(option => option.value === method)?.label || 'Tukey HSD';
}

/** Toolbar chip: "Significance · 95% letters". */
export function significanceToolbarLabel(settings: TableSignificanceSettings): string {
  if (settings.showAs === 'off') return 'Significance · Off';
  if (settings.showAs === 'arrows') {
    return `Significance · ${settings.confidence}% arrows`;
  }
  return `Significance · ${settings.confidence}% letters`;
}

export function significanceRequestFields(
  settings: TableSignificanceSettings
): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    significance_display: displayFromShowAs(settings.showAs),
    significance_alpha: alphaFromConfidence(settings.confidence),
    multiple_comparison: settings.multipleComparison,
    comparison_type: comparisonTypeFromShowAs(settings.showAs),
    means_post_hoc: settings.meansPostHoc,
  };
  if (settings.meansPostHoc === 'dunnett' && settings.dunnettControl.trim()) {
    fields.post_hoc_control = settings.dunnettControl.trim();
  }
  return fields;
}

export function settingsFromSpec(
  spec: Record<string, unknown> | null | undefined,
  fallback: TableSignificanceSettings = DEFAULT_TABLE_SIGNIFICANCE
): TableSignificanceSettings {
  if (!spec || typeof spec !== 'object') return { ...fallback };
  const means = String(spec.means_post_hoc || fallback.meansPostHoc).toLowerCase();
  const mcc = String(spec.multiple_comparison || fallback.multipleComparison).toLowerCase();
  return {
    showAs: showAsFromDisplay(spec.significance_display, spec.comparison_type),
    confidence: confidenceFromAlpha(
      spec.significance_alpha ?? alphaFromConfidence(fallback.confidence)
    ),
    multipleComparison: (['none', 'bonferroni', 'fdr'].includes(mcc)
      ? mcc
      : fallback.multipleComparison) as SigMcc,
    meansPostHoc: (['tukey', 'fisher_lsd', 'dunnett', 'duncan', 'snk'].includes(means)
      ? means
      : fallback.meansPostHoc) as SigMeansPostHoc,
    dunnettControl: String(spec.post_hoc_control || fallback.dunnettControl || ''),
    asProjectDefault: fallback.asProjectDefault,
  };
}

export function loadProjectSignificance(
  projectId: string | undefined
): TableSignificanceSettings | null {
  if (!projectId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${projectId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TableSignificanceSettings>;
    return {
      ...DEFAULT_TABLE_SIGNIFICANCE,
      ...parsed,
      showAs:
        parsed.showAs === 'letters' || parsed.showAs === 'arrows' || parsed.showAs === 'off'
          ? parsed.showAs
          : DEFAULT_TABLE_SIGNIFICANCE.showAs,
      confidence:
        parsed.confidence === 90 || parsed.confidence === 95 || parsed.confidence === 99
          ? parsed.confidence
          : DEFAULT_TABLE_SIGNIFICANCE.confidence,
      multipleComparison:
        parsed.multipleComparison === 'none' ||
        parsed.multipleComparison === 'bonferroni' ||
        parsed.multipleComparison === 'fdr'
          ? parsed.multipleComparison
          : DEFAULT_TABLE_SIGNIFICANCE.multipleComparison,
      meansPostHoc:
        parsed.meansPostHoc &&
        ['tukey', 'fisher_lsd', 'dunnett', 'duncan', 'snk'].includes(parsed.meansPostHoc)
          ? parsed.meansPostHoc
          : DEFAULT_TABLE_SIGNIFICANCE.meansPostHoc,
      dunnettControl: typeof parsed.dunnettControl === 'string' ? parsed.dunnettControl : '',
      asProjectDefault: true,
    };
  } catch {
    return null;
  }
}

export function saveProjectSignificance(
  projectId: string | undefined,
  settings: TableSignificanceSettings
): void {
  if (!projectId || typeof window === 'undefined') return;
  window.localStorage.setItem(
    `${STORAGE_PREFIX}${projectId}`,
    JSON.stringify({ ...settings, asProjectDefault: true })
  );
}

export function clearProjectSignificance(projectId: string | undefined): void {
  if (!projectId || typeof window === 'undefined') return;
  window.localStorage.removeItem(`${STORAGE_PREFIX}${projectId}`);
}

type SigTest = {
  stub_row_id?: string;
  left?: string;
  right?: string;
  significant?: boolean;
  p_adjusted?: number | null;
};

type SigCell = {
  banner_id?: string;
  percent?: number | null;
  mean?: number | null;
};

/** ↑ / ↓ when the cell differs from the total (arrows mode). */
export function arrowForCell(
  book: Record<string, unknown> | null | undefined,
  rowId: string,
  bannerId: string
): '' | '↑' | '↓' {
  if (!book || bannerId === 'total') return '';
  if (
    showAsFromDisplay(
      book.significance_display,
      (book.spec as { comparison_type?: string } | undefined)?.comparison_type
    ) !== 'arrows'
  ) {
    return '';
  }
  const testsBlock = book.tests;
  const items: SigTest[] = Array.isArray(testsBlock)
    ? (testsBlock as SigTest[])
    : Array.isArray((testsBlock as { items?: SigTest[] } | undefined)?.items)
      ? (testsBlock as { items: SigTest[] }).items
      : Array.isArray(book.cell_comparisons)
        ? (book.cell_comparisons as SigTest[])
        : [];
  const hit = items.find(
    test =>
      test.stub_row_id === rowId &&
      test.left === bannerId &&
      (test.right === 'total' || test.right == null) &&
      test.significant === true
  );
  if (!hit) return '';
  const rows = (book.rows as { id?: string; cells?: SigCell[] }[]) || [];
  const row = rows.find(item => item.id === rowId);
  const cell = (row?.cells || []).find(item => item.banner_id === bannerId);
  const total = (row?.cells || []).find(item => item.banner_id === 'total');
  const cellLevel =
    typeof cell?.mean === 'number'
      ? cell.mean
      : typeof cell?.percent === 'number'
        ? cell.percent
        : null;
  const totalLevel =
    typeof total?.mean === 'number'
      ? total.mean
      : typeof total?.percent === 'number'
        ? total.percent
        : null;
  if (cellLevel == null || totalLevel == null) return '↑';
  if (cellLevel === totalLevel) return '↑';
  return cellLevel > totalLevel ? '↑' : '↓';
}

/** Footnote line matching the 9b artboard tone. */
export function significanceFootnoteLine(
  book: Record<string, unknown> | null | undefined,
  settings?: TableSignificanceSettings | null
): string {
  if (!book) return '';
  const showAs =
    settings?.showAs ??
    showAsFromDisplay(
      book.significance_display,
      (book.spec as { comparison_type?: string } | undefined)?.comparison_type
    );
  if (showAs === 'off') return '';
  const alpha =
    settings != null
      ? alphaFromConfidence(settings.confidence)
      : typeof book.significance_alpha === 'number'
        ? book.significance_alpha
        : typeof (book.spec as { significance_alpha?: number } | undefined)?.significance_alpha ===
            'number'
          ? (book.spec as { significance_alpha: number }).significance_alpha
          : 0.05;
  const confidence = confidenceFromAlpha(alpha);
  const mccRaw = String(
    settings?.multipleComparison ||
      (book.tests as { mcc?: { default?: string } } | undefined)?.mcc?.default ||
      book.mcc ||
      (book.spec as { multiple_comparison?: string } | undefined)?.multiple_comparison ||
      'fdr'
  ).toLowerCase();
  const mcc = (['none', 'bonferroni', 'fdr'].includes(mccRaw) ? mccRaw : 'fdr') as SigMcc;
  const meansRaw = String(
    settings?.meansPostHoc ||
      book.means_post_hoc ||
      (book.spec as { means_post_hoc?: string } | undefined)?.means_post_hoc ||
      'tukey'
  ).toLowerCase();
  const means = (
    ['tukey', 'fisher_lsd', 'dunnett', 'duncan', 'snk'].includes(meansRaw) ? meansRaw : 'tukey'
  ) as SigMeansPostHoc;
  const columns = ((book.banner_columns as { id?: string }[]) || []).filter(
    column => column.id && column.id !== 'total'
  ).length;
  // Arrows vs total always describe the chosen confidence — never a stale McNemar line.
  if (showAs === 'arrows') {
    const correction =
      mcc === 'none'
        ? ''
        : mcc === 'bonferroni'
          ? `, Bonferroni-corrected${columns ? ` across ${columns} columns` : ''}`
          : ', FDR-corrected';
    return `Arrows: higher or lower than the total at ${confidence}%${correction}`;
  }
  const named = String(book.letter_test || '').trim();
  if (book.paired_within_items || named.toLowerCase().startsWith('paired')) {
    // Rebuild from the live confidence so a hard-coded engine string cannot drift.
    return `Paired McNemar test at ${confidence}%. A letter marks a value significantly higher than that column.`;
  }
  const correction =
    mcc === 'none'
      ? ''
      : mcc === 'bonferroni'
        ? `, Bonferroni-corrected${columns ? ` across ${columns} columns` : ''}`
        : ', FDR-corrected';
  return `Letters: higher than that column at ${confidence}%${correction} · Means: ${meansPostHocLabel(means)}`;
}
