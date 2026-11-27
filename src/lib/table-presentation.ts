/** Table styling, persistent rules, and in-table edits (Displayr-style presentation). */

export const TABLE_STYLE_PRESETS = [
  'default',
  'banded',
  'compact',
  'client',
  'brand_health',
] as const;
export type TableStylePreset = (typeof TABLE_STYLE_PRESETS)[number];

/** House / Banded / Minimal — labels from report-editor artboard 9a. */
export const HOUSE_STYLE_OPTIONS: { id: TableStylePreset; label: string }[] = [
  { id: 'default', label: 'House' },
  { id: 'banded', label: 'Banded' },
  { id: 'compact', label: 'Minimal' },
];

export const RULE_TYPES = [
  'hide_small_base',
  'hide_empty',
  'hide_non_significant',
  'sort',
  'show_top_k',
  'colour_scale',
  'highlight',
  'shade_alternate_rows',
  'shade_net_rows',
  'add_rank_column',
  'add_difference_column',
] as const;
export type TableRuleType = (typeof RULE_TYPES)[number];

export type HideMode = 'hide_row' | 'blank_cell';
export type RuleAxis = 'rows' | 'columns' | 'both';
export type SortDirection = 'asc' | 'desc';
export type HighlightOp = 'above' | 'below' | 'equal';
export type StatKey =
  | 'percent'
  | 'row_percent'
  | 'total_percent'
  | 'count'
  | 'mean'
  | 'unweighted_n';

export type TableCellFormat = {
  rowId: string;
  columnId: string;
  fill: string;
  color: string;
  bold: boolean;
  borderColor: string;
  borderWidthPt: number;
};

export type TableStyle = {
  preset: TableStylePreset;
  fontFamily: string;
  fontSizePt: number;
  headerFill: string;
  headerColor: string;
  bodyFill: string;
  bodyColor: string;
  borderColor: string;
  borderWidthPt: number;
  freezeHeader: boolean;
  rowHeights: Record<string, number>;
  columnWidths: Record<string, number>;
  cellFormats: TableCellFormat[];
};

export type TableRule = {
  id: string;
  type: TableRuleType;
  enabled: boolean;
  mode?: HideMode;
  threshold?: number;
  axis?: RuleAxis;
  by?: string;
  direction?: SortDirection;
  protectNets?: boolean;
  k?: number;
  statistic?: StatKey;
  columnId?: string | null;
  leftColumnId?: string | null;
  rightColumnId?: string | null;
  label?: string | null;
  lowColor?: string;
  highColor?: string;
  op?: HighlightOp;
  value?: number;
  fill?: string;
  color?: string;
};

export type TableNetMerge = {
  id: string;
  label: string;
  rowIds: string[];
  hideMembers: boolean;
};

export type TableEdits = {
  renames: Record<string, string>;
  hiddenRowIds: string[];
  hiddenColumnIds: string[];
  rowOrder: string[];
  merges: TableNetMerge[];
};

export type PresentationCellStyle = {
  rowId: string;
  columnId: string;
  fill?: string;
  color?: string;
  bold?: boolean;
  borderColor?: string;
  borderWidthPt?: number;
};

export type BannerBookLike = {
  banner_columns?: Array<Record<string, unknown>>;
  rows?: Array<Record<string, unknown>>;
  cells?: Array<Record<string, unknown>>;
  stubs?: Array<Record<string, unknown>>;
  letters?: Array<Record<string, unknown>>;
  tests?: unknown;
  [key: string]: unknown;
};

export type PresentedBook = BannerBookLike & {
  rows: Array<Record<string, unknown>>;
  presentation: {
    style: TableStyle;
    rules: TableRule[];
    edits: TableEdits;
    cellStyles: PresentationCellStyle[];
  };
};

const RULE_TYPE_SET = new Set<string>(RULE_TYPES);
const PRESET_SET = new Set<string>(TABLE_STYLE_PRESETS);
const HIDE_MODES = new Set<HideMode>(['hide_row', 'blank_cell']);
const AXES = new Set<RuleAxis>(['rows', 'columns', 'both']);
const SORT_DIRECTIONS = new Set<SortDirection>(['asc', 'desc']);
const HIGHLIGHT_OPS = new Set<HighlightOp>(['above', 'below', 'equal']);
const STAT_KEYS = new Set<StatKey>([
  'percent',
  'row_percent',
  'total_percent',
  'count',
  'mean',
  'unweighted_n',
]);

export const DEFAULT_TABLE_STYLE: TableStyle = {
  preset: 'default',
  fontFamily: 'Inter',
  fontSizePt: 10,
  headerFill: '#F6F6F3',
  headerColor: '#1B1C1A',
  bodyFill: '#FFFFFF',
  bodyColor: '#1B1C1A',
  borderColor: '#E7E6E1',
  borderWidthPt: 0.5,
  freezeHeader: true,
  rowHeights: {},
  columnWidths: {},
  cellFormats: [],
};

const PRESET_OVERRIDES: Partial<Record<TableStylePreset, Partial<TableStyle>>> = {
  banded: {
    bodyFill: '#FFFFFF',
    headerFill: '#F6F6F3',
    borderWidthPt: 0.5,
  },
  compact: { fontSizePt: 8, borderWidthPt: 0.25, headerFill: '#FFFFFF' },
  client: {
    fontFamily: 'Georgia',
    fontSizePt: 11,
    headerFill: '#1B1C1A',
    headerColor: '#FFFFFF',
    borderColor: '#1B1C1A',
  },
  brand_health: {
    headerFill: '#E8F1ED',
    headerColor: '#1E6B58',
    borderColor: '#1E6B58',
  },
};

const PRESET_ALIASES: Record<string, TableStylePreset> = {
  house: 'default',
  minimal: 'compact',
};

const HEX6 = /^[0-9A-Fa-f]{6}$/;
const HEX3 = /^[0-9A-Fa-f]{3}$/;

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(16).slice(2, 12)}`;
}

function coerceHexColor(value: unknown, fallback: string): string {
  if (value == null) return fallback;
  let text = String(value).trim();
  if (text.startsWith('#')) text = text.slice(1);
  if (HEX3.test(text))
    text = text
      .split('')
      .map(ch => ch + ch)
      .join('');
  if (!HEX6.test(text)) return fallback;
  return `#${text.toUpperCase()}`;
}

function coerceFloat(value: unknown, fallback: number, minimum?: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  if (minimum != null && number < minimum) return fallback;
  return number;
}

function coerceInt(value: unknown, fallback: number, minimum?: number): number {
  const number = Number.parseInt(String(value), 10);
  if (!Number.isFinite(number)) return fallback;
  if (minimum != null && number < minimum) return fallback;
  return number;
}

function coerceBool(value: unknown, fallback: boolean): boolean {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  const text = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(text)) return true;
  if (['0', 'false', 'no', 'off'].includes(text)) return false;
  return fallback;
}

export function normalizeCellFormat(raw: unknown): TableCellFormat | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const rowId = String(source.row_id || source.rowId || '').trim();
  const columnId = String(source.column_id || source.columnId || '').trim();
  if (!rowId || !columnId) return null;
  return {
    rowId,
    columnId,
    fill: coerceHexColor(source.fill || source.background, '#FFFFFF'),
    color: coerceHexColor(source.color || source.text_color || source.textColor, '#1B1C1A'),
    bold: coerceBool(source.bold, false),
    borderColor: coerceHexColor(source.border_color || source.borderColor, '#E7E6E1'),
    borderWidthPt: coerceFloat(source.border_width_pt ?? source.borderWidthPt, 0.5, 0),
  };
}

export function tableStylePresetLabel(preset: TableStylePreset | string): string {
  const key = String(preset || '')
    .trim()
    .toLowerCase();
  const mapped = PRESET_ALIASES[key] || (PRESET_SET.has(key) ? (key as TableStylePreset) : null);
  const option = HOUSE_STYLE_OPTIONS.find(item => item.id === mapped);
  if (option) return option.label;
  if (key === 'client') return 'Client';
  if (key === 'brand_health') return 'Brand health';
  return 'House';
}

export function tableRuleLabel(rule: TableRule): string {
  switch (rule.type) {
    case 'hide_small_base':
      if (rule.mode === 'blank_cell') {
        return `Amber when base under ${rule.threshold ?? 30}`;
      }
      return `Hide rows with base under ${rule.threshold ?? 30}`;
    case 'hide_empty':
      return rule.axis === 'columns'
        ? 'Hide empty columns'
        : rule.axis === 'both'
          ? 'Hide empty rows and columns'
          : 'Hide empty rows';
    case 'hide_non_significant':
      return 'Hide rows with nothing significant';
    case 'sort':
      return `Sort rows ${rule.direction === 'asc' ? 'ascending' : 'descending'}`;
    case 'show_top_k':
      return `Show top ${rule.k ?? 5} rows`;
    case 'colour_scale':
      return 'Colour scale on values';
    case 'highlight':
      if (rule.op === 'above' && rule.color?.toUpperCase() === '#1E6B58') {
        return 'Bold + green when significantly higher';
      }
      if (rule.op === 'below' && (rule.statistic === 'unweighted_n' || rule.fill === '#F5E6C8')) {
        return `Amber when base under ${rule.value ?? 50}`;
      }
      if (rule.op === 'above') return `Highlight values above ${rule.value ?? 0}`;
      if (rule.op === 'below') return `Highlight values below ${rule.value ?? 0}`;
      return `Highlight values equal to ${rule.value ?? 0}`;
    case 'shade_alternate_rows':
      return 'Shade alternate rows';
    case 'shade_net_rows':
      return 'Shade NET rows';
    case 'add_rank_column':
      return rule.label?.trim() ? `Add rank column (${rule.label.trim()})` : 'Add rank column';
    case 'add_difference_column':
      return rule.label?.trim()
        ? `Add difference column (${rule.label.trim()})`
        : 'Add difference between columns';
    default:
      return 'Table rule';
  }
}

/** Ready-made rules offered from the Rules ▾ menu / + Add rule. */
export const TABLE_RULE_CATALOG: {
  id: string;
  label: string;
  rule: Omit<TableRule, 'id' | 'enabled'> & { enabled?: boolean };
}[] = [
  {
    id: 'sig-higher',
    label: 'Bold + green when significantly higher',
    rule: {
      type: 'highlight',
      op: 'above',
      value: 0,
      statistic: 'percent',
      fill: '#E8F1ED',
      color: '#1E6B58',
    },
  },
  {
    id: 'amber-base',
    label: 'Amber when base under 50',
    rule: {
      type: 'highlight',
      op: 'below',
      value: 50,
      statistic: 'unweighted_n',
      fill: '#F5E6C8',
      color: '#A15C12',
    },
  },
  {
    id: 'hide-small-base',
    label: 'Hide rows with small base',
    rule: { type: 'hide_small_base', mode: 'hide_row', threshold: 30, axis: 'rows' },
  },
  {
    id: 'blank-small-base',
    label: 'Blank cells with small base',
    rule: { type: 'hide_small_base', mode: 'blank_cell', threshold: 30, axis: 'rows' },
  },
  {
    id: 'hide-empty',
    label: 'Hide empty rows and columns',
    rule: { type: 'hide_empty', axis: 'both' },
  },
  {
    id: 'hide-nonsig',
    label: 'Hide rows with nothing significant',
    rule: { type: 'hide_non_significant', axis: 'rows' },
  },
  {
    id: 'sort-desc',
    label: 'Sort rows descending',
    rule: { type: 'sort', by: 'average', direction: 'desc', protectNets: true },
  },
  {
    id: 'top-k',
    label: 'Show top 5 rows',
    rule: { type: 'show_top_k', k: 5, by: 'average', direction: 'desc', protectNets: true },
  },
  {
    id: 'colour-scale',
    label: 'Colour scale on values',
    rule: { type: 'colour_scale', statistic: 'percent', lowColor: '#FFFFFF', highColor: '#1E6B58' },
  },
  {
    id: 'shade-alt',
    label: 'Shade alternate rows',
    rule: { type: 'shade_alternate_rows', fill: '#F6F6F3' },
  },
  {
    id: 'shade-net',
    label: 'Shade NET rows',
    rule: { type: 'shade_net_rows', fill: '#E8F1ED' },
  },
  {
    id: 'add-rank',
    label: 'Add rank column',
    rule: {
      type: 'add_rank_column',
      by: 'average',
      direction: 'desc',
      statistic: 'percent',
      protectNets: true,
      label: 'Rank',
    },
  },
  {
    id: 'add-difference',
    label: 'Add difference between columns',
    rule: {
      type: 'add_difference_column',
      statistic: 'percent',
    },
  },
];

export function normalizeTableStyle(raw: unknown): TableStyle {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  let presetRaw = String(source.preset || DEFAULT_TABLE_STYLE.preset)
    .trim()
    .toLowerCase();
  if (PRESET_ALIASES[presetRaw]) presetRaw = PRESET_ALIASES[presetRaw];
  let preset = presetRaw as TableStylePreset;
  if (!PRESET_SET.has(preset)) preset = DEFAULT_TABLE_STYLE.preset;
  const base: TableStyle = {
    ...DEFAULT_TABLE_STYLE,
    ...(PRESET_OVERRIDES[preset] || {}),
    preset,
    rowHeights: {},
    columnWidths: {},
    cellFormats: [],
  };
  const rowHeightsRaw = source.row_heights || source.rowHeights;
  const columnWidthsRaw = source.column_widths || source.columnWidths;
  const rowHeights: Record<string, number> = {};
  if (rowHeightsRaw && typeof rowHeightsRaw === 'object') {
    for (const [key, value] of Object.entries(rowHeightsRaw as Record<string, unknown>)) {
      const label = String(key).trim();
      if (!label) continue;
      rowHeights[label] = coerceFloat(value, 18, 1);
    }
  }
  const columnWidths: Record<string, number> = {};
  if (columnWidthsRaw && typeof columnWidthsRaw === 'object') {
    for (const [key, value] of Object.entries(columnWidthsRaw as Record<string, unknown>)) {
      const label = String(key).trim();
      if (!label) continue;
      columnWidths[label] = coerceFloat(value, 80, 1);
    }
  }
  const formats: TableCellFormat[] = [];
  for (const item of (source.cell_formats || source.cellFormats || []) as unknown[]) {
    const fmt = normalizeCellFormat(item);
    if (fmt) formats.push(fmt);
  }
  return {
    preset,
    fontFamily:
      String(source.font_family || source.fontFamily || base.fontFamily).trim() || base.fontFamily,
    fontSizePt: coerceFloat(source.font_size_pt ?? source.fontSizePt, base.fontSizePt, 4),
    headerFill: coerceHexColor(source.header_fill || source.headerFill, base.headerFill),
    headerColor: coerceHexColor(source.header_color || source.headerColor, base.headerColor),
    bodyFill: coerceHexColor(source.body_fill || source.bodyFill, base.bodyFill),
    bodyColor: coerceHexColor(source.body_color || source.bodyColor, base.bodyColor),
    borderColor: coerceHexColor(source.border_color || source.borderColor, base.borderColor),
    borderWidthPt: coerceFloat(
      source.border_width_pt ?? source.borderWidthPt,
      base.borderWidthPt,
      0
    ),
    freezeHeader: coerceBool(source.freeze_header ?? source.freezeHeader, base.freezeHeader),
    rowHeights,
    columnWidths,
    cellFormats: formats,
  };
}

function normalizeAxis(raw: unknown, fallback: RuleAxis = 'rows'): RuleAxis {
  const axis = String(raw || fallback)
    .trim()
    .toLowerCase() as RuleAxis;
  return AXES.has(axis) ? axis : fallback;
}

export function normalizeTableRule(raw: unknown): TableRule | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  let type = String(source.type || source.rule_type || source.ruleType || '')
    .trim()
    .toLowerCase();
  const aliases: Record<string, TableRuleType> = {
    color_scale: 'colour_scale',
    colorscale: 'colour_scale',
    top_k: 'show_top_k',
    topk: 'show_top_k',
    hide_small_bases: 'hide_small_base',
    hide_low_base: 'hide_small_base',
    shade_nets: 'shade_net_rows',
    shade_alternate: 'shade_alternate_rows',
    hide_nonsig: 'hide_non_significant',
    hide_non_sig: 'hide_non_significant',
    rank_column: 'add_rank_column',
    add_rank: 'add_rank_column',
    difference_column: 'add_difference_column',
    add_difference: 'add_difference_column',
    column_difference: 'add_difference_column',
  };
  type = aliases[type] || type;
  if (!RULE_TYPE_SET.has(type)) return null;
  const rule: TableRule = {
    id: String(source.id || '').trim() || newId('rule'),
    type: type as TableRuleType,
    enabled: coerceBool(source.enabled, true),
  };
  if (type === 'hide_small_base') {
    const mode = String(source.mode || 'hide_row')
      .trim()
      .toLowerCase() as HideMode;
    rule.mode = HIDE_MODES.has(mode) ? mode : 'hide_row';
    rule.threshold = coerceInt(source.threshold ?? source.min_base, 30, 0);
    rule.axis = normalizeAxis(source.axis, 'rows');
  } else if (type === 'hide_empty') {
    rule.axis = normalizeAxis(source.axis, 'both');
  } else if (type === 'hide_non_significant') {
    rule.axis = normalizeAxis(source.axis, 'rows');
  } else if (type === 'sort' || type === 'show_top_k' || type === 'add_rank_column') {
    rule.by =
      String(source.by || source.column_id || source.columnId || 'average').trim() || 'average';
    const direction = String(source.direction || 'desc')
      .trim()
      .toLowerCase() as SortDirection;
    rule.direction = SORT_DIRECTIONS.has(direction) ? direction : 'desc';
    rule.protectNets = coerceBool(source.protect_nets ?? source.protectNets, true);
    if (type === 'show_top_k') {
      rule.k = coerceInt(source.k ?? source.top_k ?? source.topK, 5, 1);
    }
    if (type === 'add_rank_column') {
      const statistic = String(source.statistic || 'percent')
        .trim()
        .toLowerCase() as StatKey;
      rule.statistic = STAT_KEYS.has(statistic) ? statistic : 'percent';
      const label = String(source.label || source.column_label || source.columnLabel || '').trim();
      rule.label = label || 'Rank';
    }
  } else if (type === 'colour_scale') {
    const statistic = String(source.statistic || 'percent')
      .trim()
      .toLowerCase() as StatKey;
    rule.statistic = STAT_KEYS.has(statistic) ? statistic : 'percent';
    rule.columnId = String(source.column_id || source.columnId || '').trim() || null;
    rule.lowColor = coerceHexColor(source.low_color || source.lowColor, '#FFFFFF');
    rule.highColor = coerceHexColor(source.high_color || source.highColor, '#1E6B58');
  } else if (type === 'highlight') {
    const statistic = String(source.statistic || 'percent')
      .trim()
      .toLowerCase() as StatKey;
    rule.statistic = STAT_KEYS.has(statistic) ? statistic : 'percent';
    const op = String(source.op || source.operator || 'above')
      .trim()
      .toLowerCase() as HighlightOp;
    rule.op = HIGHLIGHT_OPS.has(op) ? op : 'above';
    rule.value = coerceFloat(source.value, 50);
    rule.fill = coerceHexColor(source.fill, '#E8F1ED');
    rule.color = coerceHexColor(source.color, '#1B1C1A');
    rule.columnId = String(source.column_id || source.columnId || '').trim() || null;
  } else if (type === 'shade_alternate_rows') {
    rule.fill = coerceHexColor(source.fill, '#F6F6F3');
  } else if (type === 'shade_net_rows') {
    rule.fill = coerceHexColor(source.fill, '#E8F1ED');
  } else if (type === 'add_difference_column') {
    const statistic = String(source.statistic || 'percent')
      .trim()
      .toLowerCase() as StatKey;
    rule.statistic = STAT_KEYS.has(statistic) ? statistic : 'percent';
    rule.leftColumnId =
      String(
        source.left_column_id ||
          source.leftColumnId ||
          source.column_a ||
          source.columnA ||
          source.left ||
          ''
      ).trim() || null;
    rule.rightColumnId =
      String(
        source.right_column_id ||
          source.rightColumnId ||
          source.column_b ||
          source.columnB ||
          source.right ||
          ''
      ).trim() || null;
    const label = String(source.label || source.column_label || source.columnLabel || '').trim();
    rule.label = label || null;
  }
  return rule;
}

export function normalizeTableRules(raw: unknown): TableRule[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeTableRule).filter((rule): rule is TableRule => Boolean(rule));
}

export function normalizeTableEdits(raw: unknown): TableEdits {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const renamesRaw = source.renames || source.row_renames || source.rowRenames || {};
  const renames: Record<string, string> = {};
  if (renamesRaw && typeof renamesRaw === 'object') {
    for (const [key, value] of Object.entries(renamesRaw as Record<string, unknown>)) {
      const rowId = String(key).trim();
      const label = String(value || '').trim();
      if (rowId && label) renames[rowId] = label;
    }
  }
  const hiddenRowIds = ((source.hidden_row_ids || source.hiddenRowIds || []) as unknown[])
    .map(item => String(item).trim())
    .filter(Boolean);
  const hiddenColumnIds = ((source.hidden_column_ids || source.hiddenColumnIds || []) as unknown[])
    .map(item => String(item).trim())
    .filter(Boolean);
  const rowOrder = ((source.row_order || source.rowOrder || []) as unknown[])
    .map(item => String(item).trim())
    .filter(Boolean);
  const merges: TableNetMerge[] = [];
  for (const item of (source.merges || source.net_merges || source.netMerges || []) as unknown[]) {
    if (!item || typeof item !== 'object') continue;
    const merge = item as Record<string, unknown>;
    const rowIds = ((merge.row_ids || merge.rowIds || []) as unknown[])
      .map(rid => String(rid).trim())
      .filter(Boolean);
    if (rowIds.length < 2) continue;
    merges.push({
      id: String(merge.id || '').trim() || newId('net'),
      label: String(merge.label || 'NET').trim() || 'NET',
      rowIds,
      hideMembers: coerceBool(merge.hide_members ?? merge.hideMembers, true),
    });
  }
  return { renames, hiddenRowIds, hiddenColumnIds, rowOrder, merges };
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function rowsFromStubs(book: BannerBookLike): Array<Record<string, unknown>> {
  if (Array.isArray(book.rows) && book.rows.length) {
    return book.rows.filter(row => row && typeof row === 'object') as Array<
      Record<string, unknown>
    >;
  }
  const cells = (book.cells || []).filter(cell => cell && typeof cell === 'object') as Array<
    Record<string, unknown>
  >;
  const byKey = new Map(
    cells.map(cell => [`${cell.stub_row_id}::${cell.banner_id}`, cell] as const)
  );
  const banners = (book.banner_columns || []).filter(
    col => col && typeof col === 'object'
  ) as Array<Record<string, unknown>>;
  const rows: Array<Record<string, unknown>> = [];
  for (const stub of book.stubs || []) {
    if (!stub || typeof stub !== 'object') continue;
    const stubRows = (stub as Record<string, unknown>).rows;
    if (!Array.isArray(stubRows)) continue;
    for (const srow of stubRows) {
      if (!srow || typeof srow !== 'object') continue;
      const row = srow as Record<string, unknown>;
      const rowId = String(row.id || '').trim();
      if (!rowId) continue;
      rows.push({
        id: rowId,
        label: row.label || rowId,
        kind: row.kind,
        cells: banners.map(col => {
          const colId = String(col.id || '').trim();
          const hit = byKey.get(`${rowId}::${colId}`);
          return hit
            ? deepClone(hit)
            : { stub_row_id: rowId, banner_id: colId, percent: null, unweighted_n: null };
        }),
      });
    }
  }
  return rows;
}

function isNetRow(row: Record<string, unknown>): boolean {
  const kind = String(row.kind || '')
    .trim()
    .toLowerCase();
  if (['net', 'nets', 'net_row'].includes(kind)) return true;
  const label = String(row.label || '')
    .trim()
    .toUpperCase();
  return label === 'NET' || label.startsWith('NET ');
}

function isProtectedRow(row: Record<string, unknown>): boolean {
  const kind = String(row.kind || '')
    .trim()
    .toLowerCase();
  if (['header', 'total', 'base', 'sd', 'net', 'nets', 'net_row'].includes(kind)) return true;
  const label = String(row.label || '')
    .trim()
    .toUpperCase();
  return label === 'TOTAL' || label === 'BASE' || label === 'NET' || label.startsWith('NET ');
}

function cellStat(
  cell: Record<string, unknown> | null | undefined,
  statistic: string
): number | null {
  if (!cell) return null;
  let value: unknown = cell[statistic];
  if (value == null && statistic === 'count') value = cell.weighted_n;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function rowSortKey(row: Record<string, unknown>, by: string): number {
  const cells = (Array.isArray(row.cells) ? row.cells : []).filter(
    cell => cell && typeof cell === 'object'
  ) as Array<Record<string, unknown>>;
  if (by === 'row_base') {
    const values = cells
      .map(cell => cellStat(cell, 'unweighted_n'))
      .filter((value): value is number => value != null);
    return values.length ? Math.max(...values) : Number.NEGATIVE_INFINITY;
  }
  if (by === 'average') {
    const values = cells
      .map(cell => cellStat(cell, 'percent'))
      .filter((value): value is number => value != null);
    return values.length
      ? values.reduce((a, b) => a + b, 0) / values.length
      : Number.NEGATIVE_INFINITY;
  }
  for (const cell of cells) {
    if (String(cell.banner_id || '') === by) {
      const value = cellStat(cell, 'percent');
      return value == null ? Number.NEGATIVE_INFINITY : value;
    }
  }
  return Number.NEGATIVE_INFINITY;
}

function bannerLabel(book: BannerBookLike, columnId: string): string {
  for (const col of book.banner_columns || []) {
    if (!col || typeof col !== 'object') continue;
    const record = col as Record<string, unknown>;
    if (String(record.id || '') === columnId) {
      const label = String(record.label || '').trim();
      return label || columnId;
    }
  }
  return columnId;
}

function resolveBannerId(book: BannerBookLike, hint: string | null | undefined): string | null {
  const text = String(hint || '').trim();
  if (!text) return null;
  if (text.toLowerCase() === 'average' || text.toLowerCase() === 'row_base') return text;
  const banners = (book.banner_columns || []).filter(
    col => col && typeof col === 'object'
  ) as Array<Record<string, unknown>>;
  for (const col of banners) {
    if (String(col.id || '') === text) return text;
  }
  const lowered = text.toLowerCase();
  for (const col of banners) {
    if (
      String(col.label || '')
        .trim()
        .toLowerCase() === lowered
    ) {
      return String(col.id || '') || null;
    }
  }
  return text;
}

/** Banner ids that can feed a difference column (excludes Total and derived). */
export function comparableBannerIds(book: BannerBookLike | null | undefined): string[] {
  if (!book || typeof book !== 'object') return [];
  return (
    (book.banner_columns || []).filter(col => col && typeof col === 'object') as Array<
      Record<string, unknown>
    >
  )
    .filter(col => {
      const id = String(col.id || '').trim();
      return id && id.toLowerCase() !== 'total' && !col.derived;
    })
    .map(col => String(col.id || ''));
}

/**
 * Why a presentation rule cannot change the rendered table, or null when it can.
 * Labels only — never codes or variable names.
 */
export function tableRuleSkipReason(
  book: BannerBookLike | null | undefined,
  rule: TableRule | null | undefined
): string | null {
  if (!rule || !rule.enabled) return null;
  if (rule.type === 'add_difference_column') {
    let leftId = book ? resolveBannerId(book, rule.leftColumnId) : null;
    let rightId = book ? resolveBannerId(book, rule.rightColumnId) : null;
    if (!leftId || !rightId) {
      const clean = comparableBannerIds(book);
      if (!leftId && clean.length >= 1) leftId = clean[0]!;
      if (!rightId && clean.length >= 2) rightId = clean[1]!;
    }
    if (!leftId || !rightId || leftId === rightId) {
      return 'Need two banner columns besides Total to compare.';
    }
    return null;
  }
  if (rule.type === 'add_rank_column') {
    if (!book || typeof book !== 'object') return null;
    const rows = (Array.isArray(book.rows) ? book.rows : []).filter(
      row => row && typeof row === 'object'
    ) as Array<Record<string, unknown>>;
    const protect = rule.protectNets !== false;
    const byHint = String(rule.by || 'average').trim() || 'average';
    const by = resolveBannerId(book, byHint) || byHint;
    const statistic = rule.statistic || 'percent';
    const hasScore = rows.some(row => {
      if (protect && isProtectedRow(row)) return false;
      return rowStatValue(row, by, statistic) != null;
    });
    if (!hasScore) {
      return 'No rows to rank on this table.';
    }
    return null;
  }
  return null;
}

function rowStatValue(row: Record<string, unknown>, by: string, statistic: string): number | null {
  const cells = (Array.isArray(row.cells) ? row.cells : []).filter(
    cell => cell && typeof cell === 'object'
  ) as Array<Record<string, unknown>>;
  if (!by || by === 'average') {
    const values = cells
      .map(cell => cellStat(cell, statistic))
      .filter((value): value is number => value != null);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  }
  if (by === 'row_base') {
    const values = cells
      .map(cell => cellStat(cell, 'unweighted_n'))
      .filter((value): value is number => value != null);
    return values.length ? Math.max(...values) : null;
  }
  for (const cell of cells) {
    if (String(cell.banner_id || '') === by) return cellStat(cell, statistic);
  }
  return null;
}

function competitionRanks(
  values: Array<{ rowId: string; value: number }>,
  descending: boolean
): Map<string, number> {
  const ordered = [...values].sort((a, b) => (descending ? b.value - a.value : a.value - b.value));
  const ranks = new Map<string, number>();
  let index = 0;
  while (index < ordered.length) {
    const score = ordered[index]!.value;
    let end = index + 1;
    while (end < ordered.length && ordered[end]!.value === score) end += 1;
    const rank = index + 1;
    for (const item of ordered.slice(index, end)) ranks.set(item.rowId, rank);
    index = end;
  }
  return ranks;
}

function appendDerivedColumn(
  book: BannerBookLike,
  rows: Array<Record<string, unknown>>,
  options: {
    columnId: string;
    label: string;
    kind: string;
    values: Map<string, number | null>;
  }
) {
  const banners = (book.banner_columns || []).filter(
    col => col && typeof col === 'object'
  ) as Array<Record<string, unknown>>;
  if (banners.some(col => String(col.id || '') === options.columnId)) {
    book.banner_columns = banners.filter(col => String(col.id || '') !== options.columnId);
    for (const row of rows) {
      row.cells = (
        (Array.isArray(row.cells) ? row.cells : []) as Array<Record<string, unknown>>
      ).filter(
        cell =>
          cell && typeof cell === 'object' && String(cell.banner_id || '') !== options.columnId
      );
    }
  }
  const nextBanners = (
    (book.banner_columns || []).filter(col => col && typeof col === 'object') as Array<
      Record<string, unknown>
    >
  ).concat([
    {
      id: options.columnId,
      label: options.label,
      kind: options.kind,
      derived: true,
    },
  ]);
  book.banner_columns = nextBanners;
  for (const row of rows) {
    const rowId = String(row.id || '');
    const value = options.values.has(rowId) ? options.values.get(rowId)! : null;
    const cells = (
      (Array.isArray(row.cells) ? row.cells : []) as Array<Record<string, unknown>>
    ).concat([
      {
        stub_row_id: rowId,
        banner_id: options.columnId,
        percent: value,
        count: value,
        mean: value,
        kind: options.kind,
        derived: true,
      },
    ]);
    row.cells = cells;
  }
}

function letterKeys(book: BannerBookLike): Set<string> {
  const keys = new Set<string>();
  for (const item of book.letters || []) {
    if (!item || typeof item !== 'object') continue;
    const letter = String(item.letter_display || item.letter || '').trim();
    if (!letter) continue;
    keys.add(`${item.stub_row_id}::${item.banner_id}`);
  }
  const pushTests = (tests: unknown) => {
    if (!Array.isArray(tests)) return;
    for (const test of tests) {
      if (!test || typeof test !== 'object') continue;
      const row = test as Record<string, unknown>;
      if (row.significant && !row.refused) {
        keys.add(`${row.stub_row_id}::${row.left}`);
        keys.add(`${row.stub_row_id}::${row.right}`);
      }
    }
  };
  pushTests(book.tests);
  if (book.tests && typeof book.tests === 'object' && !Array.isArray(book.tests)) {
    pushTests((book.tests as Record<string, unknown>).items);
  }
  return keys;
}

function blendHex(low: string, high: string, t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const rgb = (hex: string) => {
    const text = hex.slice(1);
    return [
      parseInt(text.slice(0, 2), 16),
      parseInt(text.slice(2, 4), 16),
      parseInt(text.slice(4, 6), 16),
    ];
  };
  const [lr, lg, lb] = rgb(low);
  const [hr, hg, hb] = rgb(high);
  const r = Math.round(lr + (hr - lr) * clamped);
  const g = Math.round(lg + (hg - lg) * clamped);
  const b = Math.round(lb + (hb - lb) * clamped);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
    .toString(16)
    .padStart(2, '0')}`.toUpperCase();
}

function rowIsEmpty(row: Record<string, unknown>): boolean {
  const cells = (Array.isArray(row.cells) ? row.cells : []).filter(
    cell => cell && typeof cell === 'object'
  ) as Array<Record<string, unknown>>;
  if (!cells.length) return true;
  for (const cell of cells) {
    for (const key of [
      'percent',
      'row_percent',
      'total_percent',
      'count',
      'mean',
      'unweighted_n',
    ]) {
      const value = cellStat(cell, key);
      if (value != null && value !== 0) return false;
    }
  }
  return true;
}

function columnIsEmpty(columnId: string, rows: Array<Record<string, unknown>>): boolean {
  for (const row of rows) {
    for (const cell of (Array.isArray(row.cells) ? row.cells : []) as Array<
      Record<string, unknown>
    >) {
      if (!cell || typeof cell !== 'object') continue;
      if (String(cell.banner_id || '') !== columnId) continue;
      for (const key of [
        'percent',
        'row_percent',
        'total_percent',
        'count',
        'mean',
        'unweighted_n',
      ]) {
        const value = cellStat(cell, key);
        if (value != null && value !== 0) return false;
      }
    }
  }
  return true;
}

function rowMinBase(row: Record<string, unknown>): number | null {
  const values: number[] = [];
  for (const cell of (Array.isArray(row.cells) ? row.cells : []) as Array<
    Record<string, unknown>
  >) {
    if (!cell || typeof cell !== 'object') continue;
    const value = cellStat(cell, 'unweighted_n');
    if (value != null) values.push(value);
    const colBase = cellStat(cell, 'column_unweighted_n');
    if (colBase != null) values.push(colBase);
  }
  return values.length ? Math.min(...values) : null;
}

function mergeRows(
  rows: Array<Record<string, unknown>>,
  merge: TableNetMerge
): Array<Record<string, unknown>> {
  const memberIds = new Set(merge.rowIds);
  const members = rows.filter(row => memberIds.has(String(row.id || '')));
  if (members.length < 2) return rows;
  const banners = new Map<string, Array<Record<string, unknown>>>();
  for (const row of members) {
    for (const cell of (Array.isArray(row.cells) ? row.cells : []) as Array<
      Record<string, unknown>
    >) {
      if (!cell || typeof cell !== 'object') continue;
      const colId = String(cell.banner_id || '');
      const list = banners.get(colId) || [];
      list.push(cell);
      banners.set(colId, list);
    }
  }
  const netCells: Array<Record<string, unknown>> = [];
  for (const [colId, cells] of banners.entries()) {
    const weights = cells.map(cell => cellStat(cell, 'unweighted_n') || 0);
    const totalN = weights.reduce((a, b) => a + b, 0);
    const percentVals = cells.map(cell => cellStat(cell, 'percent'));
    let percent: number | null = null;
    if (totalN > 0 && percentVals.some(v => v != null)) {
      let weighted = 0;
      percentVals.forEach((value, index) => {
        weighted += (value || 0) * (weights[index] || 0);
      });
      percent = weighted / totalN;
    } else {
      const nums = percentVals.filter((v): v is number => v != null);
      percent = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    }
    netCells.push({
      stub_row_id: merge.id,
      banner_id: colId,
      percent,
      count: cells.reduce((sum, cell) => sum + (cellStat(cell, 'count') || 0), 0),
      weighted_n: cells.reduce((sum, cell) => sum + (cellStat(cell, 'weighted_n') || 0), 0),
      unweighted_n: cells.reduce((sum, cell) => sum + (cellStat(cell, 'unweighted_n') || 0), 0),
      kind: 'net',
    });
  }
  const netRow: Record<string, unknown> = {
    id: merge.id,
    label: merge.label,
    kind: 'net',
    cells: netCells,
    merged_from: [...merge.rowIds],
  };
  const out: Array<Record<string, unknown>> = [];
  let inserted = false;
  for (const row of rows) {
    const rowId = String(row.id || '');
    if (memberIds.has(rowId)) {
      if (!inserted) {
        out.push(netRow);
        inserted = true;
      }
      if (!merge.hideMembers) out.push(row);
      continue;
    }
    out.push(row);
  }
  if (!inserted) out.push(netRow);
  return out;
}

function setCellStyle(
  styles: Map<string, PresentationCellStyle>,
  rowId: string,
  columnId: string,
  patch: Partial<PresentationCellStyle>
) {
  const key = `${rowId}::${columnId}`;
  const current = styles.get(key) || { rowId, columnId };
  styles.set(key, { ...current, ...patch, rowId, columnId });
}

export function applyTablePresentation(
  book: BannerBookLike | null | undefined,
  options?: {
    style?: unknown;
    rules?: unknown;
    edits?: unknown;
  }
): PresentedBook {
  const out = deepClone(book && typeof book === 'object' ? book : {}) as BannerBookLike;
  const style = normalizeTableStyle(options?.style ?? out.table_style);
  const rules = normalizeTableRules(options?.rules ?? out.table_rules);
  const edits = normalizeTableEdits(options?.edits ?? out.table_edits);

  let rows = rowsFromStubs(out);
  for (const row of rows) {
    const rowId = String(row.id || '');
    if (edits.renames[rowId]) row.label = edits.renames[rowId];
  }
  for (const merge of edits.merges) {
    rows = mergeRows(rows, merge);
  }
  if (edits.hiddenRowIds.length) {
    const hidden = new Set(edits.hiddenRowIds);
    rows = rows.filter(row => !hidden.has(String(row.id || '')));
  }
  if (edits.hiddenColumnIds.length) {
    const hidden = new Set(edits.hiddenColumnIds);
    out.banner_columns = (out.banner_columns || []).filter(
      col =>
        col &&
        typeof col === 'object' &&
        !hidden.has(String((col as Record<string, unknown>).id || ''))
    );
    for (const row of rows) {
      row.cells = (
        (Array.isArray(row.cells) ? row.cells : []) as Array<Record<string, unknown>>
      ).filter(
        cell => cell && typeof cell === 'object' && !hidden.has(String(cell.banner_id || ''))
      );
    }
  }
  if (edits.rowOrder.length) {
    const rank = new Map(edits.rowOrder.map((rowId, index) => [rowId, index]));
    rows.sort((a, b) => {
      const aId = String(a.id || '');
      const bId = String(b.id || '');
      const aRank = rank.has(aId) ? 0 : 1;
      const bRank = rank.has(bId) ? 0 : 1;
      if (aRank !== bRank) return aRank - bRank;
      return (rank.get(aId) || 0) - (rank.get(bId) || 0);
    });
  }

  const letters = letterKeys(out);
  const cellStyles = new Map<string, PresentationCellStyle>();

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.type === 'hide_small_base') {
      const threshold = rule.threshold ?? 30;
      const mode = rule.mode || 'hide_row';
      const axis = rule.axis || 'rows';
      if (axis === 'rows' || axis === 'both') {
        if (mode === 'hide_row') {
          rows = rows.filter(row => {
            if (isProtectedRow(row)) return true;
            const base = rowMinBase(row);
            return !(base != null && base < threshold);
          });
        } else {
          for (const row of rows) {
            if (isProtectedRow(row)) continue;
            for (const cell of (Array.isArray(row.cells) ? row.cells : []) as Array<
              Record<string, unknown>
            >) {
              if (!cell || typeof cell !== 'object') continue;
              const base = cellStat(cell, 'unweighted_n');
              if (base != null && base < threshold) {
                cell.percent = null;
                cell.row_percent = null;
                cell.total_percent = null;
                cell.count = null;
                cell.mean = null;
                cell.low_base_suppressed = true;
                cell.blanked_small_base = true;
              }
            }
          }
        }
      }
      if ((axis === 'columns' || axis === 'both') && mode === 'hide_row') {
        const banners = (out.banner_columns || []).filter(
          col => col && typeof col === 'object'
        ) as Array<Record<string, unknown>>;
        const drop = new Set<string>();
        for (const col of banners) {
          const colId = String(col.id || '');
          if (!colId || colId === 'total') continue;
          const bases: number[] = [];
          for (const row of rows) {
            for (const cell of (Array.isArray(row.cells) ? row.cells : []) as Array<
              Record<string, unknown>
            >) {
              if (!cell || typeof cell !== 'object') continue;
              if (String(cell.banner_id || '') !== colId) continue;
              const value = cellStat(cell, 'column_unweighted_n') ?? cellStat(cell, 'unweighted_n');
              if (value != null) bases.push(value);
            }
          }
          if (bases.length && Math.min(...bases) < threshold) drop.add(colId);
        }
        if (drop.size) {
          out.banner_columns = banners.filter(col => !drop.has(String(col.id || '')));
          for (const row of rows) {
            row.cells = (
              (Array.isArray(row.cells) ? row.cells : []) as Array<Record<string, unknown>>
            ).filter(
              cell => cell && typeof cell === 'object' && !drop.has(String(cell.banner_id || ''))
            );
          }
        }
      }
    } else if (rule.type === 'hide_empty') {
      const axis = rule.axis || 'both';
      if (axis === 'rows' || axis === 'both') {
        rows = rows.filter(row => isProtectedRow(row) || !rowIsEmpty(row));
      }
      if (axis === 'columns' || axis === 'both') {
        const banners = (out.banner_columns || []).filter(
          col => col && typeof col === 'object'
        ) as Array<Record<string, unknown>>;
        const keep = new Set(
          banners
            .filter(
              col => String(col.id || '') === 'total' || !columnIsEmpty(String(col.id || ''), rows)
            )
            .map(col => String(col.id || ''))
        );
        out.banner_columns = banners.filter(col => keep.has(String(col.id || '')));
        for (const row of rows) {
          row.cells = (
            (Array.isArray(row.cells) ? row.cells : []) as Array<Record<string, unknown>>
          ).filter(
            cell => cell && typeof cell === 'object' && keep.has(String(cell.banner_id || ''))
          );
        }
      }
    } else if (rule.type === 'hide_non_significant') {
      const axis = rule.axis || 'rows';
      if (axis === 'rows' || axis === 'both') {
        rows = rows.filter(row => {
          if (isProtectedRow(row)) return true;
          const rowId = String(row.id || '');
          return (
            (Array.isArray(row.cells) ? row.cells : []) as Array<Record<string, unknown>>
          ).some(
            cell =>
              cell &&
              typeof cell === 'object' &&
              letters.has(`${cell.stub_row_id || rowId}::${cell.banner_id}`)
          );
        });
      }
      if (axis === 'columns' || axis === 'both') {
        const banners = (out.banner_columns || []).filter(
          col => col && typeof col === 'object'
        ) as Array<Record<string, unknown>>;
        const keep = new Set(
          banners
            .filter(col => {
              const colId = String(col.id || '');
              if (!colId || colId === 'total') return true;
              return rows.some(row => {
                const rowId = String(row.id || '');
                return letters.has(`${rowId}::${colId}`);
              });
            })
            .map(col => String(col.id || ''))
        );
        out.banner_columns = banners.filter(col => keep.has(String(col.id || '')));
        for (const row of rows) {
          row.cells = (
            (Array.isArray(row.cells) ? row.cells : []) as Array<Record<string, unknown>>
          ).filter(
            cell => cell && typeof cell === 'object' && keep.has(String(cell.banner_id || ''))
          );
        }
      }
    } else if (rule.type === 'sort') {
      const by = rule.by || 'average';
      const direction = rule.direction || 'desc';
      const protect = rule.protectNets !== false;
      const movable: Array<Record<string, unknown>> = [];
      const fixedBefore: Array<Record<string, unknown>> = [];
      const fixedAfter: Array<Record<string, unknown>> = [];
      let seenMovable = false;
      for (const row of rows) {
        if (protect && isProtectedRow(row)) {
          if (seenMovable) fixedAfter.push(row);
          else fixedBefore.push(row);
        } else {
          seenMovable = true;
          movable.push(row);
        }
      }
      movable.sort((a, b) => {
        const delta = rowSortKey(a, by) - rowSortKey(b, by);
        return direction === 'desc' ? -delta : delta;
      });
      rows = [...fixedBefore, ...movable, ...fixedAfter];
    } else if (rule.type === 'show_top_k') {
      const k = rule.k ?? 5;
      const by = rule.by || 'average';
      const protect = rule.protectNets !== false;
      const scored: Array<Record<string, unknown>> = [];
      for (const row of rows) {
        if (!(protect && isProtectedRow(row))) scored.push(row);
      }
      scored.sort((a, b) => rowSortKey(b, by) - rowSortKey(a, by));
      const top = scored.slice(0, k);
      const topIds = new Set(top.map(row => String(row.id || '')));
      const outRows: Array<Record<string, unknown>> = [];
      let inserted = false;
      for (const row of rows) {
        if (protect && isProtectedRow(row)) {
          outRows.push(row);
          continue;
        }
        if (!inserted) {
          outRows.push(...top);
          inserted = true;
        }
      }
      if (!inserted) outRows.push(...top);
      const seen = new Set<string>();
      rows = outRows.filter(row => {
        const rowId = String(row.id || '');
        if (!(isProtectedRow(row) || topIds.has(rowId))) return false;
        if (seen.has(rowId)) return false;
        seen.add(rowId);
        return true;
      });
    } else if (rule.type === 'colour_scale') {
      const statistic = rule.statistic || 'percent';
      const values: number[] = [];
      const targets: Array<{ rowId: string; columnId: string; value: number }> = [];
      for (const row of rows) {
        const rowId = String(row.id || '');
        for (const cell of (Array.isArray(row.cells) ? row.cells : []) as Array<
          Record<string, unknown>
        >) {
          if (!cell || typeof cell !== 'object') continue;
          const columnId = String(cell.banner_id || '');
          if (rule.columnId && columnId !== rule.columnId) continue;
          const value = cellStat(cell, statistic);
          if (value == null) continue;
          values.push(value);
          targets.push({ rowId, columnId, value });
        }
      }
      if (values.length) {
        const lowV = Math.min(...values);
        const highV = Math.max(...values);
        const span = highV === lowV ? 1 : highV - lowV;
        for (const target of targets) {
          setCellStyle(cellStyles, target.rowId, target.columnId, {
            fill: blendHex(
              rule.lowColor || '#FFFFFF',
              rule.highColor || '#1E6B58',
              (target.value - lowV) / span
            ),
          });
        }
      }
    } else if (rule.type === 'highlight') {
      const statistic = rule.statistic || 'percent';
      const op = rule.op || 'above';
      const threshold = rule.value ?? 0;
      for (const row of rows) {
        const rowId = String(row.id || '');
        for (const cell of (Array.isArray(row.cells) ? row.cells : []) as Array<
          Record<string, unknown>
        >) {
          if (!cell || typeof cell !== 'object') continue;
          const columnId = String(cell.banner_id || '');
          if (rule.columnId && columnId !== rule.columnId) continue;
          const value = cellStat(cell, statistic);
          if (value == null) continue;
          const hit =
            (op === 'above' && value > threshold) ||
            (op === 'below' && value < threshold) ||
            (op === 'equal' && Math.abs(value - threshold) < 1e-9);
          if (hit) {
            setCellStyle(cellStyles, rowId, columnId, {
              fill: rule.fill,
              color: rule.color,
            });
          }
        }
      }
    } else if (rule.type === 'shade_alternate_rows') {
      let visibleIndex = 0;
      for (const row of rows) {
        if (String(row.kind || '').toLowerCase() === 'header') continue;
        if (visibleIndex % 2 === 1) {
          const rowId = String(row.id || '');
          for (const cell of (Array.isArray(row.cells) ? row.cells : []) as Array<
            Record<string, unknown>
          >) {
            if (cell && typeof cell === 'object') {
              setCellStyle(cellStyles, rowId, String(cell.banner_id || ''), { fill: rule.fill });
            }
          }
        }
        visibleIndex += 1;
      }
    } else if (rule.type === 'shade_net_rows') {
      for (const row of rows) {
        if (!isNetRow(row)) continue;
        const rowId = String(row.id || '');
        for (const cell of (Array.isArray(row.cells) ? row.cells : []) as Array<
          Record<string, unknown>
        >) {
          if (cell && typeof cell === 'object') {
            setCellStyle(cellStyles, rowId, String(cell.banner_id || ''), { fill: rule.fill });
          }
        }
      }
    } else if (rule.type === 'add_rank_column') {
      const byHint = String(rule.by || 'average').trim() || 'average';
      const by = resolveBannerId(out, byHint) || byHint;
      const statistic = rule.statistic || 'percent';
      const direction = rule.direction || 'desc';
      const protect = rule.protectNets !== false;
      const label = String(rule.label || 'Rank').trim() || 'Rank';
      const columnId = `rank-${rule.id || newId('rule')}`;
      const scored: Array<{ rowId: string; value: number }> = [];
      for (const row of rows) {
        const rowId = String(row.id || '');
        if (!rowId) continue;
        if (protect && isProtectedRow(row)) continue;
        const value = rowStatValue(row, by, statistic);
        if (value == null) continue;
        scored.push({ rowId, value });
      }
      const ranks = competitionRanks(scored, direction !== 'asc');
      const values = new Map<string, number | null>();
      for (const row of rows) {
        const rowId = String(row.id || '');
        if (protect && isProtectedRow(row)) {
          values.set(rowId, null);
        } else if (ranks.has(rowId)) {
          values.set(rowId, ranks.get(rowId)!);
        } else {
          values.set(rowId, null);
        }
      }
      appendDerivedColumn(out, rows, {
        columnId,
        label,
        kind: 'rank',
        values,
      });
    } else if (rule.type === 'add_difference_column') {
      let leftId = resolveBannerId(out, rule.leftColumnId);
      let rightId = resolveBannerId(out, rule.rightColumnId);
      if (!leftId || !rightId) {
        const clean = comparableBannerIds(out);
        if (!leftId && clean.length >= 1) leftId = clean[0]!;
        if (!rightId && clean.length >= 2) rightId = clean[1]!;
      }
      if (leftId && rightId && leftId !== rightId) {
        const statistic = rule.statistic || 'percent';
        const leftLabel = bannerLabel(out, leftId);
        const rightLabel = bannerLabel(out, rightId);
        const label = String(rule.label || '').trim() || `${leftLabel} − ${rightLabel}`;
        const columnId = `diff-${rule.id || newId('rule')}`;
        const values = new Map<string, number | null>();
        for (const row of rows) {
          const rowId = String(row.id || '');
          const leftVal = rowStatValue(row, leftId, statistic);
          const rightVal = rowStatValue(row, rightId, statistic);
          values.set(rowId, leftVal == null || rightVal == null ? null : leftVal - rightVal);
        }
        appendDerivedColumn(out, rows, {
          columnId,
          label,
          kind: 'difference',
          values,
        });
      }
    }
  }

  const hasAlternateRule = rules.some(rule => rule.enabled && rule.type === 'shade_alternate_rows');
  if (style.preset === 'banded' && !hasAlternateRule) {
    let visibleIndex = 0;
    for (const row of rows) {
      if (String(row.kind || '').toLowerCase() === 'header') continue;
      if (visibleIndex % 2 === 1) {
        const rowId = String(row.id || '');
        for (const cell of (Array.isArray(row.cells) ? row.cells : []) as Array<
          Record<string, unknown>
        >) {
          if (cell && typeof cell === 'object') {
            setCellStyle(cellStyles, rowId, String(cell.banner_id || ''), { fill: '#F6F6F3' });
          }
        }
      }
      visibleIndex += 1;
    }
  }

  for (const fmt of style.cellFormats) {
    setCellStyle(cellStyles, fmt.rowId, fmt.columnId, {
      fill: fmt.fill,
      color: fmt.color,
      bold: fmt.bold,
      borderColor: fmt.borderColor,
      borderWidthPt: fmt.borderWidthPt,
    });
  }

  out.rows = rows;
  const flat: Array<Record<string, unknown>> = [];
  for (const row of rows) {
    for (const cell of (Array.isArray(row.cells) ? row.cells : []) as Array<
      Record<string, unknown>
    >) {
      if (cell && typeof cell === 'object') flat.push(cell);
    }
  }
  if (flat.length) out.cells = flat;

  return {
    ...out,
    rows,
    presentation: {
      style,
      rules,
      edits,
      cellStyles: [...cellStyles.values()].sort((a, b) =>
        `${a.rowId}:${a.columnId}`.localeCompare(`${b.rowId}:${b.columnId}`)
      ),
    },
  };
}

/** Snake_case payload for API / document persistence. */
export function tableStyleForApi(style: TableStyle): Record<string, unknown> {
  return {
    preset: style.preset,
    font_family: style.fontFamily,
    font_size_pt: style.fontSizePt,
    header_fill: style.headerFill,
    header_color: style.headerColor,
    body_fill: style.bodyFill,
    body_color: style.bodyColor,
    border_color: style.borderColor,
    border_width_pt: style.borderWidthPt,
    freeze_header: style.freezeHeader,
    row_heights: style.rowHeights,
    column_widths: style.columnWidths,
    cell_formats: style.cellFormats.map(fmt => ({
      row_id: fmt.rowId,
      column_id: fmt.columnId,
      fill: fmt.fill,
      color: fmt.color,
      bold: fmt.bold,
      border_color: fmt.borderColor,
      border_width_pt: fmt.borderWidthPt,
    })),
  };
}

export function tableRulesForApi(rules: TableRule[]): Array<Record<string, unknown>> {
  return rules.map(rule => ({
    id: rule.id,
    type: rule.type,
    enabled: rule.enabled,
    mode: rule.mode,
    threshold: rule.threshold,
    axis: rule.axis,
    by: rule.by,
    direction: rule.direction,
    protect_nets: rule.protectNets,
    k: rule.k,
    statistic: rule.statistic,
    column_id: rule.columnId,
    left_column_id: rule.leftColumnId,
    right_column_id: rule.rightColumnId,
    label: rule.label,
    low_color: rule.lowColor,
    high_color: rule.highColor,
    op: rule.op,
    value: rule.value,
    fill: rule.fill,
    color: rule.color,
  }));
}

export function tableEditsForApi(edits: TableEdits): Record<string, unknown> {
  return {
    renames: edits.renames,
    hidden_row_ids: edits.hiddenRowIds,
    hidden_column_ids: edits.hiddenColumnIds,
    row_order: edits.rowOrder,
    merges: edits.merges.map(merge => ({
      id: merge.id,
      label: merge.label,
      row_ids: merge.rowIds,
      hide_members: merge.hideMembers,
    })),
  };
}
