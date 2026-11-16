/** Report document: pages with positioned live objects (slide editor engine). */

import { getPageLayout } from '@/lib/report-theme';

export const PAGE_WIDTH_IN = 13.333;
export const PAGE_HEIGHT_IN = 7.5;
export const PAGE_ASPECT = '16:9' as const;

export type ReportObjectKind = 'text' | 'table' | 'chart' | 'image' | 'shape';

export type ReportFrame = { x: number; y: number; w: number; h: number };

export type ReportObject = {
  id: string;
  kind: ReportObjectKind;
  frame: ReportFrame;
  zIndex: number;
  hidden: boolean;
  slotId: string | null;
  text: string;
  runId: string | null;
  pinId: string | null;
  tableSpecId: string | null;
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
  pages: ReportPage[];
};

const OBJECT_KINDS = new Set<ReportObjectKind>(['text', 'table', 'chart', 'image', 'shape']);

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
  return {
    id: String(source.id || '').trim() || newId('obj'),
    kind,
    frame,
    zIndex: Number.isFinite(Number(source.z_index ?? source.zIndex))
      ? Number(source.z_index ?? source.zIndex)
      : 0,
    hidden: Boolean(source.hidden),
    slotId,
    text: String(source.text || '').trim(),
    runId,
    pinId,
    tableSpecId,
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
          runId,
          pinId,
          tableSpecId: null,
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
          runId,
          pinId,
          tableSpecId: null,
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
  frame: Partial<ReportFrame>
): ReportDocument {
  const doc = normalizeReportDocument(document);
  return {
    ...doc,
    pages: doc.pages.map(page => {
      if (page.id !== String(pageId)) return page;
      return {
        ...page,
        objects: page.objects.map(obj =>
          obj.id === String(objectId) ? { ...obj, frame: normalizeFrame(frame), slotId: null } : obj
        ),
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

export function sortPages(
  document: ReportDocument | unknown,
  by: 'title' | 'alphabetically' | 'alpha' = 'title'
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
  return doc;
}

/** Wire shape the deck export endpoint accepts (snake_case). */
export function reportDocumentForApi(document: ReportDocument | unknown): Record<string, unknown> {
  const doc = normalizeReportDocument(document);
  return {
    page_width_in: doc.pageWidthIn,
    page_height_in: doc.pageHeightIn,
    aspect: doc.aspect,
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
        run_id: obj.runId,
        pin_id: obj.pinId,
        table_spec_id: obj.tableSpecId,
        keep_live: obj.keepLive,
      })),
    })),
  };
}
