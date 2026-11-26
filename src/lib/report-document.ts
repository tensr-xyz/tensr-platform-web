/** Report document: pages with positioned live objects (slide editor engine). */

import {
  getPageLayout,
  normalizeReportTheme,
  reportThemeForApi,
  type ReportTheme,
} from '@/lib/report-theme';
import {
  applyTablePresentation,
  normalizeTableEdits,
  normalizeTableRules,
  normalizeTableStyle,
  tableEditsForApi,
  tableRulesForApi,
  tableStyleForApi,
  type PresentedBook,
  type TableEdits,
  type TableRule,
  type TableStyle,
} from '@/lib/table-presentation';

export type { TableEdits, TableRule, TableStyle } from '@/lib/table-presentation';
export { applyTablePresentation } from '@/lib/table-presentation';

export const PAGE_WIDTH_IN = 13.333;
export const PAGE_HEIGHT_IN = 7.5;
export const PAGE_ASPECT = '16:9' as const;

export type ReportObjectKind = 'text' | 'table' | 'chart' | 'image' | 'shape';
export type ReportShapeType = 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'callout';
export type AlignEdge = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type DistributeAxis = 'horizontal' | 'vertical';
export type TextAlign = 'left' | 'center' | 'right';
export type VerticalAlign = 'top' | 'middle' | 'bottom';
export type ListStyle = 'none' | 'bullet' | 'number';

export type ReportFrame = { x: number; y: number; w: number; h: number };

export type TextBoxStyle = {
  fontFamily: string;
  fontSizePt: number;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  align: TextAlign;
  verticalAlign: VerticalAlign;
  lineSpacing: number;
  listStyle: ListStyle;
  listIndent: number;
};

export type TextBindingKind = 'sample_size' | 'page_number' | 'cell';

/** Live text bound to a table base, page index, or one cell. */
export type TextBinding = {
  kind: TextBindingKind;
  sourceObjectId: string | null;
  runId: string | null;
  pinId: string | null;
  tableSpecId: string | null;
  rowKey: string | null;
  colKey: string | null;
  stat: string | null;
  template: string | null;
  prefix: string | null;
  suffix: string | null;
  stale: boolean;
  fingerprint: string | null;
};

export type TextRun = {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  color: string | null;
  fontFamily: string | null;
  fontSizePt: number | null;
  href: string | null;
  binding: TextBinding | null;
};

export type DefaultLabels = {
  net: string;
  total: string;
};

export type ReportObject = {
  id: string;
  kind: ReportObjectKind;
  frame: ReportFrame;
  zIndex: number;
  hidden: boolean;
  slotId: string | null;
  text: string;
  textStyle: TextBoxStyle;
  runs: TextRun[];
  binding: TextBinding | null;
  shapeType: ReportShapeType | null;
  imageUrl: string | null;
  runId: string | null;
  pinId: string | null;
  tableSpecId: string | null;
  tableStyle: TableStyle;
  tableRules: TableRule[];
  tableEdits: TableEdits;
  keepLive: boolean;
};

export type ReportPage = {
  id: string;
  title: string;
  layoutId: string;
  section: string | null;
  objects: ReportObject[];
  hideFromExport: boolean;
  hideFromPublish: boolean;
};

export type SavedPageTemplate = {
  id: string;
  name: string;
  kind: 'page';
  layoutId: string;
  title: string | null;
  section: string | null;
  objects: Array<Record<string, unknown>>;
};

export type ReportDocument = {
  pageWidthIn: number;
  pageHeightIn: number;
  aspect: typeof PAGE_ASPECT;
  defaultLabels: DefaultLabels;
  theme: ReportTheme;
  pageTemplates: SavedPageTemplate[];
  pages: ReportPage[];
};

const OBJECT_KINDS = new Set<ReportObjectKind>(['text', 'table', 'chart', 'image', 'shape']);
const SHAPE_TYPES = new Set<ReportShapeType>(['rectangle', 'ellipse', 'line', 'arrow', 'callout']);
export const DEFAULT_GRID_STEP = 0.02;
const ALIGN_EDGES = new Set<AlignEdge>(['left', 'center', 'right', 'top', 'middle', 'bottom']);
const DISTRIBUTE_AXES = new Set<DistributeAxis>(['horizontal', 'vertical']);
const TEXT_ALIGNS = new Set<TextAlign>(['left', 'center', 'right']);
const VERTICAL_ALIGNS = new Set<VerticalAlign>(['top', 'middle', 'bottom']);
const LIST_STYLES = new Set<ListStyle>(['none', 'bullet', 'number']);
const MAX_LIST_INDENT = 8;
export const PAGE_HREF_PREFIX = 'page:';
const TEXT_BINDING_KINDS = new Set<TextBindingKind>(['sample_size', 'page_number', 'cell']);
export const DEFAULT_PAGE_NUMBER_TEMPLATE = '{n}';

export const DEFAULT_TEXT_STYLE: TextBoxStyle = {
  fontFamily: 'Inter',
  fontSizePt: 18,
  color: '#1B1C1A',
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  align: 'left',
  verticalAlign: 'top',
  lineSpacing: 1.15,
  listStyle: 'none',
  listIndent: 0,
};

export const DEFAULT_LABELS: DefaultLabels = {
  net: 'NET',
  total: 'Total',
};

const HEX6 = /^[0-9A-Fa-f]{6}$/;
const HEX3 = /^[0-9A-Fa-f]{3}$/;

const SLOT_FRAMES: Record<string, Record<string, ReportFrame>> = {
  title_only: {
    title: { x: 0.06, y: 0.06, w: 0.88, h: 0.12 },
    content: { x: 0.06, y: 0.22, w: 0.88, h: 0.68 },
  },
  title_page: {
    title: { x: 0.08, y: 0.28, w: 0.84, h: 0.18 },
    subtitle: { x: 0.08, y: 0.5, w: 0.84, h: 0.12 },
  },
  title_and_content: {
    title: { x: 0.06, y: 0.06, w: 0.88, h: 0.12 },
    content: { x: 0.06, y: 0.22, w: 0.88, h: 0.68 },
  },
  content_and_text: {
    content: { x: 0.06, y: 0.1, w: 0.52, h: 0.78 },
    text: { x: 0.62, y: 0.1, w: 0.32, h: 0.78 },
  },
  two_content: {
    content_left: { x: 0.04, y: 0.1, w: 0.44, h: 0.78 },
    content_right: { x: 0.52, y: 0.1, w: 0.44, h: 0.78 },
  },
};

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 12)}`;
}

function clamp01(value: unknown, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  if (number < 0) return 0;
  if (number > 1) return 1;
  return number;
}

export function normalizeFrame(raw: unknown): ReportFrame {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    x: clamp01(source.x, 0.06),
    y: clamp01(source.y, 0.1),
    w: clamp01(source.w ?? source.width, 0.4),
    h: clamp01(source.h ?? source.height, 0.3),
  };
}

function snapValue(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(Math.round(value / step) * step * 1e6) / 1e6;
}

export function snapFrameToGrid(
  frame: unknown,
  options?: { step?: number; enabled?: boolean }
): ReportFrame {
  const box = normalizeFrame(frame);
  if (options?.enabled === false) return box;
  const grid =
    typeof options?.step === 'number' && Number.isFinite(options.step) && options.step > 0
      ? options.step
      : DEFAULT_GRID_STEP;
  return {
    x: clamp01(snapValue(box.x, grid), box.x),
    y: clamp01(snapValue(box.y, grid), box.y),
    w: Math.max(grid, clamp01(snapValue(box.w, grid), box.w)),
    h: Math.max(grid, clamp01(snapValue(box.h, grid), box.h)),
  };
}

export function normalizeShapeType(raw: unknown): ReportShapeType | null {
  let label = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
    .replace(/ /g, '_');
  const aliases: Record<string, ReportShapeType> = {
    rect: 'rectangle',
    box: 'rectangle',
    circle: 'ellipse',
    oval: 'ellipse',
    hline: 'line',
    vline: 'line',
    speech: 'callout',
    speech_bubble: 'callout',
  };
  label = aliases[label] || label;
  return SHAPE_TYPES.has(label as ReportShapeType) ? (label as ReportShapeType) : null;
}

export function frameForSlot(layoutId: string, slotId: string): ReportFrame | null {
  const layout = String(layoutId || '').trim() || 'blank';
  const slot = String(slotId || '').trim();
  if (!slot) return null;
  const found = SLOT_FRAMES[layout]?.[slot];
  return found ? { ...found } : null;
}

/** Object kind for a layout master slot (headline text, empty chart/table, commentary). */
export function kindForLayoutSlot(layoutId: string, slotId: string): ReportObjectKind {
  const layout = String(layoutId || '').trim() || 'blank';
  const slot = String(slotId || '').trim();
  if (slot === 'title' || slot === 'subtitle' || slot === 'text') return 'text';
  if (slot === 'content' && layout === 'title_only') return 'table';
  if (slot === 'content' || slot === 'content_left' || slot === 'content_right') return 'chart';
  return 'text';
}

function placeholderTextForSlot(slotId: string, pageTitle: string): string {
  const slot = String(slotId || '').trim();
  if (slot === 'title') return String(pageTitle || '').trim() || 'Headline';
  if (slot === 'subtitle') return 'Subtitle';
  if (slot === 'text') return 'Add commentary';
  return '';
}

/** Empty slotted objects for a page master so Add page / Change layout show placeholders. */
export function placeholderObjectsForLayout(
  layoutId: string,
  options?: { title?: string; occupiedSlotIds?: Iterable<string> }
): ReportObject[] {
  const layout = getPageLayout(String(layoutId || '').trim() || 'blank');
  if (!layout) return [];
  const occupied = new Set(
    [...(options?.occupiedSlotIds || [])].map(id => String(id || '').trim()).filter(Boolean)
  );
  const pageTitle = String(options?.title || '').trim();
  const objects: ReportObject[] = [];
  let zIndex = 1;
  for (const slot of layout.slots) {
    if (occupied.has(slot.id)) continue;
    const frame = frameForSlot(layout.id, slot.id);
    if (!frame) continue;
    const kind = kindForLayoutSlot(layout.id, slot.id);
    const textStyle =
      slot.id === 'title'
        ? { ...DEFAULT_TEXT_STYLE, fontSizePt: layout.id === 'title_page' ? 32 : 28, bold: true }
        : slot.id === 'subtitle'
          ? { ...DEFAULT_TEXT_STYLE, fontSizePt: 18 }
          : { ...DEFAULT_TEXT_STYLE };
    objects.push({
      id: newId('obj'),
      kind,
      frame,
      zIndex: zIndex++,
      hidden: false,
      slotId: slot.id,
      text: kind === 'text' ? placeholderTextForSlot(slot.id, pageTitle) : '',
      textStyle,
      runs: [],
      binding: null,
      shapeType: null,
      imageUrl: null,
      runId: null,
      pinId: null,
      tableSpecId: null,
      tableStyle: normalizeTableStyle({}),
      tableRules: [],
      tableEdits: normalizeTableEdits({}),
      keepLive: true,
    });
  }
  return objects;
}

export function inchesFrame(frame: ReportFrame): ReportFrame {
  const box = normalizeFrame(frame);
  return {
    x: Math.round(box.x * PAGE_WIDTH_IN * 10000) / 10000,
    y: Math.round(box.y * PAGE_HEIGHT_IN * 10000) / 10000,
    w: Math.round(box.w * PAGE_WIDTH_IN * 10000) / 10000,
    h: Math.round(box.h * PAGE_HEIGHT_IN * 10000) / 10000,
  };
}

function coerceHexColor(value: unknown, fallback: string): string {
  if (value == null) return fallback;
  let text = String(value).trim();
  if (text.startsWith('#')) text = text.slice(1);
  if (HEX3.test(text)) text = text.replace(/(.)/g, '$1$1');
  if (!HEX6.test(text)) return fallback;
  return `#${text.toUpperCase()}`;
}

function coercePositiveNumber(value: unknown, fallback: number, minimum = 0.01): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number < minimum) return fallback;
  return number;
}

export function normalizeTextStyle(raw: unknown): TextBoxStyle {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  let align = String(source.align || source.text_align || source.textAlign || '')
    .trim()
    .toLowerCase() as TextAlign;
  if (!TEXT_ALIGNS.has(align)) align = DEFAULT_TEXT_STYLE.align;
  let verticalAlign = String(source.vertical_align || source.verticalAlign || source.valign || '')
    .trim()
    .toLowerCase() as VerticalAlign;
  if (!VERTICAL_ALIGNS.has(verticalAlign)) verticalAlign = DEFAULT_TEXT_STYLE.verticalAlign;
  let listStyle = String(source.list_style || source.listStyle || source.list || '')
    .trim()
    .toLowerCase();
  if (listStyle === 'bullets' || listStyle === 'ul' || listStyle === 'unordered') {
    listStyle = 'bullet';
  }
  if (
    listStyle === 'numbers' ||
    listStyle === 'ol' ||
    listStyle === 'ordered' ||
    listStyle === 'numbered'
  ) {
    listStyle = 'number';
  }
  if (!LIST_STYLES.has(listStyle as ListStyle)) listStyle = DEFAULT_TEXT_STYLE.listStyle;
  const indentRaw = source.list_indent ?? source.listIndent ?? 0;
  const indent = Math.max(
    0,
    Math.min(MAX_LIST_INDENT, Number.isFinite(Number(indentRaw)) ? Number(indentRaw) : 0)
  );
  let font =
    String(source.font_family ?? source.fontFamily ?? DEFAULT_TEXT_STYLE.fontFamily).trim() ||
    DEFAULT_TEXT_STYLE.fontFamily;
  // Browser generic "serif" (and bare Times) was the accidental default on old
  // decks; house text is Inter. Explicit "Times New Roman" stays a user choice.
  if (/^(serif|times|times roman)$/i.test(font)) {
    font = DEFAULT_TEXT_STYLE.fontFamily;
  }
  return {
    fontFamily: font,
    fontSizePt: coercePositiveNumber(
      source.font_size_pt ?? source.fontSizePt ?? source.font_size ?? source.fontSize,
      DEFAULT_TEXT_STYLE.fontSizePt,
      1
    ),
    color: coerceHexColor(source.color ?? source.colour, DEFAULT_TEXT_STYLE.color),
    bold: Boolean(source.bold),
    italic: Boolean(source.italic),
    underline: Boolean(source.underline),
    strikethrough: Boolean(
      source.strikethrough !== undefined ? source.strikethrough : source.strike
    ),
    align,
    verticalAlign,
    lineSpacing: coercePositiveNumber(
      source.line_spacing ?? source.lineSpacing,
      DEFAULT_TEXT_STYLE.lineSpacing,
      0.5
    ),
    listStyle: listStyle as ListStyle,
    listIndent: indent,
  };
}

export function pageHref(pageId: string): string {
  return `${PAGE_HREF_PREFIX}${String(pageId || '').trim()}`;
}

export function resolveTextHref(
  href: unknown
): { kind: 'page'; pageId: string } | { kind: 'url'; url: string } | null {
  const text = String(href || '').trim();
  if (!text) return null;
  if (text.toLowerCase().startsWith(PAGE_HREF_PREFIX)) {
    const pageId = text.slice(PAGE_HREF_PREFIX.length).trim();
    return pageId ? { kind: 'page', pageId } : null;
  }
  return { kind: 'url', url: text };
}

/** Every in-report page: link on a text object (finding → evidence page). */
export function listPageLinks(
  document: { pages?: Array<Record<string, unknown>> } | null | undefined
): Array<{ fromPageId: string; objectId: string; pageId: string; href: string }> {
  const pages = Array.isArray(document?.pages) ? document.pages : [];
  const links: Array<{ fromPageId: string; objectId: string; pageId: string; href: string }> = [];
  for (const page of pages) {
    if (!page || typeof page !== 'object') continue;
    const fromPageId = String(page.id || '');
    const objects = Array.isArray(page.objects) ? page.objects : [];
    for (const obj of objects) {
      if (!obj || typeof obj !== 'object') continue;
      const record = obj as Record<string, unknown>;
      if (record.kind !== 'text') continue;
      const objectId = String(record.id || '');
      const candidates: unknown[] = [];
      if (record.href) candidates.push(record.href);
      const runs = Array.isArray(record.runs) ? record.runs : [];
      for (const run of runs) {
        if (run && typeof run === 'object' && (run as { href?: unknown }).href) {
          candidates.push((run as { href?: unknown }).href);
        }
      }
      for (const href of candidates) {
        const resolved = resolveTextHref(href);
        if (!resolved || resolved.kind !== 'page') continue;
        links.push({
          fromPageId,
          objectId,
          pageId: resolved.pageId,
          href: pageHref(resolved.pageId),
        });
      }
    }
  }
  return links;
}

export function normalizeTextBinding(raw: unknown): TextBinding | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const kind = String(source.kind || source.type || '')
    .trim()
    .toLowerCase() as TextBindingKind;
  if (!TEXT_BINDING_KINDS.has(kind)) return null;
  const rowKey =
    String(source.row_key || source.rowKey || source.row_label || source.rowLabel || '').trim() ||
    null;
  const colKey =
    String(
      source.col_key ||
        source.colKey ||
        source.column_key ||
        source.columnKey ||
        source.col_label ||
        source.colLabel ||
        ''
    ).trim() || null;
  if (kind === 'cell' && !rowKey && !colKey) return null;
  const templateRaw = String(source.template || '').trim() || null;
  const prefix = String(source.prefix ?? '');
  const suffix = String(source.suffix ?? '');
  return {
    kind,
    sourceObjectId: String(source.source_object_id || source.sourceObjectId || '').trim() || null,
    runId: String(source.run_id || source.runId || '').trim() || null,
    pinId: String(source.pin_id || source.pinId || '').trim() || null,
    tableSpecId: String(source.table_spec_id || source.tableSpecId || '').trim() || null,
    rowKey,
    colKey,
    stat:
      kind === 'cell'
        ? String(source.stat || source.statistic || 'percent')
            .trim()
            .toLowerCase() || 'percent'
        : null,
    template: kind === 'page_number' ? templateRaw || DEFAULT_PAGE_NUMBER_TEMPLATE : null,
    prefix: kind === 'cell' ? prefix : null,
    suffix: kind === 'cell' ? suffix : null,
    stale: Boolean(source.stale),
    fingerprint: String(source.fingerprint || '').trim() || null,
  };
}

function formatBaseCount(value: unknown): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return Math.round(number).toLocaleString('en-GB');
}

export function sampleSizeDescriptionText(source: unknown): string {
  if (!source || typeof source !== 'object') return '';
  const book = source as Record<string, unknown>;
  const label = String(book.base_label || '').trim();
  if (label) {
    if (/^base\s*:/i.test(label)) return `Base:${label.replace(/^base\s*:/i, '')}`;
    if (/^base\b/i.test(label)) return `Base: ${label.replace(/^base\s+/i, '')}`;
    return label;
  }
  const weight =
    book.weight && typeof book.weight === 'object'
      ? (book.weight as Record<string, unknown>)
      : null;
  if (weight?.weight_aware && weight.weighted_n != null && weight.unweighted_n != null) {
    const shown = formatBaseCount(weight.weighted_n);
    const unweighted = formatBaseCount(weight.unweighted_n);
    const ess = formatBaseCount(weight.kish_effective_base ?? weight.kish_ess);
    let line = `Base: ${shown} weighted (unweighted ${unweighted})`;
    if (ess) line = `${line}; Kish effective n = ${ess}`;
    return line;
  }
  if (book.answered_n != null && book.respondent_n != null) {
    return `Base: answered ${formatBaseCount(book.answered_n)} of ${formatBaseCount(book.respondent_n)}`;
  }
  if (book.respondent_n != null) {
    return `Base: all respondents (${formatBaseCount(book.respondent_n)})`;
  }
  return '';
}

/** Question label shown above a live table preview (never a variable code). */
export function tablePreviewTitle(source: unknown): string {
  if (!source || typeof source !== 'object') return '';
  const book = source as Record<string, unknown>;
  const raw = String(book.title || '').trim();
  if (!raw) return '';
  const stripped = raw.replace(/^Frequency Table:\s*/i, '').trim();
  return stripped || raw;
}

/** Footer under a live table — base, weight, and letter tests when present. */
export function tablePreviewFootnote(source: unknown): string {
  if (!source || typeof source !== 'object') return '';
  const book = source as Record<string, unknown>;
  const parts: string[] = [];
  const base = sampleSizeDescriptionText(book);
  if (base) parts.push(base);
  const weight =
    book.weight && typeof book.weight === 'object'
      ? (book.weight as Record<string, unknown>)
      : null;
  if (weight?.weight_aware) parts.push('Weighted');
  const spec =
    book.spec && typeof book.spec === 'object' ? (book.spec as Record<string, unknown>) : null;
  const display = String(book.significance_display ?? spec?.significance_display ?? '')
    .trim()
    .toLowerCase();
  const hasLetters =
    display === 'column_letters' ||
    (display !== 'none' &&
      display !== 'off' &&
      display !== 'cell_comparisons' &&
      Array.isArray(book.letters) &&
      book.letters.length > 0);
  if (hasLetters) {
    const alpha = Number(book.significance_alpha ?? spec?.significance_alpha ?? 0.05);
    const pct = alpha === 0.01 ? '99%' : alpha === 0.1 ? '90%' : '95%';
    parts.push(`Letters: ${pct} vs column`);
  }
  return parts.join(' · ');
}

/** CSS font stack so missing webfonts never fall back to the browser serif default. */
export function cssFontStack(family: string | null | undefined): string {
  const name =
    String(family || DEFAULT_TEXT_STYLE.fontFamily).trim() || DEFAULT_TEXT_STYLE.fontFamily;
  if (/^serif$/i.test(name)) return 'Inter, system-ui, sans-serif';
  if (/^(sans-serif|monospace|system-ui|cursive|fantasy)$/i.test(name)) return name;
  if (/^inter$/i.test(name)) return 'Inter, system-ui, sans-serif';
  if (/system\s*sans/i.test(name)) return 'system-ui, sans-serif';
  if (/times/i.test(name)) return `"${name}", Times, serif`;
  return `"${name}", Inter, system-ui, sans-serif`;
}

/** Gap under a text frame so the next object (table title, commentary) never overlaps. */
const TEXT_STACK_GAP = 0.04;

const TRAILING_BASE_FOOTNOTE_RE =
  /\s+(?:Base\s*:\s*(?:Unweighted,\s*)?n\s*=\s*[\d,]+|Base\s*:\s*[\d,]+(?:\s*\([^)]*\))?|Base\s*:\s*[\d,]+\s+weighted(?:\s*\([^)]*\))?|Unweighted,\s*n\s*=\s*[\d,]+)\s*$/i;

/** Drop a pasted Base / n footer from commentary; live tables already show it. */
export function stripTrailingBaseFootnote(text: string): string {
  let cleaned = String(text || '').trim();
  if (!cleaned) return '';
  let previous = '';
  while (previous !== cleaned) {
    previous = cleaned;
    cleaned = cleaned.replace(TRAILING_BASE_FOOTNOTE_RE, '').trim();
  }
  return cleaned;
}

/** True when Study body is a deck-building ask, not a study brief. */
export function looksLikeDeckRequestBrief(text: string): boolean {
  const brief = String(text || '').trim();
  if (!brief) return false;
  const folded = brief.toLowerCase();
  const markers = [
    'insight slide',
    'insight slides',
    'executive summary',
    'powerpoint',
    '.pptx',
    'client deck',
    'clear narrative',
    'appendix slide',
    'questionnaire appendix',
    'build a report',
    'build a deck',
    'build a presentation',
  ];
  if (markers.some(marker => folded.includes(marker))) return true;
  return /\b(10|fifteen|15)\s+to\s+(15|20)\b/i.test(brief) && /\bslide/i.test(brief);
}

function estimateTextHeightFraction(obj: ReportObject): number {
  const text = objectPlainTextForFit(obj);
  if (!text) return obj.frame.h;
  const sizePt = Math.max(8, Number(obj.textStyle.fontSizePt) || DEFAULT_TEXT_STYLE.fontSizePt);
  const lineSpacing = Math.max(
    1,
    Number(obj.textStyle.lineSpacing) || DEFAULT_TEXT_STYLE.lineSpacing
  );
  // Canvas objects pad 4px; subtract so wrap estimate matches what the browser paints.
  const widthIn = Math.max(0.4, obj.frame.w * PAGE_WIDTH_IN - 0.12);
  // Bold / display sizes wrap sooner; keep the estimate conservative so frames
  // reserve room rather than painting over the object below.
  const emWidth = obj.textStyle.bold || sizePt >= 18 ? 0.78 : 0.7;
  const charsPerLine = Math.max(14, Math.floor((widthIn * 72) / (sizePt * emWidth)));
  let lines = 0;
  for (const paragraph of text.split(/\n/) || [text]) {
    lines += Math.max(1, Math.ceil(Math.max(1, paragraph.length) / charsPerLine));
  }
  // Object padding + selection border + one spare line so the last glyph never
  // sits on the table question title below.
  const heightIn = ((lines + 0.35) * sizePt * lineSpacing) / 72 + 0.2;
  return Math.min(0.85, Math.max(obj.frame.h, heightIn / PAGE_HEIGHT_IN));
}

function objectPlainTextForFit(obj: ReportObject): string {
  if (obj.runs.length) return obj.runs.map(run => run.text).join('');
  return obj.text;
}

function framesOverlapHorizontally(a: ReportFrame, b: ReportFrame): boolean {
  return a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01;
}

function pushObjectsBelow(objects: ReportObject[], source: ReportObject, floorY: number): void {
  for (const other of objects) {
    if (other.id === source.id || other.hidden) continue;
    if (!framesOverlapHorizontally(source.frame, other.frame)) continue;
    if (other.frame.y + other.frame.h <= source.frame.y + 0.005) continue;
    if (other.frame.y >= floorY - 0.001) continue;
    // Prefer the reserved gap; shrink the pushed object if it would fall off-page.
    other.frame.y = Math.min(0.88, floorY);
    if (other.frame.y + other.frame.h > 0.96) {
      other.frame.h = Math.max(0.12, 0.96 - other.frame.y);
    }
  }
}

/**
 * Headline + chart must not keep a bare table. Prefer promoting the live grid to a
 * chart (insight decks); otherwise remount the page as Headline + table.
 */
function alignLayoutContentKinds(
  page: ReportDocument['pages'][number],
  objects: ReportObject[]
): string {
  const layout = String(page.layoutId || '').trim();
  if (layout !== 'title_and_content') return layout;
  const liveTables = objects.filter(
    obj => !obj.hidden && obj.kind === 'table' && String(obj.tableSpecId || '').trim()
  );
  const hasChart = objects.some(obj => !obj.hidden && obj.kind === 'chart');
  if (!liveTables.length || hasChart) return layout;
  // Insight section → chart on Headline + chart; everything else → Headline + table.
  const section = String(page.section || '')
    .trim()
    .toLowerCase();
  if (section === 'insights' || section === 'insight') {
    for (const obj of liveTables) {
      obj.kind = 'chart';
    }
    return layout;
  }
  return 'title_only';
}

function fitPageObjects(page: ReportDocument['pages'][number]): ReportDocument['pages'][number] {
  const hasLiveGrid = page.objects.some(
    obj => (obj.kind === 'table' || obj.kind === 'chart') && !obj.hidden
  );
  const section = String(page.section || '')
    .trim()
    .toLowerCase();
  const titleFolded = String(page.title || '')
    .trim()
    .toLowerCase();
  // Opening context page (legacy "Study" or Title section) — never show a deck ask.
  const isOpeningBrief =
    titleFolded === 'study' || section === 'title' || section === 'study' || section === 'context';
  let clearedDeckRequest = false;
  const objects = page.objects.map(obj => {
    const next = {
      ...obj,
      frame: { ...obj.frame },
      runs: obj.runs.map(run => ({ ...run })),
    };
    if (next.kind !== 'text' || next.hidden) return next;
    const plain = objectPlainTextForFit(next);
    // Opening page must never show the chat request that asked for the deck.
    if (isOpeningBrief && looksLikeDeckRequestBrief(plain)) {
      clearedDeckRequest = true;
      next.text = '';
      next.runs = [];
      next.hidden = true;
      return next;
    }
    // Insight / appendix commentary must not repeat the table Base footer.
    if (hasLiveGrid) {
      const cleaned = stripTrailingBaseFootnote(plain);
      if (cleaned !== plain.trim()) {
        next.text = cleaned;
        if (next.runs.length) {
          next.runs = [{ ...next.runs[0]!, text: cleaned }];
        }
      }
    }
    return next;
  });
  if (clearedDeckRequest) {
    // Drop a leftover bare "Study"/"Report" label when the brief was only the ask.
    for (const obj of objects) {
      if (obj.kind !== 'text' || obj.hidden) continue;
      const plain = objectPlainTextForFit(obj).trim().toLowerCase();
      if (!plain || plain === 'study' || plain === 'report') {
        obj.text = '';
        obj.runs = [];
        obj.hidden = true;
      }
    }
  }
  const layoutId = alignLayoutContentKinds(page, objects);
  // Two passes: expanding a title can push commentary, which then needs its own grow.
  for (let pass = 0; pass < 2; pass++) {
    const ordered = [...objects].sort(
      (a, b) => a.frame.y - b.frame.y || a.zIndex - b.zIndex || a.id.localeCompare(b.id)
    );
    for (const obj of ordered) {
      if (obj.kind !== 'text' || obj.hidden) continue;
      const needed = estimateTextHeightFraction(obj);
      if (needed > obj.frame.h + 0.002) {
        obj.frame.h = needed;
      }
      // Always keep a gap under text so wrapped lines never sit on the next frame.
      pushObjectsBelow(objects, obj, obj.frame.y + obj.frame.h + TEXT_STACK_GAP);
    }
  }
  const fitted = { ...page, layoutId, objects };
  if (!isOpeningBrief) return fitted;
  const hasVisibleText = objects.some(
    obj => obj.kind === 'text' && !obj.hidden && objectPlainTextForFit(obj).trim()
  );
  const hasLiveContent = objects.some(
    obj =>
      !obj.hidden &&
      (obj.kind === 'table' || obj.kind === 'chart') &&
      String(obj.tableSpecId || '').trim()
  );
  // Empty opening brief (chat request cleared, no study brief) — drop from view.
  if (!hasVisibleText && !hasLiveContent) {
    return { ...fitted, hideFromExport: true, hideFromPublish: true };
  }
  return fitted;
}

function isHiddenEmptyOpeningPage(page: ReportPage): boolean {
  const section = String(page.section || '')
    .trim()
    .toLowerCase();
  const titleFolded = String(page.title || '')
    .trim()
    .toLowerCase();
  const isOpening =
    titleFolded === 'study' || section === 'title' || section === 'study' || section === 'context';
  if (!isOpening) return false;
  if (!page.hideFromExport || !page.hideFromPublish) return false;
  const hasVisibleText = page.objects.some(
    obj => obj.kind === 'text' && !obj.hidden && objectPlainTextForFit(obj).trim()
  );
  return !hasVisibleText;
}

/** Expand clipped text frames on one page (first paint); other pages stay as stored. */
export function fitPageTextFrames(
  document: ReportDocument | unknown,
  pageId: string
): ReportDocument {
  const doc = normalizeReportDocument(document);
  return {
    ...doc,
    pages: doc.pages
      .map(page => (page.id === pageId ? fitPageObjects(page) : page))
      .filter(page => !isHiddenEmptyOpeningPage(page)),
  };
}

/** Expand clipped text frames and push overlapping objects down (report editor load). */
export function fitDocumentTextFrames(document: ReportDocument | unknown): ReportDocument {
  const doc = normalizeReportDocument(document);
  return {
    ...doc,
    pages: doc.pages.map(fitPageObjects).filter(page => !isHiddenEmptyOpeningPage(page)),
  };
}

export function pageNumberText(
  pageIndex: number,
  pageCount: number,
  template?: string | null
): string {
  const pattern = (template || DEFAULT_PAGE_NUMBER_TEMPLATE).trim() || DEFAULT_PAGE_NUMBER_TEMPLATE;
  const n = Math.max(1, Math.floor(pageIndex) + 1);
  const total = Math.max(n, Math.floor(pageCount));
  return pattern
    .replaceAll('{total}', String(total))
    .replaceAll('{n}', String(n))
    .replaceAll('{page}', String(n))
    .replaceAll('{count}', String(total));
}

function cellMatches(
  cell: Record<string, unknown>,
  rowKey: string | null,
  colKey: string | null
): boolean {
  const rowCandidates = [
    cell.stub_label,
    cell.stubLabel,
    cell.row_label,
    cell.rowLabel,
    cell.stub_row_id,
    cell.stubRowId,
    cell.row,
  ];
  const colCandidates = [
    cell.banner_label,
    cell.bannerLabel,
    cell.col_label,
    cell.colLabel,
    cell.banner_col_id,
    cell.bannerColId,
    cell.column,
    cell.col,
  ];
  const rowOk =
    !rowKey ||
    rowCandidates.some(
      item =>
        String(item || '')
          .trim()
          .toLowerCase() === rowKey.toLowerCase()
    );
  const colOk =
    !colKey ||
    colCandidates.some(
      item =>
        String(item || '')
          .trim()
          .toLowerCase() === colKey.toLowerCase()
    );
  return Boolean(rowOk && colOk);
}

export function cellValueText(
  source: unknown,
  options: { rowKey?: string | null; colKey?: string | null; stat?: string | null }
): string {
  if (!source || typeof source !== 'object') return '';
  const cells = (source as Record<string, unknown>).cells;
  if (!Array.isArray(cells)) return '';
  const wanted =
    String(options.stat || 'percent')
      .trim()
      .toLowerCase() || 'percent';
  const aliases: Record<string, string[]> = {
    percent: ['percent', 'column_percent', 'col_percent', '%'],
    count: ['count', 'n', 'unweighted_n', 'weighted_n'],
    weighted_n: ['weighted_n', 'weighted', 'n_weighted'],
    mean: ['mean', 'average'],
  };
  const keys = aliases[wanted] || [wanted];
  for (const raw of cells) {
    if (!raw || typeof raw !== 'object') continue;
    const cell = raw as Record<string, unknown>;
    if (!cellMatches(cell, options.rowKey || null, options.colKey || null)) continue;
    for (const key of keys) {
      if (cell[key] == null) continue;
      const value = cell[key];
      const number = Number(value);
      if (!Number.isFinite(number)) {
        const text = String(value).trim();
        return text;
      }
      if (wanted === 'percent' || wanted === '%') {
        const shown = number.toFixed(1).replace(/\.0$/, '');
        return `${shown}%`;
      }
      if (Math.abs(number - Math.round(number)) < 1e-9) {
        return Math.round(number).toLocaleString('en-GB');
      }
      return number.toFixed(2).replace(/\.?0+$/, '');
    }
  }
  return '';
}

export function sourceFingerprint(source: unknown): string {
  if (!source || typeof source !== 'object') return '';
  const book = source as Record<string, unknown>;
  const parts: string[] = [];
  const label = String(book.base_label || '').trim();
  if (label) parts.push(`base:${label}`);
  const weight =
    book.weight && typeof book.weight === 'object'
      ? (book.weight as Record<string, unknown>)
      : null;
  if (weight) {
    for (const key of ['weighted_n', 'unweighted_n', 'kish_effective_base', 'kish_ess'] as const) {
      if (weight[key] != null) parts.push(`${key}:${String(weight[key])}`);
    }
  }
  const cells = Array.isArray(book.cells) ? book.cells : [];
  for (const raw of cells.slice(0, 40)) {
    if (!raw || typeof raw !== 'object') continue;
    const cell = raw as Record<string, unknown>;
    parts.push(
      [cell.stub_label, cell.banner_label, cell.percent, cell.count, cell.weighted_n]
        .map(item => String(item ?? ''))
        .join('|')
    );
  }
  return parts.join(';');
}

function lookupLiveSource(
  binding: TextBinding,
  pageObjects: ReportObject[],
  sources: Record<string, unknown>
): unknown {
  const keys: string[] = [];
  for (const key of [binding.runId, binding.pinId, binding.tableSpecId, binding.sourceObjectId]) {
    if (key) keys.push(key);
  }
  if (binding.sourceObjectId) {
    const linked = pageObjects.find(obj => obj.id === binding.sourceObjectId);
    if (linked) {
      for (const key of [linked.runId, linked.pinId, linked.tableSpecId, linked.id]) {
        if (key) keys.push(key);
      }
    }
  }
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(sources, key)) return sources[key];
  }
  return undefined;
}

export function resolveBindingText(
  binding: TextBinding | null | undefined,
  options?: {
    source?: unknown;
    pageIndex?: number;
    pageCount?: number;
  }
): string {
  if (!binding) return '';
  if (binding.kind === 'page_number') {
    return pageNumberText(options?.pageIndex ?? 0, options?.pageCount ?? 1, binding.template);
  }
  if (binding.kind === 'sample_size') {
    return sampleSizeDescriptionText(options?.source);
  }
  if (binding.kind === 'cell') {
    const value = cellValueText(options?.source, {
      rowKey: binding.rowKey,
      colKey: binding.colKey,
      stat: binding.stat,
    });
    if (!value) return '';
    return `${binding.prefix || ''}${value}${binding.suffix || ''}`;
  }
  return '';
}

function textBindingForApi(binding: TextBinding | null): Record<string, unknown> | null {
  if (!binding) return null;
  return {
    kind: binding.kind,
    source_object_id: binding.sourceObjectId,
    run_id: binding.runId,
    pin_id: binding.pinId,
    table_spec_id: binding.tableSpecId,
    row_key: binding.rowKey,
    col_key: binding.colKey,
    stat: binding.stat,
    template: binding.template,
    prefix: binding.prefix,
    suffix: binding.suffix,
    stale: binding.stale,
    fingerprint: binding.fingerprint,
  };
}

export function normalizeTextRun(raw: unknown): TextRun | null {
  if (raw == null) return null;
  if (typeof raw !== 'object') {
    const text = String(raw);
    return text
      ? {
          text,
          bold: false,
          italic: false,
          underline: false,
          strikethrough: false,
          color: null,
          fontFamily: null,
          fontSizePt: null,
          href: null,
          binding: null,
        }
      : null;
  }
  const source = raw as Record<string, unknown>;
  const text = String(source.text || '');
  if (!text) return null;
  const hrefRaw = source.href ?? source.link ?? source.url;
  const href = hrefRaw ? String(hrefRaw).trim() || null : null;
  const sizeRaw = source.font_size_pt ?? source.fontSizePt ?? source.font_size ?? source.fontSize;
  let fontSizePt: number | null = null;
  if (sizeRaw != null) {
    const size = coercePositiveNumber(sizeRaw, 0, 0);
    fontSizePt = size > 0 ? size : null;
  }
  const fontRaw = source.font_family ?? source.fontFamily;
  const colorRaw = source.color ?? source.colour;
  return {
    text,
    bold: Boolean(source.bold),
    italic: Boolean(source.italic),
    underline: Boolean(source.underline),
    strikethrough: Boolean(
      source.strikethrough !== undefined ? source.strikethrough : source.strike
    ),
    color: colorRaw ? coerceHexColor(colorRaw, '') || null : null,
    fontFamily: fontRaw ? String(fontRaw).trim() || null : null,
    fontSizePt,
    href,
    binding: normalizeTextBinding(source.binding || source.live || source.dynamic),
  };
}

export function normalizeTextRuns(raw: unknown): TextRun[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeTextRun).filter((run): run is TextRun => Boolean(run));
}

export function textFromRuns(runs: TextRun[]): string {
  return runs.map(run => run.text).join('');
}

export function normalizeDefaultLabels(raw: unknown): DefaultLabels {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const net = String(source.net ?? source.NET ?? DEFAULT_LABELS.net).trim() || DEFAULT_LABELS.net;
  const total =
    String(source.total ?? source.Total ?? DEFAULT_LABELS.total).trim() || DEFAULT_LABELS.total;
  return { net, total };
}

export function applyDefaultLabels(label: unknown, defaults: unknown): string {
  const text = String(label || '');
  const labels = normalizeDefaultLabels(defaults);
  const stripped = text.trim();
  if (stripped.toUpperCase() === 'NET') return labels.net;
  if (stripped === 'Total') return labels.total;
  if (stripped.toUpperCase().startsWith('NET ') && labels.net !== 'NET') {
    return `${labels.net} ${stripped.slice(4)}`;
  }
  return text;
}

function normalizeObject(raw: unknown, layoutId: string): ReportObject | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const kind = String(source.kind || source.type || '')
    .trim()
    .toLowerCase() as ReportObjectKind;
  if (!OBJECT_KINDS.has(kind)) return null;
  const slotId = String(source.slot_id || source.slotId || '').trim() || null;
  let frame = normalizeFrame(source.frame || source.box);
  if (slotId && !(source.frame || source.box)) {
    const slotted = frameForSlot(layoutId, slotId);
    if (slotted) frame = slotted;
  }
  const nested =
    source.source && typeof source.source === 'object'
      ? (source.source as Record<string, unknown>)
      : {};
  const runId =
    String(source.run_id || source.runId || nested.run_id || nested.runId || '').trim() || null;
  const pinId =
    String(source.pin_id || source.pinId || nested.pin_id || nested.pinId || '').trim() || null;
  const tableSpecId =
    String(
      source.table_spec_id || source.tableSpecId || nested.table_spec_id || nested.tableSpecId || ''
    ).trim() || null;
  const shapeType =
    kind === 'shape'
      ? normalizeShapeType(source.shape_type || source.shapeType || source.shape) || 'rectangle'
      : null;
  const imageUrl =
    kind === 'image' ? String(source.image_url || source.imageUrl || '').trim() || null : null;
  const runs = normalizeTextRuns(source.runs || source.text_runs || source.textRuns);
  let text = String(source.text || '').trim();
  if (runs.length && !text) text = textFromRuns(runs).trim();
  const tableStyle = normalizeTableStyle(source.table_style || source.tableStyle);
  const tableRules = normalizeTableRules(source.table_rules || source.tableRules || source.rules);
  const tableEdits = normalizeTableEdits(source.table_edits || source.tableEdits || source.edits);
  const binding = normalizeTextBinding(source.binding || source.live || source.dynamic);
  return {
    id: String(source.id || '').trim() || newId('obj'),
    kind,
    frame,
    zIndex: Number.isFinite(Number(source.z_index ?? source.zIndex))
      ? Number(source.z_index ?? source.zIndex)
      : 0,
    hidden: Boolean(source.hidden),
    slotId,
    text,
    textStyle: normalizeTextStyle(source.text_style || source.textStyle || source.style),
    runs,
    binding,
    shapeType,
    imageUrl,
    runId,
    pinId,
    tableSpecId,
    tableStyle: kind === 'table' ? tableStyle : normalizeTableStyle({}),
    tableRules: kind === 'table' ? tableRules : [],
    tableEdits: kind === 'table' ? tableEdits : normalizeTableEdits({}),
    keepLive: source.keep_live !== false && source.keepLive !== false,
  };
}

function normalizePage(raw: unknown): ReportPage | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  let layoutId = String(source.layout_id || source.layoutId || 'title_and_content').trim();
  if (!getPageLayout(layoutId)) layoutId = 'title_and_content';
  const objects = (
    Array.isArray(source.objects) ? source.objects : Array.isArray(source.items) ? source.items : []
  )
    .map(item => normalizeObject(item, layoutId))
    .filter((item): item is ReportObject => Boolean(item))
    .sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id));
  let title = String(source.title || '').trim();
  if (!title) {
    const text = objects.find(item => item.kind === 'text' && item.text);
    title = text?.text || 'Untitled page';
  }
  return {
    id: String(source.id || '').trim() || newId('page'),
    title,
    layoutId,
    section: String(source.section || '').trim() || null,
    objects,
    hideFromExport: Boolean(source.hide_from_export ?? source.hideFromExport),
    hideFromPublish: Boolean(source.hide_from_publish ?? source.hideFromPublish),
  };
}

function normalizeSavedPageTemplate(raw: unknown): SavedPageTemplate | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const template = pageAsTemplate(source);
  const name =
    String(source.name || source.label || template.title || '').trim() || 'Page template';
  return {
    ...template,
    id: String(source.id || '').trim() || newId('tpl'),
    name,
  };
}

/** Remint colliding page / object ids so React list keys stay unique. */
function ensureUniquePageIds(pages: ReportPage[]): ReportPage[] {
  const seenPages = new Set<string>();
  return pages.map(page => {
    let pageId = String(page.id || '').trim() || newId('page');
    if (seenPages.has(pageId)) pageId = newId('page');
    seenPages.add(pageId);
    const seenObjects = new Set<string>();
    const objects = page.objects.map(obj => {
      let objectId = String(obj.id || '').trim() || newId('obj');
      if (seenObjects.has(objectId)) objectId = newId('obj');
      seenObjects.add(objectId);
      return { ...obj, id: objectId };
    });
    return { ...page, id: pageId, objects };
  });
}

export function normalizeReportDocument(raw: unknown): ReportDocument {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const pages = ensureUniquePageIds(
    (Array.isArray(source.pages) ? source.pages : [])
      .map(normalizePage)
      .filter((page): page is ReportPage => Boolean(page))
  );
  const templatesRaw = source.page_templates ?? source.pageTemplates ?? [];
  const pageTemplates = (Array.isArray(templatesRaw) ? templatesRaw : [])
    .map(normalizeSavedPageTemplate)
    .filter((item): item is SavedPageTemplate => Boolean(item));
  return {
    pageWidthIn: PAGE_WIDTH_IN,
    pageHeightIn: PAGE_HEIGHT_IN,
    aspect: PAGE_ASPECT,
    defaultLabels: normalizeDefaultLabels(source.default_labels || source.defaultLabels),
    theme: normalizeReportTheme(source.theme ?? source.reportTheme ?? source.report_theme),
    pageTemplates,
    pages,
  };
}

export function setDocumentTheme(
  document: ReportDocument | unknown,
  theme: ReportTheme | unknown
): ReportDocument {
  const doc = normalizeReportDocument(document);
  return { ...doc, theme: normalizeReportTheme(theme) };
}

export function savePageAsTemplate(
  document: ReportDocument | unknown,
  pageId: string,
  name?: string
): ReportDocument {
  const doc = normalizeReportDocument(document);
  const page = doc.pages.find(item => item.id === String(pageId));
  if (!page) return doc;
  const template = pageAsTemplate(page);
  const label = String(name || page.title || '').trim() || 'Page template';
  const saved: SavedPageTemplate = {
    ...template,
    id: newId('tpl'),
    name: label,
    title: label,
  };
  return { ...doc, pageTemplates: [...doc.pageTemplates, saved] };
}

const BASE_CHART_LABEL =
  /^(weighted\s+base|unweighted\s+base|effective\s+base(?:\s*\(kish\))?|base\s*\(n\)|base\s*:?|deff|kish(?:\s+effective(?:\s+(?:base|n))?)?)$/i;

function isBaseChartLabel(label: string): boolean {
  return BASE_CHART_LABEL.test(label.trim());
}

function sanitizePinBars(bars: PinLike['bars']): {
  chartBars: { label: string; percent: number }[];
  baseFooter: string;
} {
  const chartBars: { label: string; percent: number }[] = [];
  const footerParts: string[] = [];
  for (const bar of bars || []) {
    const label = String(bar?.label || '').trim();
    if (!label) continue;
    const percent = Number(bar?.percent);
    if (!Number.isFinite(percent)) continue;
    if (isBaseChartLabel(label)) {
      const shown =
        Math.abs(percent) >= 1000 || Math.abs(percent - Math.round(percent)) < 1e-9
          ? Math.round(percent).toLocaleString('en-GB')
          : percent.toLocaleString('en-GB', {
              minimumFractionDigits: Math.abs(percent) < 10 ? 2 : 1,
              maximumFractionDigits: Math.abs(percent) < 10 ? 2 : 1,
            });
      footerParts.push(`${label} ${shown}`);
      continue;
    }
    chartBars.push({ label, percent: Math.round(percent * 10) / 10 });
  }
  return { chartBars, baseFooter: footerParts.join(' · ') };
}

export type PinLike = {
  id?: string;
  runId?: string;
  run_id?: string;
  headline?: string;
  title?: string;
  support?: string;
  bars?: { label?: string; percent?: number }[];
  baseFooter?: string;
  base_footer?: string;
  deck?: boolean;
  keepLive?: boolean;
  keep_live?: boolean;
  afterId?: string;
  after_id?: string;
};

/** Chart when the pin has share bars; otherwise a live table for a run; else finding text. */
export function pinPagePlan(pin: PinLike): {
  layoutId: string;
  contentKind: ReportObjectKind;
  contentText: string;
} {
  const support = String(pin.support || '').trim();
  const { chartBars } = sanitizePinBars(pin.bars);
  const hasChart = chartBars.length > 0;
  const runId = String(pin.run_id || pin.runId || '').trim();
  if (hasChart) {
    return { layoutId: 'title_and_content', contentKind: 'chart', contentText: '' };
  }
  if (runId) {
    // Headline + table — the editor loads this run's table, not another finding's prose.
    return { layoutId: 'title_only', contentKind: 'table', contentText: '' };
  }
  return { layoutId: 'title_and_content', contentKind: 'text', contentText: support };
}

function pinObjectShell(
  pin: PinLike,
  options: {
    kind: ReportObjectKind;
    slotId: string | null;
    layoutId: string;
    text: string;
    zIndex: number;
    frame?: { x: number; y: number; w: number; h: number };
    textStyle?: Partial<typeof DEFAULT_TEXT_STYLE>;
  }
): ReportObject {
  const pinId = String(pin.id || '').trim() || newId('pin');
  const runId = String(pin.run_id || pin.runId || '').trim() || null;
  const keepLive = pin.keep_live !== false && pin.keepLive !== false;
  const frame =
    options.frame ||
    (options.slotId ? frameForSlot(options.layoutId, options.slotId) : null) ||
    normalizeFrame(null);
  return {
    id: newId('obj'),
    kind: options.kind,
    slotId: options.slotId,
    frame,
    zIndex: options.zIndex,
    hidden: false,
    text: options.text,
    textStyle: {
      ...DEFAULT_TEXT_STYLE,
      ...(options.slotId === 'title' ? { fontSizePt: 28, bold: true } : {}),
      ...(options.textStyle || {}),
    },
    runs: [],
    binding: null,
    shapeType: null,
    imageUrl: null,
    runId,
    pinId,
    tableSpecId: null,
    tableStyle: normalizeTableStyle({}),
    tableRules: [],
    tableEdits: normalizeTableEdits({}),
    keepLive,
  };
}

/** One slide for a report pin: finding on the title, chart/table/finding body in content. */
export function pageFromPin(pin: PinLike, options?: { pageId?: string }): ReportPage | null {
  const headline = String(pin.headline || pin.title || '').trim();
  if (!headline) return null;
  const plan = pinPagePlan(pin);
  const { baseFooter: fromBars } = sanitizePinBars(pin.bars);
  const baseFooter = fromBars || String(pin.baseFooter || pin.base_footer || '').trim();
  const content = pinObjectShell(pin, {
    kind: plan.contentKind,
    slotId: 'content',
    layoutId: plan.layoutId,
    text: plan.contentText,
    zIndex: 2,
  });
  const objects = [
    pinObjectShell(pin, {
      kind: 'text',
      slotId: 'title',
      layoutId: plan.layoutId,
      text: headline,
      zIndex: 1,
    }),
    content,
  ];
  if (plan.contentKind === 'chart' && baseFooter) {
    content.frame = {
      ...content.frame,
      h: Math.max(0.12, content.frame.h - 0.1),
    };
    objects.push(
      pinObjectShell(pin, {
        kind: 'text',
        slotId: null,
        layoutId: plan.layoutId,
        text: baseFooter,
        zIndex: 3,
        frame: { x: 0.06, y: 0.88, w: 0.88, h: 0.08 },
        textStyle: { fontSizePt: 12, color: '#6A6B66' },
      })
    );
  }
  return {
    id: options?.pageId || newId('page'),
    title: headline,
    layoutId: plan.layoutId,
    section: null,
    hideFromExport: pin.deck === false,
    hideFromPublish: false,
    objects,
  };
}

/** Page index whose objects reference this pin's run or pin id. */
export function findPageIndexForPin(document: ReportDocument | unknown, pin: PinLike): number {
  const doc = normalizeReportDocument(document);
  const runId = String(pin.run_id || pin.runId || '').trim();
  const pinId = String(pin.id || '').trim();
  if (!runId && !pinId) return -1;
  return doc.pages.findIndex(page =>
    page.objects.some(obj => (runId && obj.runId === runId) || (pinId && obj.pinId === pinId))
  );
}

/**
 * Insert or refresh the slide for a pin without dropping the rest of the deck.
 * Keeps the existing page id so deep links stay stable.
 */
export function upsertPinPage(
  document: ReportDocument | unknown,
  pin: PinLike
): { document: ReportDocument; pageId: string } {
  const doc = normalizeReportDocument(document);
  const existingIndex = findPageIndexForPin(doc, pin);
  const keptId = existingIndex >= 0 ? doc.pages[existingIndex]?.id : undefined;
  const page = pageFromPin(pin, { pageId: keptId });
  if (!page) {
    return { document: doc, pageId: keptId || '' };
  }
  if (existingIndex >= 0) {
    const pages = doc.pages.map((item, index) => (index === existingIndex ? page : item));
    return { document: { ...doc, pages }, pageId: page.id };
  }
  const afterId = String(pin.after_id || pin.afterId || '').trim();
  const pages = [...doc.pages];
  if (afterId && afterId !== 'end' && afterId !== 'start') {
    const afterIndex = pages.findIndex(
      item =>
        item.id === afterId ||
        item.objects.some(obj => obj.pinId === afterId || obj.runId === afterId)
    );
    if (afterIndex >= 0) {
      pages.splice(afterIndex + 1, 0, page);
      return { document: { ...doc, pages }, pageId: page.id };
    }
  }
  if (afterId === 'start') {
    pages.unshift(page);
    return { document: { ...doc, pages }, pageId: page.id };
  }
  pages.push(page);
  return { document: { ...doc, pages }, pageId: page.id };
}

/** Each report pin becomes one live page (chart, table, or finding text). */
export function documentFromPins(pins: PinLike[]): ReportDocument {
  const pages: ReportPage[] = [];
  for (const pin of pins || []) {
    const page = pageFromPin(pin);
    if (page) pages.push(page);
  }
  return normalizeReportDocument({ pages });
}

export function pagesForExport(document: ReportDocument | unknown): ReportPage[] {
  return normalizeReportDocument(document).pages.filter(page => !page.hideFromExport);
}

export function pagesForPublish(document: ReportDocument | unknown): ReportPage[] {
  return normalizeReportDocument(document).pages.filter(page => !page.hideFromPublish);
}

export function reorderPages(
  document: ReportDocument | unknown,
  pageIds: string[]
): ReportDocument {
  const doc = normalizeReportDocument(document);
  const byId = new Map(doc.pages.map(page => [page.id, page]));
  const ordered: ReportPage[] = [];
  const seen = new Set<string>();
  for (const pageId of pageIds) {
    const page = byId.get(String(pageId));
    if (!page || seen.has(page.id)) continue;
    ordered.push(page);
    seen.add(page.id);
  }
  for (const page of doc.pages) {
    if (!seen.has(page.id)) ordered.push(page);
  }
  return { ...doc, pages: ordered };
}

export function duplicatePage(document: ReportDocument | unknown, pageId: string): ReportDocument {
  const doc = normalizeReportDocument(document);
  const pages = [...doc.pages];
  const index = pages.findIndex(page => page.id === String(pageId));
  if (index < 0) return doc;
  const page = pages[index];
  if (!page) return doc;
  const clone: ReportPage = {
    ...page,
    id: newId('page'),
    title: `${page.title} (copy)`,
    objects: page.objects.map(obj => ({ ...obj, id: newId('obj'), frame: { ...obj.frame } })),
  };
  pages.splice(index + 1, 0, clone);
  return { ...doc, pages };
}

export function setPageHidden(
  document: ReportDocument | unknown,
  pageId: string,
  flags: { hideFromExport?: boolean; hideFromPublish?: boolean }
): ReportDocument {
  const doc = normalizeReportDocument(document);
  return {
    ...doc,
    pages: doc.pages.map(page => {
      if (page.id !== String(pageId)) return page;
      return {
        ...page,
        hideFromExport:
          flags.hideFromExport === undefined ? page.hideFromExport : Boolean(flags.hideFromExport),
        hideFromPublish:
          flags.hideFromPublish === undefined
            ? page.hideFromPublish
            : Boolean(flags.hideFromPublish),
      };
    }),
  };
}

export function groupPagesIntoSection(
  document: ReportDocument | unknown,
  pageIds: string[],
  section: string
): ReportDocument {
  const doc = normalizeReportDocument(document);
  const wanted = new Set(pageIds.map(String));
  const label = String(section || '').trim() || null;
  return {
    ...doc,
    pages: doc.pages.map(page => (wanted.has(page.id) ? { ...page, section: label } : page)),
  };
}

export function moveObject(
  document: ReportDocument | unknown,
  pageId: string,
  objectId: string,
  frame: Partial<ReportFrame>,
  options?: { snap?: boolean; gridStep?: number }
): ReportDocument {
  const doc = normalizeReportDocument(document);
  return {
    ...doc,
    pages: doc.pages.map(page => {
      if (page.id !== String(pageId)) return page;
      return {
        ...page,
        objects: page.objects.map(obj => {
          if (obj.id !== String(objectId)) return obj;
          let box = normalizeFrame(frame);
          if (options?.snap) {
            box = snapFrameToGrid(box, { step: options.gridStep, enabled: true });
          }
          return { ...obj, frame: box, slotId: null };
        }),
      };
    }),
  };
}

export function resizeObject(
  document: ReportDocument | unknown,
  pageId: string,
  objectId: string,
  size: { width?: number; height?: number },
  options?: { snap?: boolean; gridStep?: number }
): ReportDocument {
  const doc = normalizeReportDocument(document);
  return {
    ...doc,
    pages: doc.pages.map(page => {
      if (page.id !== String(pageId)) return page;
      return {
        ...page,
        objects: page.objects.map(obj => {
          if (obj.id !== String(objectId)) return obj;
          const next = { ...obj.frame };
          if (size.width !== undefined) next.w = size.width;
          if (size.height !== undefined) next.h = size.height;
          let box = normalizeFrame(next);
          if (options?.snap) {
            box = snapFrameToGrid(box, { step: options.gridStep, enabled: true });
          }
          return { ...obj, frame: box, slotId: null };
        }),
      };
    }),
  };
}

function isEmptySlotPlaceholder(obj: ReportObject): boolean {
  if (obj.runId || obj.pinId || obj.tableSpecId) return false;
  if (obj.kind === 'chart' || obj.kind === 'table') return true;
  if (obj.kind !== 'text') return false;
  const text = String(obj.text || '').trim();
  return !text || text === 'Headline' || text === 'Subtitle' || text === 'Add commentary';
}

export function placeObjectInSlot(
  document: ReportDocument | unknown,
  pageId: string,
  objectId: string,
  slotId: string
): ReportDocument {
  const doc = normalizeReportDocument(document);
  const wantedSlot = String(slotId).trim();
  return {
    ...doc,
    pages: doc.pages.map(page => {
      if (page.id !== String(pageId)) return page;
      const box = frameForSlot(page.layoutId, wantedSlot);
      if (!box) {
        throw new Error(`Unknown slot ${wantedSlot} for layout ${page.layoutId}.`);
      }
      const objects = page.objects
        .filter(obj => {
          if (obj.id === String(objectId)) return true;
          if (obj.slotId !== wantedSlot) return true;
          // Drop empty placeholders so the slot holds one real object.
          return !isEmptySlotPlaceholder(obj);
        })
        .map(obj => {
          if (obj.id === String(objectId)) {
            return { ...obj, slotId: wantedSlot, frame: box };
          }
          if (obj.slotId === wantedSlot) {
            return { ...obj, slotId: null };
          }
          return obj;
        });
      return { ...page, objects };
    }),
  };
}

export function setPageLayout(
  document: ReportDocument | unknown,
  pageId: string,
  layoutId: string
): ReportDocument {
  const doc = normalizeReportDocument(document);
  const layout = String(layoutId || '').trim() || 'blank';
  if (!getPageLayout(layout)) {
    throw new Error(`Unknown page layout ${layout}.`);
  }
  return {
    ...doc,
    pages: doc.pages.map(page => {
      if (page.id !== String(pageId)) return page;
      const remounted: ReportObject[] = [];
      for (const obj of page.objects) {
        const slot = obj.slotId ? String(obj.slotId).trim() : null;
        if (!slot) {
          remounted.push(obj);
          continue;
        }
        const box = frameForSlot(layout, slot);
        if (box) {
          remounted.push({ ...obj, frame: box });
          continue;
        }
        // Drop empty placeholders that no longer belong on this master.
        if (isEmptySlotPlaceholder(obj)) continue;
        remounted.push({ ...obj, slotId: null });
      }
      const occupied = remounted
        .map(obj => obj.slotId)
        .filter((slot): slot is string => Boolean(slot));
      const fillers = placeholderObjectsForLayout(layout, {
        title: page.title,
        occupiedSlotIds: occupied,
      });
      const topZ = remounted.reduce((max, obj) => Math.max(max, obj.zIndex), 0);
      const seeded = fillers.map((obj, index) => ({ ...obj, zIndex: topZ + index + 1 }));
      return {
        ...page,
        layoutId: layout,
        objects: [...remounted, ...seeded].sort(
          (a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id)
        ),
      };
    }),
  };
}

export type PageTemplate = {
  kind: 'page';
  layoutId: string;
  title: string | null;
  section: string | null;
  objects: Array<Record<string, unknown>>;
};

export type StyleTemplate = {
  kind: 'chart' | 'table';
  tableStyle?: TableStyle;
  tableRules?: TableRule[];
  textStyle?: TextBoxStyle;
  frame?: ReportFrame;
};

export function pageAsTemplate(page: ReportPage | unknown): PageTemplate {
  const source = page && typeof page === 'object' ? (page as Record<string, unknown>) : {};
  let layoutId = String(source.layout_id || source.layoutId || 'blank').trim() || 'blank';
  if (!getPageLayout(layoutId)) layoutId = 'title_and_content';
  const rawObjects = Array.isArray(source.objects) ? source.objects : [];
  const objects: Array<Record<string, unknown>> = [];
  for (const item of rawObjects) {
    const obj = normalizeObject(item, layoutId);
    if (!obj) continue;
    objects.push({
      kind: obj.kind,
      frame: { ...obj.frame },
      zIndex: obj.zIndex,
      hidden: obj.hidden,
      slotId: obj.slotId,
      text: obj.text,
      textStyle: { ...obj.textStyle },
      runs: obj.runs.map(run => ({ ...run })),
      shapeType: obj.shapeType,
      imageUrl: obj.imageUrl,
      tableStyle: { ...obj.tableStyle },
      tableRules: obj.tableRules.map(rule => ({ ...rule })),
      tableEdits: {
        ...obj.tableEdits,
        renames: { ...obj.tableEdits.renames },
        hiddenRowIds: [...obj.tableEdits.hiddenRowIds],
        hiddenColumnIds: [...obj.tableEdits.hiddenColumnIds],
        rowOrder: [...obj.tableEdits.rowOrder],
        merges: obj.tableEdits.merges.map(merge => ({ ...merge, rowIds: [...merge.rowIds] })),
      },
      keepLive: false,
    });
  }
  return {
    kind: 'page',
    layoutId,
    title: String(source.title || '').trim() || null,
    section: String(source.section || '').trim() || null,
    objects,
  };
}

export function applyPageTemplate(
  document: ReportDocument | unknown,
  template: PageTemplate | Record<string, unknown>,
  options?: { title?: string; afterPageId?: string }
): ReportDocument {
  const before = normalizeReportDocument(document);
  const beforeIds = new Set(before.pages.map(page => page.id));
  const bag = template && typeof template === 'object' ? (template as Record<string, unknown>) : {};
  let layoutId = String(bag.layout_id || bag.layoutId || 'blank').trim() || 'blank';
  if (!getPageLayout(layoutId)) layoutId = 'title_and_content';
  const title =
    options?.title !== undefined
      ? String(options.title).trim() || 'Untitled page'
      : String(bag.title || '').trim() || 'Untitled page';
  const withPage = addPage(before, {
    title,
    layoutId,
    section: bag.section ? String(bag.section).trim() || null : null,
    afterPageId: options?.afterPageId,
  });
  const created =
    withPage.pages.find(page => !beforeIds.has(page.id)) ||
    withPage.pages[withPage.pages.length - 1];
  if (!created) return withPage;
  const objects: ReportObject[] = [];
  const rawObjects = Array.isArray(bag.objects) ? bag.objects : [];
  for (const item of rawObjects) {
    if (!item || typeof item !== 'object') continue;
    const payload = { ...(item as Record<string, unknown>) };
    delete payload.id;
    delete payload.run_id;
    delete payload.runId;
    delete payload.pin_id;
    delete payload.pinId;
    delete payload.table_spec_id;
    delete payload.tableSpecId;
    payload.keepLive = false;
    const obj = normalizeObject(payload, layoutId);
    if (obj) objects.push(obj);
  }
  return {
    ...withPage,
    pages: withPage.pages.map(page => (page.id === created.id ? { ...page, objects } : page)),
  };
}

export function objectAsStyleTemplate(obj: ReportObject | unknown): StyleTemplate {
  const source = obj && typeof obj === 'object' ? (obj as Record<string, unknown>) : {};
  const kind = String(source.kind || source.type || '')
    .trim()
    .toLowerCase();
  if (kind !== 'chart' && kind !== 'table') {
    throw new Error('Only chart or table objects can be saved as a style template.');
  }
  const normalised = normalizeObject(source, 'blank');
  if (!normalised) {
    throw new Error('Object could not be normalised as a style template.');
  }
  if (kind === 'table') {
    return {
      kind: 'table',
      tableStyle: { ...normalised.tableStyle },
      tableRules: normalised.tableRules.map(rule => ({ ...rule })),
    };
  }
  return {
    kind: 'chart',
    textStyle: { ...normalised.textStyle },
    frame: { ...normalised.frame },
  };
}

export function bringObjectForward(
  document: ReportDocument | unknown,
  pageId: string,
  objectId: string
): ReportDocument {
  return nudgeZ(document, pageId, objectId, 1);
}

export function sendObjectBackward(
  document: ReportDocument | unknown,
  pageId: string,
  objectId: string
): ReportDocument {
  return nudgeZ(document, pageId, objectId, -1);
}

export function bringToFront(
  document: ReportDocument | unknown,
  pageId: string,
  objectId: string
): ReportDocument {
  const doc = normalizeReportDocument(document);
  return {
    ...doc,
    pages: doc.pages.map(page => {
      if (page.id !== String(pageId)) return page;
      const top = page.objects.reduce((max, obj) => Math.max(max, obj.zIndex), 0);
      const objects = page.objects
        .map(obj => (obj.id === String(objectId) ? { ...obj, zIndex: top + 1 } : obj))
        .sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id));
      return { ...page, objects };
    }),
  };
}

export function sendToBack(
  document: ReportDocument | unknown,
  pageId: string,
  objectId: string
): ReportDocument {
  const doc = normalizeReportDocument(document);
  return {
    ...doc,
    pages: doc.pages.map(page => {
      if (page.id !== String(pageId)) return page;
      const bottom = page.objects.reduce((min, obj) => Math.min(min, obj.zIndex), 0);
      const objects = page.objects
        .map(obj => (obj.id === String(objectId) ? { ...obj, zIndex: bottom - 1 } : obj))
        .sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id));
      return { ...page, objects };
    }),
  };
}

function nudgeZ(
  document: ReportDocument | unknown,
  pageId: string,
  objectId: string,
  delta: number
): ReportDocument {
  const doc = normalizeReportDocument(document);
  return {
    ...doc,
    pages: doc.pages.map(page => {
      if (page.id !== String(pageId)) return page;
      const objects = page.objects
        .map(obj => (obj.id === String(objectId) ? { ...obj, zIndex: obj.zIndex + delta } : obj))
        .sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id));
      return { ...page, objects };
    }),
  };
}

function pageObjectsById(page: ReportPage, objectIds: string[]): ReportObject[] {
  const byId = new Map(page.objects.map(obj => [obj.id, obj]));
  return objectIds.map(String).flatMap(id => {
    const found = byId.get(id);
    return found ? [found] : [];
  });
}

export function alignObjects(
  document: ReportDocument | unknown,
  pageId: string,
  objectIds: string[],
  edge: AlignEdge
): ReportDocument {
  if (!ALIGN_EDGES.has(edge)) {
    throw new Error(`Unknown align edge ${edge}.`);
  }
  const doc = normalizeReportDocument(document);
  return {
    ...doc,
    pages: doc.pages.map(page => {
      if (page.id !== String(pageId)) return page;
      const selected = pageObjectsById(page, objectIds);
      if (selected.length < 2) return page;
      const frames = selected.map(obj => obj.frame);
      const nextById = new Map<string, ReportFrame>();
      if (edge === 'left') {
        const target = Math.min(...frames.map(frame => frame.x));
        for (const obj of selected) nextById.set(obj.id, { ...obj.frame, x: target });
      } else if (edge === 'right') {
        const target = Math.max(...frames.map(frame => frame.x + frame.w));
        for (const obj of selected) {
          nextById.set(obj.id, { ...obj.frame, x: clamp01(target - obj.frame.w, 0) });
        }
      } else if (edge === 'center') {
        const left = Math.min(...frames.map(frame => frame.x));
        const right = Math.max(...frames.map(frame => frame.x + frame.w));
        const mid = (left + right) / 2;
        for (const obj of selected) {
          nextById.set(obj.id, { ...obj.frame, x: clamp01(mid - obj.frame.w / 2, 0) });
        }
      } else if (edge === 'top') {
        const target = Math.min(...frames.map(frame => frame.y));
        for (const obj of selected) nextById.set(obj.id, { ...obj.frame, y: target });
      } else if (edge === 'bottom') {
        const target = Math.max(...frames.map(frame => frame.y + frame.h));
        for (const obj of selected) {
          nextById.set(obj.id, { ...obj.frame, y: clamp01(target - obj.frame.h, 0) });
        }
      } else {
        const top = Math.min(...frames.map(frame => frame.y));
        const bottom = Math.max(...frames.map(frame => frame.y + frame.h));
        const mid = (top + bottom) / 2;
        for (const obj of selected) {
          nextById.set(obj.id, { ...obj.frame, y: clamp01(mid - obj.frame.h / 2, 0) });
        }
      }
      return {
        ...page,
        objects: page.objects.map(obj => {
          const frame = nextById.get(obj.id);
          return frame ? { ...obj, frame, slotId: null } : obj;
        }),
      };
    }),
  };
}

export function distributeObjects(
  document: ReportDocument | unknown,
  pageId: string,
  objectIds: string[],
  axis: DistributeAxis
): ReportDocument {
  if (!DISTRIBUTE_AXES.has(axis)) {
    throw new Error(`Unknown distribute axis ${axis}.`);
  }
  const doc = normalizeReportDocument(document);
  return {
    ...doc,
    pages: doc.pages.map(page => {
      if (page.id !== String(pageId)) return page;
      const selected = pageObjectsById(page, objectIds);
      if (selected.length < 3) return page;
      const nextById = new Map<string, ReportFrame>();
      if (axis === 'horizontal') {
        const ordered = [...selected].sort((a, b) => a.frame.x - b.frame.x);
        const first = ordered[0]!.frame;
        const last = ordered[ordered.length - 1]!.frame;
        const span = last.x + last.w - first.x;
        const totalW = ordered.reduce((sum, obj) => sum + obj.frame.w, 0);
        const gap = (span - totalW) / (ordered.length - 1);
        let cursor = first.x;
        for (const obj of ordered) {
          nextById.set(obj.id, { ...obj.frame, x: clamp01(cursor, 0) });
          cursor += obj.frame.w + gap;
        }
      } else {
        const ordered = [...selected].sort((a, b) => a.frame.y - b.frame.y);
        const first = ordered[0]!.frame;
        const last = ordered[ordered.length - 1]!.frame;
        const span = last.y + last.h - first.y;
        const totalH = ordered.reduce((sum, obj) => sum + obj.frame.h, 0);
        const gap = (span - totalH) / (ordered.length - 1);
        let cursor = first.y;
        for (const obj of ordered) {
          nextById.set(obj.id, { ...obj.frame, y: clamp01(cursor, 0) });
          cursor += obj.frame.h + gap;
        }
      }
      return {
        ...page,
        objects: page.objects.map(obj => {
          const frame = nextById.get(obj.id);
          return frame ? { ...obj, frame, slotId: null } : obj;
        }),
      };
    }),
  };
}

export function duplicateObject(
  document: ReportDocument | unknown,
  pageId: string,
  objectId: string,
  offset = 0.02
): ReportDocument {
  const doc = normalizeReportDocument(document);
  const shift = Number.isFinite(offset) ? offset : 0.02;
  return {
    ...doc,
    pages: doc.pages.map(page => {
      if (page.id !== String(pageId)) return page;
      const index = page.objects.findIndex(obj => obj.id === String(objectId));
      if (index < 0) return page;
      const obj = page.objects[index]!;
      const clone: ReportObject = {
        ...obj,
        id: newId('obj'),
        slotId: null,
        frame: normalizeFrame({
          x: obj.frame.x + shift,
          y: obj.frame.y + shift,
          w: obj.frame.w,
          h: obj.frame.h,
        }),
        zIndex: obj.zIndex + 1,
      };
      const objects = [...page.objects];
      objects.splice(index + 1, 0, clone);
      objects.sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id));
      return { ...page, objects };
    }),
  };
}

export function deleteObject(
  document: ReportDocument | unknown,
  pageId: string,
  objectId: string
): ReportDocument {
  const doc = normalizeReportDocument(document);
  return {
    ...doc,
    pages: doc.pages.map(page => {
      if (page.id !== String(pageId)) return page;
      return {
        ...page,
        objects: page.objects.filter(obj => obj.id !== String(objectId)),
      };
    }),
  };
}

export function setObjectHidden(
  document: ReportDocument | unknown,
  pageId: string,
  objectId: string,
  hidden: boolean
): ReportDocument {
  const doc = normalizeReportDocument(document);
  return {
    ...doc,
    pages: doc.pages.map(page => {
      if (page.id !== String(pageId)) return page;
      return {
        ...page,
        objects: page.objects.map(obj =>
          obj.id === String(objectId) ? { ...obj, hidden: Boolean(hidden) } : obj
        ),
      };
    }),
  };
}

export function insertObject(
  document: ReportDocument | unknown,
  pageId: string,
  rawObject: Record<string, unknown>
): ReportDocument {
  const doc = normalizeReportDocument(document);
  return {
    ...doc,
    pages: doc.pages.map(page => {
      if (page.id !== String(pageId)) return page;
      const obj = normalizeObject(rawObject, page.layoutId);
      if (!obj) throw new Error('Unsupported object for insert.');
      const top = page.objects.reduce((max, item) => Math.max(max, item.zIndex), 0);
      if (rawObject.z_index === undefined && rawObject.zIndex === undefined) {
        obj.zIndex = top + 1;
      }
      const objects = [...page.objects, obj].sort(
        (a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id)
      );
      return { ...page, objects };
    }),
  };
}

export function insertShape(
  document: ReportDocument | unknown,
  pageId: string,
  options?: { shapeType?: string; frame?: Partial<ReportFrame>; text?: string }
): ReportDocument {
  const shapeType = normalizeShapeType(options?.shapeType) || 'rectangle';
  return insertObject(document, pageId, {
    kind: 'shape',
    shape_type: shapeType,
    frame: options?.frame || { x: 0.35, y: 0.35, w: 0.3, h: 0.2 },
    text: options?.text || '',
  });
}

export function insertImage(
  document: ReportDocument | unknown,
  pageId: string,
  options: { imageUrl: string; frame?: Partial<ReportFrame> }
): ReportDocument {
  const imageUrl = String(options.imageUrl || '').trim();
  if (!imageUrl) throw new Error('imageUrl is required.');
  return insertObject(document, pageId, {
    kind: 'image',
    image_url: imageUrl,
    frame: options.frame || { x: 0.25, y: 0.25, w: 0.5, h: 0.4 },
  });
}

export function insertTextBox(
  document: ReportDocument | unknown,
  pageId: string,
  options?: {
    text?: string;
    frame?: Partial<ReportFrame>;
    textStyle?: Partial<TextBoxStyle> | Record<string, unknown>;
    runs?: unknown[];
    binding?: Partial<TextBinding> | Record<string, unknown> | null;
  }
): ReportDocument {
  const payload: Record<string, unknown> = {
    kind: 'text',
    text: options?.text || '',
    frame: options?.frame || { x: 0.2, y: 0.2, w: 0.4, h: 0.2 },
    text_style: options?.textStyle || {},
  };
  if (options?.runs !== undefined) payload.runs = options.runs;
  if (options?.binding !== undefined) payload.binding = options.binding;
  return insertObject(document, pageId, payload);
}

export function insertSampleSizeDescription(
  document: ReportDocument | unknown,
  pageId: string,
  options?: {
    sourceObjectId?: string | null;
    runId?: string | null;
    pinId?: string | null;
    tableSpecId?: string | null;
    source?: unknown;
    frame?: Partial<ReportFrame>;
    textStyle?: Partial<TextBoxStyle> | Record<string, unknown>;
  }
): ReportDocument {
  const fingerprint = options?.source != null ? sourceFingerprint(options.source) : null;
  const binding = normalizeTextBinding({
    kind: 'sample_size',
    source_object_id: options?.sourceObjectId,
    run_id: options?.runId,
    pin_id: options?.pinId,
    table_spec_id: options?.tableSpecId,
    fingerprint,
  });
  const text = options?.source != null ? sampleSizeDescriptionText(options.source) : '';
  return insertTextBox(document, pageId, {
    text: text || 'Sample size',
    frame: options?.frame || { x: 0.06, y: 0.88, w: 0.88, h: 0.08 },
    textStyle: { fontSizePt: 12, color: '#6A6B66', ...(options?.textStyle || {}) },
    binding,
  });
}

export function insertPageNumber(
  document: ReportDocument | unknown,
  pageId: string,
  options?: {
    template?: string | null;
    frame?: Partial<ReportFrame>;
    textStyle?: Partial<TextBoxStyle> | Record<string, unknown>;
  }
): ReportDocument {
  const binding = normalizeTextBinding({
    kind: 'page_number',
    template: options?.template || DEFAULT_PAGE_NUMBER_TEMPLATE,
  });
  const doc = normalizeReportDocument(document);
  const index = Math.max(
    0,
    doc.pages.findIndex(page => page.id === String(pageId))
  );
  const text = pageNumberText(index, doc.pages.length, binding?.template);
  return insertTextBox(document, pageId, {
    text,
    frame: options?.frame || { x: 0.78, y: 0.92, w: 0.16, h: 0.05 },
    textStyle: {
      fontSizePt: 11,
      color: '#6A6B66',
      align: 'right',
      ...(options?.textStyle || {}),
    },
    binding,
  });
}

export function insertDynamicText(
  document: ReportDocument | unknown,
  pageId: string,
  options: {
    rowKey: string;
    colKey?: string | null;
    stat?: string;
    sourceObjectId?: string | null;
    runId?: string | null;
    pinId?: string | null;
    tableSpecId?: string | null;
    source?: unknown;
    prefix?: string;
    suffix?: string;
    frame?: Partial<ReportFrame>;
    textStyle?: Partial<TextBoxStyle> | Record<string, unknown>;
  }
): ReportDocument {
  const fingerprint = options.source != null ? sourceFingerprint(options.source) : null;
  const prefix = options.prefix || '';
  const suffix = options.suffix || '';
  const binding = normalizeTextBinding({
    kind: 'cell',
    row_key: options.rowKey,
    col_key: options.colKey,
    stat: options.stat || 'percent',
    source_object_id: options.sourceObjectId,
    run_id: options.runId,
    pin_id: options.pinId,
    table_spec_id: options.tableSpecId,
    prefix,
    suffix,
    fingerprint,
  });
  const value =
    options.source != null
      ? cellValueText(options.source, {
          rowKey: options.rowKey,
          colKey: options.colKey,
          stat: options.stat || 'percent',
        })
      : '';
  const text = value ? `${prefix}${value}${suffix}` : `${prefix}—${suffix}`;
  return insertTextBox(document, pageId, {
    text,
    frame: options.frame || { x: 0.2, y: 0.2, w: 0.3, h: 0.1 },
    textStyle: options.textStyle,
    binding,
  });
}

/** Update an object's live-text binding and refresh its display string. */
export function setObjectBinding(
  document: ReportDocument | unknown,
  pageId: string,
  objectId: string,
  bindingRaw: Partial<TextBinding> | Record<string, unknown> | null | undefined,
  options?: {
    source?: unknown;
    pageIndex?: number;
    pageCount?: number;
  }
): ReportDocument {
  const doc = normalizeReportDocument(document);
  const binding = normalizeTextBinding(bindingRaw);
  const pageIndex =
    options?.pageIndex ??
    Math.max(
      0,
      doc.pages.findIndex(page => page.id === String(pageId))
    );
  const pageCount = options?.pageCount ?? doc.pages.length;
  const resolved = binding
    ? resolveBindingText(binding, {
        source: options?.source,
        pageIndex,
        pageCount,
      })
    : '';
  let fallback = '';
  if (binding?.kind === 'sample_size') fallback = 'Sample size';
  else if (binding?.kind === 'page_number')
    fallback = pageNumberText(pageIndex, pageCount, binding.template);
  else if (binding?.kind === 'cell') {
    fallback = `${binding.prefix || ''}—${binding.suffix || ''}`;
  }
  const text = resolved || fallback;
  return {
    ...doc,
    pages: doc.pages.map(page => {
      if (page.id !== String(pageId)) return page;
      return {
        ...page,
        objects: page.objects.map(obj => {
          if (obj.id !== String(objectId) || obj.kind !== 'text') return obj;
          return {
            ...obj,
            binding,
            text: text || obj.text,
            runs: [],
          };
        }),
      };
    }),
  };
}

/** Plain-language "Shows" line for the live-value inspector. */
export function liveValueShowsLabel(binding: TextBinding | null | undefined): string {
  if (!binding) return '';
  if (binding.kind === 'page_number') return 'Page number';
  if (binding.kind === 'sample_size') return 'Sample size';
  const row = String(binding.rowKey || '').trim() || 'Category';
  const col = String(binding.colKey || '').trim() || 'Total';
  return `${row} · ${col}`;
}

/** Plain-language "From" line for the live-value inspector. */
export function liveValueFromLabel(
  binding: TextBinding | null | undefined,
  pageObjects: ReportObject[] = [],
  options?: { pageTitle?: string | null }
): string {
  if (!binding) return '';
  if (binding.kind === 'page_number') return 'This report';
  const tables = pageObjects.filter(obj => obj.kind === 'table');
  const linked =
    (binding.sourceObjectId && tables.find(obj => obj.id === binding.sourceObjectId)) ||
    (binding.runId && tables.find(obj => obj.runId === binding.runId)) ||
    (binding.pinId && tables.find(obj => obj.pinId === binding.pinId)) ||
    (binding.tableSpecId && tables.find(obj => obj.tableSpecId === binding.tableSpecId)) ||
    null;
  if (linked) {
    const index = tables.findIndex(obj => obj.id === linked.id);
    const pageTitle = String(options?.pageTitle || '').trim();
    if (pageTitle) return `T${index + 1} · ${pageTitle}`;
    return `Table ${index + 1}`;
  }
  if (tables.length === 1) {
    const pageTitle = String(options?.pageTitle || '').trim();
    return pageTitle ? `T1 · ${pageTitle}` : 'Table 1';
  }
  return tables.length ? 'Choose a table' : 'No table on this page';
}

export function refreshLiveText(
  document: ReportDocument | unknown,
  sources?: Record<string, unknown> | null
): ReportDocument {
  const doc = normalizeReportDocument(document);
  const lookup = sources && typeof sources === 'object' ? sources : {};
  const pageCount = doc.pages.length;
  return {
    ...doc,
    pages: doc.pages.map((page, pageIndex) => {
      const objects = page.objects.map(obj => {
        let next = obj;
        if (obj.binding) {
          const source = lookupLiveSource(obj.binding, page.objects, lookup);
          const resolved = resolveBindingText(obj.binding, {
            source,
            pageIndex,
            pageCount,
          });
          const fingerprint = source != null ? sourceFingerprint(source) : '';
          let binding: TextBinding = { ...obj.binding };
          if (
            binding.kind === 'sample_size' ||
            binding.kind === 'cell' ||
            binding.kind === 'page_number'
          ) {
            if (fingerprint) binding = { ...binding, fingerprint, stale: false };
            else binding = { ...binding, stale: false };
          } else if (binding.fingerprint && fingerprint && binding.fingerprint !== fingerprint) {
            binding = { ...binding, stale: true };
          }
          binding = normalizeTextBinding(binding) || binding;
          next = {
            ...next,
            text: resolved || next.text,
            binding,
            runs: next.runs.length ? next.runs : [],
          };
        }
        if (!next.runs.some(run => run.binding)) return next;
        const runs = next.runs.map(run => {
          if (!run.binding) return run;
          const source = lookupLiveSource(run.binding, page.objects, lookup);
          const resolved = resolveBindingText(run.binding, {
            source,
            pageIndex,
            pageCount,
          });
          const fingerprint = source != null ? sourceFingerprint(source) : '';
          let binding: TextBinding = { ...run.binding };
          if (
            binding.kind === 'sample_size' ||
            binding.kind === 'cell' ||
            binding.kind === 'page_number'
          ) {
            if (fingerprint) binding = { ...binding, fingerprint, stale: false };
            else binding = { ...binding, stale: false };
          } else if (binding.fingerprint && fingerprint && binding.fingerprint !== fingerprint) {
            binding = { ...binding, stale: true };
          }
          return {
            ...run,
            text: resolved || run.text,
            binding: normalizeTextBinding(binding),
          };
        });
        return {
          ...next,
          runs,
          text: textFromRuns(runs).trim() || next.text,
        };
      });
      return { ...page, objects };
    }),
  };
}

export function insertTable(
  document: ReportDocument | unknown,
  pageId: string,
  options?: {
    tableSpecId?: string | null;
    runId?: string | null;
    pinId?: string | null;
    frame?: Partial<ReportFrame>;
    tableStyle?: Partial<TableStyle> | Record<string, unknown>;
    tableRules?: unknown[];
    tableEdits?: Partial<TableEdits> | Record<string, unknown>;
  }
): ReportDocument {
  return insertObject(document, pageId, {
    kind: 'table',
    table_spec_id: options?.tableSpecId,
    run_id: options?.runId,
    pin_id: options?.pinId,
    frame: options?.frame || { x: 0.06, y: 0.22, w: 0.88, h: 0.68 },
    table_style: options?.tableStyle || {},
    table_rules: options?.tableRules || [],
    table_edits: options?.tableEdits || {},
  });
}

function patchTableObject(
  document: ReportDocument | unknown,
  pageId: string,
  objectId: string,
  mutator: (obj: ReportObject) => ReportObject
): ReportDocument {
  const doc = normalizeReportDocument(document);
  return {
    ...doc,
    pages: doc.pages.map(page => {
      if (page.id !== String(pageId)) return page;
      return {
        ...page,
        objects: page.objects.map(obj => {
          if (obj.id !== String(objectId) || obj.kind !== 'table') return obj;
          return mutator(obj);
        }),
      };
    }),
  };
}

export function setTableStyle(
  document: ReportDocument | unknown,
  pageId: string,
  objectId: string,
  style: Partial<TableStyle> | Record<string, unknown> | null | undefined
): ReportDocument {
  const patch = style && typeof style === 'object' ? style : {};
  return patchTableObject(document, pageId, objectId, obj => ({
    ...obj,
    tableStyle: normalizeTableStyle({ ...obj.tableStyle, ...patch }),
  }));
}

export function setTableRules(
  document: ReportDocument | unknown,
  pageId: string,
  objectId: string,
  rules: unknown[] | null | undefined
): ReportDocument {
  return patchTableObject(document, pageId, objectId, obj => ({
    ...obj,
    tableRules: normalizeTableRules(rules || []),
  }));
}

export function setTableEdits(
  document: ReportDocument | unknown,
  pageId: string,
  objectId: string,
  edits: Partial<TableEdits> | Record<string, unknown> | null | undefined
): ReportDocument {
  return patchTableObject(document, pageId, objectId, obj => ({
    ...obj,
    tableEdits: normalizeTableEdits(edits || {}),
  }));
}

export function renameTableRow(
  document: ReportDocument | unknown,
  pageId: string,
  objectId: string,
  rowId: string,
  label: string
): ReportDocument {
  return patchTableObject(document, pageId, objectId, obj => {
    const edits = normalizeTableEdits(obj.tableEdits);
    return {
      ...obj,
      tableEdits: normalizeTableEdits({
        ...edits,
        renames: { ...edits.renames, [String(rowId)]: String(label).trim() },
      }),
    };
  });
}

export function hideTableRow(
  document: ReportDocument | unknown,
  pageId: string,
  objectId: string,
  rowId: string,
  hidden = true
): ReportDocument {
  return patchTableObject(document, pageId, objectId, obj => {
    const edits = normalizeTableEdits(obj.tableEdits);
    const target = String(rowId);
    let hiddenRowIds = [...edits.hiddenRowIds];
    if (hidden && !hiddenRowIds.includes(target)) hiddenRowIds.push(target);
    if (!hidden) hiddenRowIds = hiddenRowIds.filter(id => id !== target);
    return {
      ...obj,
      tableEdits: normalizeTableEdits({ ...edits, hiddenRowIds }),
    };
  });
}

export function reorderTableRows(
  document: ReportDocument | unknown,
  pageId: string,
  objectId: string,
  rowIds: string[]
): ReportDocument {
  return patchTableObject(document, pageId, objectId, obj => {
    const edits = normalizeTableEdits(obj.tableEdits);
    return {
      ...obj,
      tableEdits: normalizeTableEdits({
        ...edits,
        rowOrder: (rowIds || [])
          .map(String)
          .map(id => id.trim())
          .filter(Boolean),
      }),
    };
  });
}

export function mergeTableRowsIntoNet(
  document: ReportDocument | unknown,
  pageId: string,
  objectId: string,
  rowIds: string[],
  label = 'NET'
): ReportDocument {
  return patchTableObject(document, pageId, objectId, obj => {
    const edits = normalizeTableEdits(obj.tableEdits);
    return {
      ...obj,
      tableEdits: normalizeTableEdits({
        ...edits,
        merges: [...edits.merges, { label, rowIds: [...rowIds], hideMembers: true }],
      }),
    };
  });
}

export function presentTableObject(
  document: ReportDocument | unknown,
  pageId: string,
  objectId: string,
  book: Record<string, unknown> | null | undefined
): PresentedBook {
  const doc = normalizeReportDocument(document);
  const page = doc.pages.find(item => item.id === String(pageId));
  const obj = page?.objects.find(item => item.id === String(objectId) && item.kind === 'table');
  if (!obj) return applyTablePresentation(book || {});
  return applyTablePresentation(book || {}, {
    style: obj.tableStyle,
    rules: obj.tableRules,
    edits: obj.tableEdits,
  });
}

export function setObjectText(
  document: ReportDocument | unknown,
  pageId: string,
  objectId: string,
  options: { text?: string; runs?: unknown[] }
): ReportDocument {
  const doc = normalizeReportDocument(document);
  return {
    ...doc,
    pages: doc.pages.map(page => {
      if (page.id !== String(pageId)) return page;
      return {
        ...page,
        objects: page.objects.map(obj => {
          if (obj.id !== String(objectId)) return obj;
          let runs = options.runs !== undefined ? normalizeTextRuns(options.runs) : [...obj.runs];
          let text = obj.text;
          if (options.text !== undefined) {
            text = String(options.text).trim();
            if (options.runs === undefined) runs = [];
          } else if (runs.length) {
            text = textFromRuns(runs).trim();
          }
          if (runs.length && !text) text = textFromRuns(runs).trim();
          return { ...obj, text, runs };
        }),
      };
    }),
  };
}

export function setObjectTextStyle(
  document: ReportDocument | unknown,
  pageId: string,
  objectId: string,
  style: Partial<TextBoxStyle> | Record<string, unknown> | null | undefined
): ReportDocument {
  const doc = normalizeReportDocument(document);
  const patch = style && typeof style === 'object' ? style : {};
  return {
    ...doc,
    pages: doc.pages.map(page => {
      if (page.id !== String(pageId)) return page;
      return {
        ...page,
        objects: page.objects.map(obj => {
          if (obj.id !== String(objectId)) return obj;
          return {
            ...obj,
            textStyle: normalizeTextStyle({ ...obj.textStyle, ...patch }),
          };
        }),
      };
    }),
  };
}

export function copyStyles(
  document: ReportDocument | unknown,
  pageId: string,
  sourceObjectId: string,
  targetObjectIds: string[]
): ReportDocument {
  const doc = normalizeReportDocument(document);
  const page = doc.pages.find(item => item.id === String(pageId));
  if (!page) return doc;
  const source = page.objects.find(obj => obj.id === String(sourceObjectId));
  if (!source) return doc;
  const wanted = new Set(targetObjectIds.map(String));
  wanted.delete(String(sourceObjectId));
  return {
    ...doc,
    pages: doc.pages.map(item => {
      if (item.id !== String(pageId)) return item;
      return {
        ...item,
        objects: item.objects.map(obj => {
          if (!wanted.has(obj.id)) return obj;
          let runs = obj.runs;
          if (source.runs.length && obj.runs.length && source.runs.length === obj.runs.length) {
            runs = normalizeTextRuns(
              source.runs.map((src, index) => ({
                ...src,
                text: obj.runs[index]?.text || '',
                binding: obj.runs[index]?.binding ?? null,
              }))
            );
          }
          return {
            ...obj,
            textStyle: { ...source.textStyle },
            runs,
          };
        }),
      };
    }),
  };
}

export function setDefaultLabels(
  document: ReportDocument | unknown,
  labels: Partial<DefaultLabels> | Record<string, unknown> | null | undefined
): ReportDocument {
  const doc = normalizeReportDocument(document);
  return { ...doc, defaultLabels: normalizeDefaultLabels(labels) };
}

export function copyObjects(
  document: ReportDocument | unknown,
  pageId: string,
  objectIds: string[]
): ReportObject[] {
  const doc = normalizeReportDocument(document);
  const page = doc.pages.find(item => item.id === String(pageId));
  if (!page) return [];
  return pageObjectsById(page, objectIds).map(obj => ({
    ...obj,
    frame: { ...obj.frame },
  }));
}

export function pasteObjects(
  document: ReportDocument | unknown,
  pageId: string,
  clipboard: ReportObject[],
  offset = 0.02
): ReportDocument {
  const doc = normalizeReportDocument(document);
  const shift = Number.isFinite(offset) ? offset : 0.02;
  return {
    ...doc,
    pages: doc.pages.map(page => {
      if (page.id !== String(pageId)) return page;
      const top = page.objects.reduce((max, item) => Math.max(max, item.zIndex), 0);
      const pasted: ReportObject[] = [];
      clipboard.forEach((raw, index) => {
        const frame = normalizeFrame(raw.frame);
        const { id: _ignoredId, ...rest } = raw;
        const obj = normalizeObject(
          {
            ...rest,
            slotId: null,
            slot_id: null,
            frame: {
              x: clamp01(frame.x + shift, frame.x),
              y: clamp01(frame.y + shift, frame.y),
              w: frame.w,
              h: frame.h,
            },
            zIndex: top + index + 1,
          },
          page.layoutId
        );
        if (obj) pasted.push(obj);
      });
      const objects = [...page.objects, ...pasted].sort(
        (a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id)
      );
      return { ...page, objects };
    }),
  };
}

export function addPage(
  document: ReportDocument | unknown,
  options?: {
    title?: string;
    layoutId?: string;
    section?: string | null;
    afterPageId?: string;
  }
): ReportDocument {
  const doc = normalizeReportDocument(document);
  let layoutId = String(options?.layoutId || 'blank').trim() || 'blank';
  if (!getPageLayout(layoutId)) layoutId = 'title_and_content';
  const title = String(options?.title || '').trim() || 'Untitled page';
  const page: ReportPage = {
    id: newId('page'),
    title,
    layoutId,
    section: options?.section ? String(options.section).trim() || null : null,
    objects: placeholderObjectsForLayout(layoutId, { title }),
    hideFromExport: false,
    hideFromPublish: false,
  };
  const pages = [...doc.pages];
  if (options?.afterPageId) {
    const index = pages.findIndex(item => item.id === String(options.afterPageId));
    if (index >= 0) {
      pages.splice(index + 1, 0, page);
      return { ...doc, pages };
    }
  }
  pages.push(page);
  return { ...doc, pages };
}

export function deletePage(document: ReportDocument | unknown, pageId: string): ReportDocument {
  const doc = normalizeReportDocument(document);
  return { ...doc, pages: doc.pages.filter(page => page.id !== String(pageId)) };
}

export function searchPages(document: ReportDocument | unknown, query: string): ReportPage[] {
  const doc = normalizeReportDocument(document);
  const needle = String(query || '')
    .trim()
    .toLowerCase();
  if (!needle) return [...doc.pages];
  return doc.pages.filter(page => {
    const title = page.title.toLowerCase();
    const section = (page.section || '').toLowerCase();
    return title.includes(needle) || section.includes(needle);
  });
}

export type AlignmentGuide = {
  axis: 'x' | 'y';
  position: number;
  edge: string;
  sourceObjectId: string;
};

export function alignmentGuides(
  document: ReportDocument | unknown,
  pageId: string,
  movingFrame: Partial<ReportFrame>,
  options?: { threshold?: number; excludeObjectIds?: string[] }
): AlignmentGuide[] {
  const doc = normalizeReportDocument(document);
  const tol =
    typeof options?.threshold === 'number' && Number.isFinite(options.threshold)
      ? Math.abs(options.threshold)
      : 0.015;
  const excluded = new Set((options?.excludeObjectIds || []).map(String));
  const moving = normalizeFrame(movingFrame);
  const movingEdges: Record<string, number> = {
    left: moving.x,
    center_x: moving.x + moving.w / 2,
    right: moving.x + moving.w,
    top: moving.y,
    middle_y: moving.y + moving.h / 2,
    bottom: moving.y + moving.h,
  };
  const page = doc.pages.find(item => item.id === String(pageId));
  if (!page) return [];
  const guides: AlignmentGuide[] = [];
  for (const obj of page.objects) {
    if (excluded.has(obj.id) || obj.hidden) continue;
    const other: Record<string, number> = {
      left: obj.frame.x,
      center_x: obj.frame.x + obj.frame.w / 2,
      right: obj.frame.x + obj.frame.w,
      top: obj.frame.y,
      middle_y: obj.frame.y + obj.frame.h / 2,
      bottom: obj.frame.y + obj.frame.h,
    };
    for (const [name, value] of Object.entries(movingEdges)) {
      const axis = name === 'left' || name === 'center_x' || name === 'right' ? 'x' : 'y';
      const peer = other[name];
      if (peer === undefined) continue;
      if (Math.abs(value - peer) <= tol) {
        guides.push({
          axis,
          position: peer,
          edge: name,
          sourceObjectId: obj.id,
        });
      }
    }
  }
  return guides;
}

export function sortPages(
  document: ReportDocument | unknown,
  by: 'title' | 'alphabetically' | 'alpha' | 'significance' | 'sig' | 'score' = 'title',
  scores?: Record<string, number>
): ReportDocument {
  const doc = normalizeReportDocument(document);
  if (by === 'title' || by === 'alphabetically' || by === 'alpha') {
    return {
      ...doc,
      pages: [...doc.pages].sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
      ),
    };
  }
  if (by === 'significance' || by === 'sig' || by === 'score') {
    const scoreMap = scores || {};
    const scoreFor = (page: ReportPage): number => {
      const raw = scoreMap[page.id] ?? scoreMap[page.title];
      return typeof raw === 'number' && Number.isFinite(raw) ? raw : Number.NEGATIVE_INFINITY;
    };
    return {
      ...doc,
      pages: [...doc.pages].sort((a, b) => {
        const delta = scoreFor(b) - scoreFor(a);
        if (delta !== 0) return delta;
        return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      }),
    };
  }
  return doc;
}

/** Report reshape from chat: board / short / audience. Full report always kept. */

export type ReportReshapeKind = 'board' | 'short' | 'audience';

export type ReportReshapeRequest = {
  kind: ReportReshapeKind;
  maxSlides: number;
  audienceLabel: string;
  includeRecommendations: boolean | null;
  recommendationCount: number;
  placement: 'front' | 'end';
};

export type ReportReshapeResult = {
  ok: true;
  document: ReportDocument;
  variantSection: string;
  variantPageIds: string[];
  keptFull: true;
  kind: ReportReshapeKind;
  note: string;
};

const METHODS_MARKERS = ['how to read this report', 'how to read', 'methods', 'methodology'];
const APPENDIX_MARKERS = [
  'uninteresting tables',
  'weight diagnostics',
  'report context',
  'evidence appendix',
  'reasons and verbatims',
];
const VARIANT_SECTION_PREFIXES = ['board', 'short', 'audience'];
const STRUCTURAL_SECTIONS = new Set([
  'title',
  'executive summary',
  'methods',
  'methodology',
  'evidence',
  'appendix',
]);
const STRUCTURAL_TITLES = new Set([
  'study',
  'report',
  'executive summary',
  'how to read this report',
  'evidence',
]);
const PCT_PAIR_RE = /(\d+(?:\.\d+)?)\s*%\s*vs\.?\s*(\d+(?:\.\d+)?)\s*%/gi;
const INCOMPLETE_PCT_VS_RE = /\(\s*\d+(?:\.\d+)?%\s*vs\.?\s*$/i;
const WEAK_GAP_PP = 3;

function sectionLabel(kind: ReportReshapeKind, audienceLabel = ''): string {
  if (kind === 'board') return 'Board';
  if (kind === 'short') return 'Short';
  const label = String(audienceLabel || '').trim();
  return label ? `Audience · ${label}` : 'Audience';
}

function isVariantSection(section: string | null | undefined): boolean {
  const text = String(section || '')
    .trim()
    .toLowerCase();
  if (!text) return false;
  return VARIANT_SECTION_PREFIXES.some(
    prefix => text === prefix || text.startsWith(`${prefix} ·`) || text.startsWith(`${prefix}·`)
  );
}

function isMethodsOrAppendixPage(page: ReportPage): boolean {
  const title = page.title.trim().toLowerCase();
  const section = (page.section || '').trim().toLowerCase();
  if (
    METHODS_MARKERS.some(
      marker => title === marker || title.startsWith(marker) || section === marker
    )
  ) {
    return true;
  }
  if (APPENDIX_MARKERS.some(marker => title.includes(marker) || section.includes(marker))) {
    return true;
  }
  return section.startsWith('evidence') || section.startsWith('appendix');
}

function isStructuralReportPage(page: ReportPage): boolean {
  const section = (page.section || '').trim().toLowerCase();
  const title = page.title.trim().toLowerCase();
  if (
    STRUCTURAL_SECTIONS.has(section) ||
    [...STRUCTURAL_SECTIONS].some(
      marker => section.startsWith(`${marker} `) || section.startsWith(`${marker}·`)
    )
  ) {
    return true;
  }
  if (STRUCTURAL_TITLES.has(title) || title.startsWith('executive summary')) return true;
  return isMethodsOrAppendixPage(page);
}

function isSourceFindingPage(page: ReportPage): boolean {
  if (isVariantSection(page.section)) return false;
  if (isStructuralReportPage(page)) return false;
  if (page.hideFromExport) return false;
  return true;
}

function pageHasVisual(page: ReportPage): boolean {
  return page.objects.some(
    obj => obj.kind === 'chart' || obj.kind === 'table' || obj.kind === 'image'
  );
}

function pageBodyText(page: ReportPage): string {
  return page.objects
    .filter(obj => obj.kind === 'text' && (obj.slotId || '').toLowerCase() !== 'title')
    .map(obj => String(obj.text || '').trim())
    .filter(Boolean)
    .join('\n');
}

function maxPctGapPp(text: string): number {
  let best = 0;
  const source = String(text || '');
  PCT_PAIR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PCT_PAIR_RE.exec(source))) {
    const left = Number(match[1]);
    const right = Number(match[2]);
    if (Number.isFinite(left) && Number.isFinite(right)) {
      best = Math.max(best, Math.abs(left - right));
    }
  }
  return best;
}

function cleanFindingTitle(title: string, body = ''): string {
  let text = String(title || '').trim();
  if (!text) return '';
  if (INCOMPLETE_PCT_VS_RE.test(text)) {
    PCT_PAIR_RE.lastIndex = 0;
    const pair = PCT_PAIR_RE.exec(String(body || ''));
    if (pair) {
      const stem = text.replace(INCOMPLETE_PCT_VS_RE, '').replace(/[ \-–—:]+$/u, '');
      text = `${stem} (${pair[1]}% vs ${pair[2]}%)`.trim();
    } else {
      text = text
        .replace(INCOMPLETE_PCT_VS_RE, '')
        .replace(/[ \-–—:(]+$/u, '')
        .trim();
    }
  }
  return text;
}

function findingStrength(page: ReportPage): [number, number, number, number] {
  const section = (page.section || '').trim().toLowerCase();
  const title = page.title || '';
  const body = pageBodyText(page);
  const gap = Math.max(maxPctGapPp(title), maxPctGapPp(body));
  const gapScore = gap > 0 && gap < WEAK_GAP_PP ? gap * 0.05 : gap;
  const insights = ['insights', 'findings', 'headline findings'].includes(section) ? 1 : 0;
  const visual = pageHasVisual(page) ? 1 : 0;
  const substance = Math.min(title.trim().length, 120) / 120;
  return [insights, visual, gapScore, substance];
}

function isWeakGapPage(page: ReportPage): boolean {
  const gap = Math.max(maxPctGapPp(page.title || ''), maxPctGapPp(pageBodyText(page)));
  return gap > 0 && gap < WEAK_GAP_PP;
}

function pickFindingPages(sources: ReportPage[], slots: number): ReportPage[] {
  if (slots <= 0) return [];
  const ranked = [...sources].sort((a, b) => {
    const left = findingStrength(a);
    const right = findingStrength(b);
    for (let i = 0; i < left.length; i += 1) {
      if (left[i]! !== right[i]!) return right[i]! - left[i]!;
    }
    return 0;
  });
  const strong = ranked.filter(page => !isWeakGapPage(page));
  // Drop tiny % gaps when any stronger page exists — do not pad the board with them.
  if (strong.length) return strong.slice(0, slots);
  return ranked.slice(0, slots);
}

function studyTitleFromPages(pages: ReportPage[]): string {
  for (const page of pages) {
    const section = (page.section || '').trim().toLowerCase();
    const title = page.title.trim();
    if (
      section === 'title' &&
      title &&
      !['study', 'report', 'untitled'].includes(title.toLowerCase())
    ) {
      return title;
    }
  }
  for (const page of pages) {
    if ((page.section || '').trim().toLowerCase() === 'title' && page.title.trim()) {
      return page.title.trim();
    }
  }
  return '';
}

function clonePageForVariant(
  page: ReportPage,
  options: { section: string; titlePrefix?: string }
): ReportPage {
  const prefix = String(options.titlePrefix || '').trim();
  const body = pageBodyText(page);
  let title = cleanFindingTitle(page.title, body);
  if (prefix && title && !title.toLowerCase().startsWith(prefix.toLowerCase())) {
    title = `${prefix}: ${title}`;
  }
  return {
    ...page,
    id: newId('page'),
    title,
    section: options.section,
    hideFromExport: false,
    hideFromPublish: false,
    objects: page.objects.map(obj => {
      const next = { ...obj, id: newId('obj') };
      if (next.kind === 'text' && (next.slotId || '').toLowerCase() === 'title') {
        next.text = title;
      }
      return next;
    }),
  };
}

function boardTitlePage(options: {
  section: string;
  studyTitle: string;
  kind: ReportReshapeKind;
  audienceLabel?: string;
}): ReportPage {
  const layoutId = 'title_page';
  const study = String(options.studyTitle || '').trim();
  let headline = 'Board briefing';
  let subtitle = study || 'Five slides for the board. Full report kept.';
  if (options.kind === 'short') {
    headline = 'Short version';
    subtitle = study || 'Condensed report. Full report kept.';
  } else if (options.kind === 'audience') {
    const audience = String(options.audienceLabel || '').trim() || 'Audience';
    headline = `For ${audience}`;
    subtitle = study || 'Audience version. Full report kept.';
  } else if (study) {
    headline = study;
    subtitle = 'Board briefing';
  }
  return {
    id: newId('page'),
    title: headline,
    layoutId,
    section: options.section,
    hideFromExport: false,
    hideFromPublish: false,
    objects: [
      {
        id: newId('obj'),
        kind: 'text',
        frame: frameForSlot(layoutId, 'title') || { x: 0.08, y: 0.28, w: 0.84, h: 0.18 },
        zIndex: 1,
        hidden: false,
        slotId: 'title',
        text: headline,
        textStyle: { ...DEFAULT_TEXT_STYLE, fontSizePt: 32, bold: true },
        runs: [],
        binding: null,
        shapeType: null,
        imageUrl: null,
        runId: null,
        pinId: null,
        tableSpecId: null,
        tableStyle: normalizeTableStyle(undefined),
        tableRules: [],
        tableEdits: normalizeTableEdits(undefined),
        keepLive: true,
      },
      {
        id: newId('obj'),
        kind: 'text',
        frame: frameForSlot(layoutId, 'subtitle') || { x: 0.08, y: 0.5, w: 0.84, h: 0.12 },
        zIndex: 2,
        hidden: false,
        slotId: 'subtitle',
        text: subtitle,
        textStyle: { ...DEFAULT_TEXT_STYLE, fontSizePt: 18 },
        runs: [],
        binding: null,
        shapeType: null,
        imageUrl: null,
        runId: null,
        pinId: null,
        tableSpecId: null,
        tableStyle: normalizeTableStyle(undefined),
        tableRules: [],
        tableEdits: normalizeTableEdits(undefined),
        keepLive: true,
      },
    ],
  };
}

function defaultRecommendationBullets(pages: ReportPage[], count: number): string[] {
  const wanted = Math.max(1, Math.min(count || 3, 8));
  const bullets: string[] = [];
  for (const page of pages) {
    const title = cleanFindingTitle(page.title, pageBodyText(page));
    if (!title) continue;
    bullets.push(title);
    if (bullets.length >= wanted) break;
  }
  while (bullets.length < wanted) bullets.push('Add an implication here.');
  return bullets.slice(0, wanted);
}

function recommendationsPage(options: {
  section: string;
  bullets: string[];
  title?: string;
}): ReportPage {
  const layoutId = 'title_and_content';
  const title = options.title || 'Recommendations';
  const lines = options.bullets.map(item => String(item).trim()).filter(Boolean);
  // Plain lines — listStyle:bullet adds the marker in the editor.
  const body = (lines.length ? lines : ['Add an implication here.']).join('\n');
  return {
    id: newId('page'),
    title,
    layoutId,
    section: options.section,
    hideFromExport: false,
    hideFromPublish: false,
    objects: [
      {
        id: newId('obj'),
        kind: 'text',
        frame: frameForSlot(layoutId, 'title') || { x: 0.06, y: 0.06, w: 0.88, h: 0.12 },
        zIndex: 1,
        hidden: false,
        slotId: 'title',
        text: title,
        textStyle: { ...DEFAULT_TEXT_STYLE, fontSizePt: 28, bold: true },
        runs: [],
        binding: null,
        shapeType: null,
        imageUrl: null,
        runId: null,
        pinId: null,
        tableSpecId: null,
        tableStyle: normalizeTableStyle(undefined),
        tableRules: [],
        tableEdits: normalizeTableEdits(undefined),
        keepLive: true,
      },
      {
        id: newId('obj'),
        kind: 'text',
        frame: frameForSlot(layoutId, 'content') || { x: 0.06, y: 0.22, w: 0.88, h: 0.68 },
        zIndex: 2,
        hidden: false,
        slotId: 'content',
        text: body,
        textStyle: { ...DEFAULT_TEXT_STYLE, listStyle: 'bullet', fontSizePt: 18 },
        runs: [],
        binding: null,
        shapeType: null,
        imageUrl: null,
        runId: null,
        pinId: null,
        tableSpecId: null,
        tableStyle: normalizeTableStyle(undefined),
        tableRules: [],
        tableEdits: normalizeTableEdits(undefined),
        keepLive: true,
      },
    ],
  };
}

export function reshapeReportDocument(
  document: ReportDocument | unknown,
  options: {
    kind: ReportReshapeKind | string;
    maxSlides?: number;
    audienceLabel?: string;
    includeRecommendations?: boolean | null;
    recommendationCount?: number;
    recommendationBullets?: string[] | null;
    placement?: 'front' | 'end' | string;
  }
): ReportReshapeResult {
  const doc = normalizeReportDocument(document);
  const kind = String(options.kind || '')
    .trim()
    .toLowerCase() as ReportReshapeKind;
  if (kind !== 'board' && kind !== 'short' && kind !== 'audience') {
    throw new Error('kind must be board, short, or audience');
  }
  const slideCap = Math.max(1, Math.min(Number(options.maxSlides) || 5, 20));
  const section = sectionLabel(kind, options.audienceLabel);
  let wantRecs = options.includeRecommendations;
  if (wantRecs == null) wantRecs = kind === 'board' || kind === 'audience';
  wantRecs = Boolean(wantRecs);
  let wantTitle = kind === 'board' || slideCap >= 4;
  let findingSlots = Math.max(0, slideCap - (wantTitle ? 1 : 0) - (wantRecs ? 1 : 0));
  if (findingSlots === 0 && slideCap >= 1 && !wantRecs) {
    findingSlots = 1;
    wantTitle = false;
  } else if (findingSlots === 0 && wantRecs && slideCap >= 2) {
    findingSlots = Math.max(1, slideCap - 1 - (wantTitle ? 1 : 0));
    if (findingSlots < 1) {
      wantTitle = false;
      findingSlots = Math.max(1, slideCap - 1);
    }
  }

  const kept = doc.pages.filter(page => (page.section || '') !== section);
  const sources = kept.filter(isSourceFindingPage);
  let chosen = pickFindingPages(sources, findingSlots);
  if (!chosen.length && sources.length && findingSlots > 0) {
    chosen = sources.slice(0, 1);
  }
  const titlePrefix =
    kind === 'audience' && String(options.audienceLabel || '').trim()
      ? String(options.audienceLabel).trim()
      : '';

  const variantPages: ReportPage[] = [];
  if (wantTitle) {
    variantPages.push(
      boardTitlePage({
        section,
        studyTitle: studyTitleFromPages(kept),
        kind,
        audienceLabel: options.audienceLabel,
      })
    );
  }
  for (const page of chosen) {
    variantPages.push(clonePageForVariant(page, { section, titlePrefix }));
  }

  if (wantRecs) {
    const bullets = (options.recommendationBullets || [])
      .map(item => String(item).trim())
      .filter(Boolean);
    const resolved =
      bullets.length > 0
        ? bullets
        : defaultRecommendationBullets(chosen, options.recommendationCount ?? 3);
    const recTitle = kind === 'board' ? 'Implications' : 'Recommendations';
    variantPages.push(recommendationsPage({ section, bullets: resolved, title: recTitle }));
  }

  let trimmed = variantPages;
  if (trimmed.length > slideCap) {
    if (wantRecs && trimmed.length >= 2) {
      const head = wantTitle ? trimmed.slice(0, 1) : [];
      const tail = trimmed.slice(-1);
      const mid = trimmed.slice(head.length, trimmed.length - 1);
      const keepMid = Math.max(0, slideCap - head.length - tail.length);
      trimmed = [...head, ...mid.slice(0, keepMid), ...tail];
    } else {
      trimmed = trimmed.slice(0, slideCap);
    }
  }

  const place = String(options.placement || 'front')
    .trim()
    .toLowerCase();
  const pages =
    place === 'end' || place === 'after' || place === 'back'
      ? [...kept, ...trimmed]
      : [...trimmed, ...kept];

  return {
    ok: true,
    document: { ...doc, pages },
    variantSection: section,
    variantPageIds: trimmed.map(page => page.id),
    keptFull: true,
    kind,
    note: `${section} version added at the ${
      place === 'end' || place === 'after' || place === 'back' ? 'end' : 'front'
    }. Full report kept.`,
  };
}

export function parseReportReshapeRequest(message: string): ReportReshapeRequest | null {
  const text = String(message || '').trim();
  if (!text) return null;
  const folded = text.toLowerCase().replace(/\s+/g, ' ');

  const boardHit =
    /\b(board|exec|executive|c[-\s]?suite)\b.{0,40}\b(version|deck|slides?|report)\b/.test(
      folded
    ) ||
    /\b(version|deck|slides?|report)\b.{0,40}\b(board|exec|executive|c[-\s]?suite)\b/.test(
      folded
    ) ||
    /\b5\s*slides?\b.{0,40}\bboard\b/.test(folded) ||
    /\bboard\b.{0,30}\b5\s*slides?\b/.test(folded) ||
    /\bfindings?\b.{0,40}\bfor (?:the )?board\b/.test(folded) ||
    /\bboard version\b/.test(folded);

  const shortHit =
    /\b(short|shorter|condensed|brief)\b.{0,30}\b(version|deck|slides?|report)\b/.test(folded) ||
    /\b(version|deck|slides?|report)\b.{0,30}\b(short|shorter|condensed|brief)\b/.test(folded);

  const audienceHit =
    /\bfor (?:a |the )?(?:different |new )?audience\b/.test(folded) ||
    /\baudience version\b/.test(folded) ||
    /\brefine for (?:a |an |the )?[\w\s-]{2,40}\b/.test(folded) ||
    /\bfor (?:the )?(board|executives?|leadership|clients?|stakeholders?)\b/.test(folded);

  let kind: ReportReshapeKind | null = null;
  let audienceLabel = '';

  if (boardHit) {
    kind = 'board';
  } else if (shortHit) {
    kind = 'short';
  } else if (audienceHit) {
    kind = 'audience';
    const match = folded.match(
      /\bfor (?:a |an |the )?([\w][\w\s-]{1,40}?)(?:\s+(?:version|deck|slides?|report)\b|$)/
    );
    if (match?.[1]) {
      const candidate = match[1].trim().replace(/[.,]+$/, '');
      if (
        candidate &&
        !['different audience', 'new audience', 'audience', 'a different audience'].includes(
          candidate
        )
      ) {
        audienceLabel = candidate.replace(/\b\w/g, ch => ch.toUpperCase());
      }
    }
    if (!audienceLabel) {
      for (const named of ['board', 'executives', 'leadership', 'clients', 'stakeholders']) {
        if (new RegExp(`\\b${named}\\b`).test(folded)) {
          audienceLabel = named.replace(/\b\w/g, ch => ch.toUpperCase());
          break;
        }
      }
    }
  }

  if (!kind) return null;

  let maxSlides = kind === 'board' ? 5 : kind === 'short' ? 8 : 6;
  const slideMatch = folded.match(/\b(\d{1,2})\s*slides?\b/);
  if (slideMatch) {
    maxSlides = Math.max(1, Math.min(Number(slideMatch[1]) || maxSlides, 20));
  }

  let includeRecommendations: boolean | null = null;
  let recommendationCount = 3;
  if (/\brecommendations?\b/.test(folded)) {
    includeRecommendations = true;
    const recMatch = folded.match(/\b(\d)\s*recommendations?\b/);
    if (recMatch) recommendationCount = Math.max(1, Math.min(Number(recMatch[1]) || 3, 8));
  } else if (kind === 'short') {
    includeRecommendations = false;
  }

  return {
    kind,
    maxSlides,
    audienceLabel,
    includeRecommendations,
    recommendationCount,
    placement: 'front',
  };
}

/** Wire shape the deck export endpoint accepts (snake_case). */
export function reportDocumentForApi(document: ReportDocument | unknown): Record<string, unknown> {
  const doc = normalizeReportDocument(document);
  return {
    page_width_in: doc.pageWidthIn,
    page_height_in: doc.pageHeightIn,
    aspect: doc.aspect,
    default_labels: {
      net: doc.defaultLabels.net,
      total: doc.defaultLabels.total,
    },
    theme: reportThemeForApi(doc.theme),
    page_templates: doc.pageTemplates.map(template => ({
      id: template.id,
      name: template.name,
      kind: template.kind,
      layout_id: template.layoutId,
      title: template.title,
      section: template.section,
      objects: template.objects,
    })),
    pages: doc.pages.map(page => ({
      id: page.id,
      title: page.title,
      layout_id: page.layoutId,
      section: page.section,
      hide_from_export: page.hideFromExport,
      hide_from_publish: page.hideFromPublish,
      objects: page.objects.map(obj => ({
        id: obj.id,
        kind: obj.kind,
        frame: obj.frame,
        z_index: obj.zIndex,
        hidden: obj.hidden,
        slot_id: obj.slotId,
        text: obj.text,
        text_style: {
          font_family: obj.textStyle.fontFamily,
          font_size_pt: obj.textStyle.fontSizePt,
          color: obj.textStyle.color,
          bold: obj.textStyle.bold,
          italic: obj.textStyle.italic,
          underline: obj.textStyle.underline,
          strikethrough: obj.textStyle.strikethrough,
          align: obj.textStyle.align,
          vertical_align: obj.textStyle.verticalAlign,
          line_spacing: obj.textStyle.lineSpacing,
          list_style: obj.textStyle.listStyle,
          list_indent: obj.textStyle.listIndent,
        },
        runs: obj.runs.map(run => ({
          text: run.text,
          bold: run.bold,
          italic: run.italic,
          underline: run.underline,
          strikethrough: run.strikethrough,
          color: run.color,
          font_family: run.fontFamily,
          font_size_pt: run.fontSizePt,
          href: run.href,
          binding: textBindingForApi(run.binding),
        })),
        binding: textBindingForApi(obj.binding),
        shape_type: obj.shapeType,
        image_url: obj.imageUrl,
        run_id: obj.runId,
        pin_id: obj.pinId,
        table_spec_id: obj.tableSpecId,
        table_style: tableStyleForApi(obj.tableStyle),
        table_rules: tableRulesForApi(obj.tableRules),
        table_edits: tableEditsForApi(obj.tableEdits),
        keep_live: obj.keepLive,
      })),
    })),
  };
}
