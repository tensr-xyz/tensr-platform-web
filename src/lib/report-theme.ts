/** Report page masters and team theme (fonts, colours, chart palette). */

export type PageLayoutSlot = { id: string; label: string };

export type PageLayoutMaster = {
  id: string;
  label: string;
  protected: true;
  slots: PageLayoutSlot[];
};

export type ReportTheme = {
  fontFamily: string;
  primaryColour: string;
  secondaryColour: string;
  chartPalette: string[];
  logoUrl: string | null;
};

export type PptxTemplateInspection = {
  layoutCount: number;
  layouts: { index: number; name: string }[];
  themeName: string | null;
  themeColours: string[];
  themeColoursFound: boolean;
  summary: string;
};

export const DEFAULT_CHART_PALETTE = [
  '#4F81BD',
  '#C0504D',
  '#9BBB59',
  '#8064A2',
  '#4BACC6',
  '#F79646',
] as const;

export const DEFAULT_REPORT_THEME: ReportTheme = {
  fontFamily: 'Inter',
  primaryColour: '#1E6B58',
  secondaryColour: '#1B1C1A',
  chartPalette: [...DEFAULT_CHART_PALETTE],
  logoUrl: null,
};

/** Protected page masters — defaults cannot be deleted. */
export const PAGE_LAYOUT_MASTERS: readonly PageLayoutMaster[] = [
  { id: 'blank', label: 'Blank', protected: true, slots: [] },
  {
    id: 'title_only',
    label: 'Title only',
    protected: true,
    slots: [{ id: 'title', label: 'Title' }],
  },
  {
    id: 'title_page',
    label: 'Title page',
    protected: true,
    slots: [
      { id: 'title', label: 'Title' },
      { id: 'subtitle', label: 'Subtitle' },
    ],
  },
  {
    id: 'title_and_content',
    label: 'Title and content',
    protected: true,
    slots: [
      { id: 'title', label: 'Title' },
      { id: 'content', label: 'Content' },
    ],
  },
  {
    id: 'content_and_text',
    label: 'Content and text',
    protected: true,
    slots: [
      { id: 'content', label: 'Content' },
      { id: 'text', label: 'Text' },
    ],
  },
  {
    id: 'two_content',
    label: 'Two content',
    protected: true,
    slots: [
      { id: 'content_left', label: 'Left content' },
      { id: 'content_right', label: 'Right content' },
    ],
  },
];

const HEX = /^[0-9A-Fa-f]{6}$/;
const ACCENT_KEYS = ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'] as const;

export function listPageLayouts(): PageLayoutMaster[] {
  return PAGE_LAYOUT_MASTERS.map(item => ({
    ...item,
    slots: item.slots.map(slot => ({ ...slot })),
  }));
}

export function getPageLayout(layoutId: string): PageLayoutMaster | null {
  const wanted = String(layoutId || '').trim();
  return listPageLayouts().find(item => item.id === wanted) ?? null;
}

export function assertLayoutMutable(layoutId: string): void {
  const item = getPageLayout(layoutId);
  if (item?.protected) {
    throw new Error(`The ${item.label} layout is a default and cannot be changed.`);
  }
}

function coerceHex(value: unknown): string | null {
  if (value == null) return null;
  let text = String(value).trim();
  if (text.startsWith('#')) text = text.slice(1);
  if (!HEX.test(text)) return null;
  return `#${text.toUpperCase()}`;
}

function coercePalette(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_CHART_PALETTE];
  const out = value.map(coerceHex).filter((c): c is string => Boolean(c));
  return out.length ? out : [...DEFAULT_CHART_PALETTE];
}

export function normalizeReportTheme(raw: unknown): ReportTheme {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const font =
    String(source.fontFamily ?? source.font_family ?? DEFAULT_REPORT_THEME.fontFamily).trim() ||
    DEFAULT_REPORT_THEME.fontFamily;
  const primary =
    coerceHex(source.primaryColour ?? source.primary_colour) ?? DEFAULT_REPORT_THEME.primaryColour;
  const secondary =
    coerceHex(source.secondaryColour ?? source.secondary_colour) ??
    DEFAULT_REPORT_THEME.secondaryColour;
  const logoRaw = source.logoUrl ?? source.logo_url;
  const logoUrl = logoRaw ? String(logoRaw).trim() || null : null;
  return {
    fontFamily: font,
    primaryColour: primary,
    secondaryColour: secondary,
    chartPalette: coercePalette(source.chartPalette ?? source.chart_palette ?? source.palette),
    logoUrl,
  };
}

export function themeFromOrgSettings(settings: unknown): ReportTheme {
  const bag = settings && typeof settings === 'object' ? (settings as Record<string, unknown>) : {};
  return normalizeReportTheme(bag.reportTheme ?? bag.report_theme);
}

function parseLayoutNames(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const names: string[] = [];
  const nodes = doc.getElementsByTagName('p:cSld');
  for (let i = 0; i < nodes.length; i++) {
    const name = nodes[i]?.getAttribute('name');
    if (name) names.push(name);
  }
  return names;
}

function parseThemeColours(xml: string): { name: string | null; colours: string[] } {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const scheme =
    doc.getElementsByTagName('a:clrScheme')[0] || doc.getElementsByTagName('clrScheme')[0];
  if (!scheme) return { name: null, colours: [] };
  const name = scheme.getAttribute('name');
  const byRole: Record<string, string> = {};
  for (const child of Array.from(scheme.children)) {
    const tag = child.localName || child.tagName.replace(/^.*:/, '');
    const srgb =
      child.getElementsByTagName('a:srgbClr')[0] || child.getElementsByTagName('srgbClr')[0];
    const sys =
      child.getElementsByTagName('a:sysClr')[0] || child.getElementsByTagName('sysClr')[0];
    const hex = coerceHex(srgb?.getAttribute('val') || sys?.getAttribute('lastClr'));
    if (hex) byRole[tag] = hex;
  }
  const colours = ACCENT_KEYS.map(key => byRole[key]).filter((c): c is string => Boolean(c));
  return { name, colours };
}

/** Read slide layouts and theme accents from a .pptx / .potx ArrayBuffer. */
export async function inspectPptxTemplate(data: ArrayBuffer): Promise<PptxTemplateInspection> {
  const bytes = new Uint8Array(data);
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error('template must be a PowerPoint file');
  }
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(data);
  const layoutFiles = Object.keys(zip.files)
    .filter(name => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const na = Number(/(\d+)\.xml$/i.exec(a)?.[1] || 0);
      const nb = Number(/(\d+)\.xml$/i.exec(b)?.[1] || 0);
      return na - nb;
    });
  const layouts: { index: number; name: string }[] = [];
  for (let i = 0; i < layoutFiles.length; i++) {
    const path = layoutFiles[i]!;
    const xml = await zip.file(path)!.async('string');
    const parsed = parseLayoutNames(xml);
    const name = parsed[0] || `Layout ${i + 1}`;
    layouts.push({ index: i, name });
  }
  const themePath =
    Object.keys(zip.files).find(name => /^ppt\/theme\/theme\d+\.xml$/i.test(name)) || null;
  let themeName: string | null = null;
  let themeColours: string[] = [];
  if (themePath) {
    const themeXml = await zip.file(themePath)!.async('string');
    const parsed = parseThemeColours(themeXml);
    themeName = parsed.name;
    themeColours = parsed.colours;
  }
  const found = themeColours.length > 0;
  const count = layouts.length;
  const summary = found
    ? `${count} layout${count === 1 ? '' : 's'} · theme colours found`
    : `${count} layout${count === 1 ? '' : 's'} · no theme colours`;
  return {
    layoutCount: count,
    layouts,
    themeName,
    themeColours,
    themeColoursFound: found,
    summary,
  };
}

export function reportThemeFromInspection(
  inspection: PptxTemplateInspection,
  base?: unknown
): ReportTheme {
  const theme = normalizeReportTheme(base);
  if (inspection.themeColours.length) {
    theme.chartPalette = [...inspection.themeColours];
    theme.primaryColour = inspection.themeColours[0]!;
    if (inspection.themeColours[1]) theme.secondaryColour = inspection.themeColours[1];
  }
  return theme;
}

export type ThemeTextDefaults = {
  fontFamily: string;
  color: string;
  accentColor: string;
};

export type VisualizationDefaults = {
  chart?: Record<string, unknown>;
  table?: Record<string, unknown>;
};

export function textDefaultsFromTheme(theme: unknown): ThemeTextDefaults {
  const normalised = normalizeReportTheme(theme);
  return {
    fontFamily: normalised.fontFamily,
    color: normalised.secondaryColour,
    accentColor: normalised.primaryColour,
  };
}

export function normalizeVisualizationDefaults(raw: unknown): VisualizationDefaults {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: VisualizationDefaults = {};
  for (const key of Object.keys(source)) {
    const kind = String(key || '')
      .trim()
      .toLowerCase();
    const value = source[key];
    if ((kind !== 'chart' && kind !== 'table') || !value || typeof value !== 'object') continue;
    const bag = value as Record<string, unknown>;
    const entry: Record<string, unknown> = { kind };
    if (kind === 'table') {
      const style = bag.table_style ?? bag.tableStyle;
      if (style && typeof style === 'object') entry.tableStyle = { ...(style as object) };
      const rules = bag.table_rules ?? bag.tableRules;
      if (Array.isArray(rules)) {
        entry.tableRules = rules.filter(rule => rule && typeof rule === 'object');
      }
    } else {
      const style = bag.text_style ?? bag.textStyle;
      if (style && typeof style === 'object') entry.textStyle = { ...(style as object) };
      const frame = bag.frame;
      if (frame && typeof frame === 'object') entry.frame = { ...(frame as object) };
    }
    out[kind] = entry;
  }
  return out;
}

export function setVisualizationDefault(
  defaults: unknown,
  styleTemplate: { kind: string } & Record<string, unknown>
): VisualizationDefaults {
  const bag = normalizeVisualizationDefaults(defaults);
  const kind = String(styleTemplate.kind || '')
    .trim()
    .toLowerCase();
  if (kind !== 'chart' && kind !== 'table') {
    throw new Error('Style template must be a chart or table.');
  }
  bag[kind] = { ...styleTemplate, kind };
  return bag;
}

export function mergeThemeIntoOrgSettings(
  settings: unknown,
  options?: { theme?: unknown; visualizations?: unknown }
): Record<string, unknown> {
  const bag =
    settings && typeof settings === 'object' ? { ...(settings as Record<string, unknown>) } : {};
  if (options?.theme !== undefined) {
    bag.reportTheme = normalizeReportTheme(options.theme);
  }
  if (options?.visualizations !== undefined) {
    bag.visualizationDefaults = normalizeVisualizationDefaults(options.visualizations);
  }
  return bag;
}
