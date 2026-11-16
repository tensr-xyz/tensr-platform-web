/** Report document: pages with positioned live objects (slide editor engine). */

import { getPageLayout } from '@/lib/report-theme';
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

export type ReportDocument = {
  pageWidthIn: number;
  pageHeightIn: number;
  aspect: typeof PAGE_ASPECT;
  defaultLabels: DefaultLabels;
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
    title: { x: 0.08, y: 0.38, w: 0.84, h: 0.2 },
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
  const font =
    String(source.font_family ?? source.fontFamily ?? DEFAULT_TEXT_STYLE.fontFamily).trim() ||
    DEFAULT_TEXT_STYLE.fontFamily;
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

export function normalizeReportDocument(raw: unknown): ReportDocument {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const pages = (Array.isArray(source.pages) ? source.pages : [])
    .map(normalizePage)
    .filter((page): page is ReportPage => Boolean(page));
  return {
    pageWidthIn: PAGE_WIDTH_IN,
    pageHeightIn: PAGE_HEIGHT_IN,
    aspect: PAGE_ASPECT,
    defaultLabels: normalizeDefaultLabels(source.default_labels || source.defaultLabels),
    pages,
  };
}

export type PinLike = {
  id?: string;
  runId?: string;
  run_id?: string;
  headline?: string;
  title?: string;
  support?: string;
  bars?: { label?: string; percent?: number }[];
  deck?: boolean;
  keepLive?: boolean;
  keep_live?: boolean;
};

/** Each report pin becomes one title-and-content page with live refs. */
export function documentFromPins(pins: PinLike[]): ReportDocument {
  const pages: ReportPage[] = [];
  for (const pin of pins || []) {
    const headline = String(pin.headline || pin.title || '').trim();
    if (!headline) continue;
    const pinId = String(pin.id || '').trim() || newId('pin');
    const runId = String(pin.run_id || pin.runId || '').trim() || null;
    const support = String(pin.support || '').trim();
    const hasChart =
      Array.isArray(pin.bars) && pin.bars.some(bar => String(bar?.label || '').trim());
    const layoutId = 'title_and_content';
    const keepLive = pin.keep_live !== false && pin.keepLive !== false;
    pages.push({
      id: newId('page'),
      title: headline,
      layoutId,
      section: null,
      hideFromExport: pin.deck === false,
      hideFromPublish: false,
      objects: [
        {
          id: newId('obj'),
          kind: 'text',
          slotId: 'title',
          frame: frameForSlot(layoutId, 'title') || normalizeFrame(null),
          zIndex: 1,
          hidden: false,
          text: headline,
          textStyle: { ...DEFAULT_TEXT_STYLE },
          runs: [],
          shapeType: null,
          imageUrl: null,
          runId,
          pinId,
          tableSpecId: null,
          tableStyle: normalizeTableStyle({}),
          tableRules: [],
          tableEdits: normalizeTableEdits({}),
          keepLive,
        },
        {
          id: newId('obj'),
          kind: hasChart ? 'chart' : 'text',
          slotId: 'content',
          frame: frameForSlot(layoutId, 'content') || normalizeFrame(null),
          zIndex: 2,
          hidden: false,
          text: hasChart ? '' : support,
          textStyle: { ...DEFAULT_TEXT_STYLE },
          runs: [],
          shapeType: null,
          imageUrl: null,
          runId,
          pinId,
          tableSpecId: null,
          tableStyle: normalizeTableStyle({}),
          tableRules: [],
          tableEdits: normalizeTableEdits({}),
          keepLive,
        },
      ],
    });
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

export function placeObjectInSlot(
  document: ReportDocument | unknown,
  pageId: string,
  objectId: string,
  slotId: string
): ReportDocument {
  const doc = normalizeReportDocument(document);
  return {
    ...doc,
    pages: doc.pages.map(page => {
      if (page.id !== String(pageId)) return page;
      const box = frameForSlot(page.layoutId, slotId);
      if (!box) {
        throw new Error(`Unknown slot ${slotId} for layout ${page.layoutId}.`);
      }
      return {
        ...page,
        objects: page.objects.map(obj =>
          obj.id === String(objectId) ? { ...obj, slotId: String(slotId).trim(), frame: box } : obj
        ),
      };
    }),
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
  }
): ReportDocument {
  const payload: Record<string, unknown> = {
    kind: 'text',
    text: options?.text || '',
    frame: options?.frame || { x: 0.2, y: 0.2, w: 0.4, h: 0.2 },
    text_style: options?.textStyle || {},
  };
  if (options?.runs !== undefined) payload.runs = options.runs;
  return insertObject(document, pageId, payload);
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
  const page: ReportPage = {
    id: newId('page'),
    title: String(options?.title || '').trim() || 'Untitled page',
    layoutId,
    section: options?.section ? String(options.section).trim() || null : null,
    objects: [],
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
        })),
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
