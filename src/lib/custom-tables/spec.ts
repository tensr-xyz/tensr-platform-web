export type CustomTableNet = { label: string; values: string[] };

export type BannerQuestion = {
  column: string;
  values: string[];
  nested: BannerQuestion[];
};

export type StubQuestion = {
  column: string;
  values: string[];
  nets: CustomTableNet[];
};

export type SignificanceAlpha = 0.1 | 0.05 | 0.01;

export type TableDecimals = {
  count: number;
  column_proportion: number;
  row_proportion: number;
  total_proportion: number;
  column_mean: number;
};

export type CustomTableCanvas = {
  stubs: StubQuestion[];
  banners: BannerQuestion[];
  nestBanners: boolean;
  showCount: boolean;
  columnPercent: boolean;
  rowPercent: boolean;
  totalPercent: boolean;
  decimals: TableDecimals;
  significanceAlpha: SignificanceAlpha;
  letterLevels: 1 | 2;
  letterCase: 'upper' | 'lower';
  letterUpperAlpha: number;
  significanceDisplay: 'column_letters' | 'cell_comparisons';
  lowBaseThreshold: number;
  suppressLowBase: boolean;
  weightDatasetId: string | null;
  bannerId: string | null;
};

export type TableRequestBody = {
  stubs: Array<{ column: string; values: string[]; nets?: CustomTableNet[] }>;
  banner: Array<{
    column: string;
    values: string[];
    nested?: Array<{ column: string; values: string[] }>;
  }>;
  statistics: string[];
  significance_display: 'column_letters' | 'cell_comparisons';
  significance_alpha: SignificanceAlpha;
  letter_levels: 1 | 2;
  letter_case: 'upper' | 'lower';
  letter_upper_alpha: number;
  decimals: TableDecimals;
  nest_banners: boolean;
  low_base_threshold: number;
  suppress_low_base: boolean;
  banner_id?: string;
};

export function defaultDecimals(): TableDecimals {
  return {
    count: 0,
    column_proportion: 1,
    row_proportion: 1,
    total_proportion: 1,
    column_mean: 2,
  };
}

/** Uppercase cutoff for a two-level letter display at the chosen significance. */
export function stricterLetterAlpha(alpha: SignificanceAlpha): number {
  if (alpha === 0.1) return 0.05;
  if (alpha === 0.01) return 0.001;
  return 0.01;
}

export function resetBuilderSurface(): {
  canvas: CustomTableCanvas;
  error: null;
  book: null;
  previewWarning: null;
  activeSpecId: null;
  cellClick: null;
} {
  return {
    canvas: defaultCanvas(),
    error: null,
    book: null,
    previewWarning: null,
    activeSpecId: null,
    cellClick: null,
  };
}

export function defaultCanvas(): CustomTableCanvas {
  return {
    stubs: [],
    banners: [],
    nestBanners: true,
    showCount: false,
    columnPercent: true,
    rowPercent: false,
    totalPercent: false,
    decimals: defaultDecimals(),
    significanceAlpha: 0.05,
    letterLevels: 2,
    letterCase: 'lower',
    letterUpperAlpha: 0.01,
    significanceDisplay: 'column_letters',
    lowBaseThreshold: 30,
    suppressLowBase: false,
    weightDatasetId: null,
    bannerId: null,
  };
}

export function uniqueColumnValues(rows: Array<Record<string, unknown>>, column: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    const raw = row[column];
    if (raw == null) continue;
    const value = String(raw).trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function questionFromColumn(
  column: string,
  rows: Array<Record<string, unknown>>
): { column: string; values: string[] } {
  return { column, values: uniqueColumnValues(rows, column) };
}

export function addStubQuestion(
  canvas: CustomTableCanvas,
  column: string,
  rows: Array<Record<string, unknown>>
): CustomTableCanvas {
  if (canvas.stubs.some(s => s.column === column)) return canvas;
  const q = questionFromColumn(column, rows);
  return { ...canvas, stubs: [...canvas.stubs, { ...q, nets: [] }] };
}

export function addBannerQuestion(
  canvas: CustomTableCanvas,
  column: string,
  rows: Array<Record<string, unknown>>
): CustomTableCanvas {
  if (canvas.banners.some(b => b.column === column)) return canvas;
  const q = questionFromColumn(column, rows);
  return { ...canvas, banners: [...canvas.banners, { ...q, nested: [] }] };
}

export function nestUnderBanner(
  canvas: CustomTableCanvas,
  parentIndex: number,
  column: string,
  rows: Array<Record<string, unknown>>
): CustomTableCanvas {
  const banners = canvas.banners.map((banner, i) => {
    if (i !== parentIndex) return banner;
    if (banner.nested.some(n => n.column === column) || banner.column === column) return banner;
    const q = questionFromColumn(column, rows);
    return { ...banner, nested: [...banner.nested, { ...q, nested: [] }] };
  });
  return { ...canvas, banners };
}

export function moveCategory(
  canvas: CustomTableCanvas,
  axis: 'stub' | 'banner',
  questionIndex: number,
  from: number,
  to: number
): CustomTableCanvas {
  const move = (values: string[]) => {
    if (from < 0 || to < 0 || from >= values.length || to >= values.length) return values;
    const next = [...values];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  };
  if (axis === 'stub') {
    return {
      ...canvas,
      stubs: canvas.stubs.map((s, i) =>
        i === questionIndex ? { ...s, values: move(s.values) } : s
      ),
    };
  }
  return {
    ...canvas,
    banners: canvas.banners.map((b, i) =>
      i === questionIndex ? { ...b, values: move(b.values) } : b
    ),
  };
}

export function applyNetToStub(
  canvas: CustomTableCanvas,
  stubIndex: number,
  net: CustomTableNet
): CustomTableCanvas {
  return {
    ...canvas,
    stubs: canvas.stubs.map((stub, i) => {
      if (i !== stubIndex) return stub;
      if (stub.nets.some(n => n.label === net.label)) return stub;
      return { ...stub, nets: [...stub.nets, net] };
    }),
  };
}

export function bannerColumnProduct(banners: BannerQuestion[], nestBanners: boolean): number {
  const counts = banners.flatMap(b => [b.values.length, ...b.nested.map(n => n.values.length)]);
  if (!counts.length) return 0;
  if (!nestBanners) return counts.reduce((a, b) => a + b, 0);
  return counts.reduce((a, b) => a * Math.max(b, 1), 1);
}

export function buildTableRequest(canvas: CustomTableCanvas): TableRequestBody {
  const statistics: string[] = [];
  if (canvas.showCount) statistics.push('count');
  if (canvas.columnPercent || (!canvas.rowPercent && !canvas.showCount && !canvas.totalPercent)) {
    statistics.push('column_proportion');
  }
  if (canvas.rowPercent) statistics.push('row_proportion');
  if (canvas.totalPercent) statistics.push('total_proportion');
  if (!statistics.length) statistics.push('column_proportion');
  return {
    stubs: canvas.stubs.map(s => ({
      column: s.column,
      values: s.values,
      ...(s.nets.length ? { nets: s.nets } : {}),
    })),
    banner: canvas.banners.map(b => ({
      column: b.column,
      values: b.values,
      ...(canvas.nestBanners && b.nested.length
        ? { nested: b.nested.map(n => ({ column: n.column, values: n.values })) }
        : {}),
    })),
    statistics,
    significance_display: canvas.significanceDisplay,
    significance_alpha: canvas.significanceAlpha,
    letter_levels: canvas.letterLevels,
    letter_case: canvas.letterCase,
    letter_upper_alpha: canvas.letterUpperAlpha,
    decimals: canvas.decimals,
    nest_banners: canvas.nestBanners,
    low_base_threshold: canvas.lowBaseThreshold,
    suppress_low_base: canvas.suppressLowBase,
    ...(canvas.bannerId ? { banner_id: canvas.bannerId } : {}),
  };
}

/** Identity of the table the canvas would run; the saved banner id does not change the table. */
export function tableRequestKey(canvas: CustomTableCanvas): string {
  const request: Partial<TableRequestBody> = { ...buildTableRequest(canvas) };
  delete request.banner_id;
  return JSON.stringify(request);
}

export function namedBannerPayload(
  canvas: CustomTableCanvas,
  id: string,
  label?: string
): { id: string; label: string; banner: TableRequestBody['banner'] } {
  return {
    id,
    label: (label && label.trim()) || id,
    banner: buildTableRequest(canvas).banner,
  };
}

export type StoredTableSpec = {
  id?: string;
  stubs?: Array<{ column?: string; values?: unknown[]; nets?: CustomTableNet[] }>;
  banner?: Array<{
    column?: string;
    values?: unknown[];
    nested?: Array<{ column?: string; values?: unknown[] }>;
  }>;
  banners?: Array<{
    column?: string;
    columns?: string[];
    values?: unknown[];
    nested?: Array<{ column?: string; columns?: string[]; values?: unknown[] }>;
  }>;
  statistics?: string[];
  nest_banners?: boolean;
  significance_display?: string;
  significance_alpha?: number;
  letter_levels?: number;
  letter_case?: string;
  letter_upper_alpha?: number;
  decimals?: Partial<TableDecimals>;
  low_base_threshold?: number;
  suppress_low_base?: boolean;
  banner_id?: string;
};

function asStringValues(values: unknown[] | undefined): string[] {
  if (!Array.isArray(values)) return [];
  return values.map(v => String(v));
}

function bannerFromStored(
  item:
    | NonNullable<StoredTableSpec['banner']>[number]
    | NonNullable<StoredTableSpec['banners']>[number]
): BannerQuestion | null {
  const column =
    ('column' in item && item.column) || ('columns' in item && item.columns?.[0]) || '';
  if (!column) return null;
  const nestedRaw = Array.isArray(item.nested) ? item.nested : [];
  return {
    column: String(column),
    values: asStringValues(item.values),
    nested: nestedRaw.map(n => bannerFromStored(n)).filter((n): n is BannerQuestion => n != null),
  };
}

export function canvasFromStoredSpec(
  spec: StoredTableSpec,
  current?: CustomTableCanvas
): CustomTableCanvas {
  const stats = spec.statistics || [];
  const bannerSource = spec.banner?.length ? spec.banner : spec.banners || [];
  return {
    ...(current || defaultCanvas()),
    stubs: (spec.stubs || [])
      .filter(s => s.column)
      .map(s => ({
        column: String(s.column),
        values: asStringValues(s.values),
        nets: Array.isArray(s.nets) ? s.nets : [],
      })),
    banners: bannerSource.map(bannerFromStored).filter((b): b is BannerQuestion => b != null),
    nestBanners: spec.nest_banners !== false,
    showCount: stats.includes('count'),
    columnPercent:
      stats.includes('column_proportion') ||
      (!stats.includes('row_proportion') &&
        !stats.includes('count') &&
        !stats.includes('total_proportion')),
    rowPercent: stats.includes('row_proportion'),
    totalPercent: stats.includes('total_proportion'),
    decimals: { ...defaultDecimals(), ...(spec.decimals || {}) },
    significanceAlpha:
      spec.significance_alpha === 0.1 || spec.significance_alpha === 0.01
        ? spec.significance_alpha
        : 0.05,
    letterLevels: spec.letter_levels === 1 ? 1 : 2,
    letterCase: spec.letter_case === 'upper' ? 'upper' : 'lower',
    letterUpperAlpha: typeof spec.letter_upper_alpha === 'number' ? spec.letter_upper_alpha : 0.001,
    significanceDisplay:
      spec.significance_display === 'cell_comparisons' ? 'cell_comparisons' : 'column_letters',
    lowBaseThreshold:
      typeof spec.low_base_threshold === 'number'
        ? spec.low_base_threshold
        : current?.lowBaseThreshold || 30,
    suppressLowBase: Boolean(spec.suppress_low_base),
    bannerId: spec.banner_id || current?.bannerId || null,
  };
}

export type SavedTableSpecRow = {
  spec_id?: string;
  id?: string;
  created_at?: string;
  label?: string;
  dataset_id?: string;
  content_fingerprint?: string;
};

export function savedSpecLabel(row: SavedTableSpecRow): string {
  if (row.label && row.label.trim()) return row.label.trim();
  const id = row.spec_id || row.id || 'saved table';
  return id.slice(0, 8);
}
