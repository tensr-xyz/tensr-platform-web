/** Client codeframe import/export helpers (Paper 9d / TEN-148). Labels only in UI copy. */

export type CodeframeTheme = {
  id: string;
  label: string;
  keywords?: string[];
  definition?: string;
  net?: string;
  examples?: unknown[];
};

export type CodeframeAssignment = {
  respondent_id?: string;
  row?: number;
  text?: string;
  codes?: string[];
  code?: string;
};

export type CodeframeImportMode = 'replace' | 'merge' | 'keep_precoded';

export type CodeframeImportParsed = {
  codes: CodeframeTheme[];
  source_text_column?: string;
  assignments?: CodeframeAssignment[];
  code_count?: number;
  assignment_count?: number;
  net_count?: number;
  document?: Record<string, unknown>;
};

export const CODEFRAME_IMPORT_MODES: {
  id: CodeframeImportMode;
  label: string;
}[] = [
  { id: 'replace', label: 'Use theirs, re-code answers' },
  { id: 'merge', label: 'Merge with current' },
  { id: 'keep_precoded', label: 'Keep pre-coded answers' },
];

export function textColumnFromCodeColumn(codeColumn: string): string {
  const name = String(codeColumn || '').trim();
  if (name.endsWith('_codes')) return name.slice(0, -'_codes'.length);
  return name;
}

function themeKey(theme: Pick<CodeframeTheme, 'id' | 'label'>): string {
  const id = String(theme.id || '')
    .trim()
    .toLowerCase();
  if (id) return `id:${id}`;
  const label = String(theme.label || '')
    .trim()
    .toLowerCase();
  return label ? `label:${label}` : '';
}

/** Match imported themes to the current frame by id or label (case-insensitive). */
export function matchImportedThemes(
  imported: CodeframeTheme[],
  current: Array<Pick<CodeframeTheme, 'id' | 'label'>>
): { matched: number; newCount: number } {
  const keys = new Set(current.map(themeKey).filter(Boolean));
  // Also index current labels so an imported id can match a label-only rail row.
  for (const theme of current) {
    const label = String(theme.label || '')
      .trim()
      .toLowerCase();
    if (label) keys.add(`label:${label}`);
    const id = String(theme.id || '')
      .trim()
      .toLowerCase();
    if (id) keys.add(`label:${id}`);
  }
  let matched = 0;
  for (const theme of imported) {
    const id = String(theme.id || '')
      .trim()
      .toLowerCase();
    const label = String(theme.label || '')
      .trim()
      .toLowerCase();
    if (
      (id && (keys.has(`id:${id}`) || keys.has(`label:${id}`))) ||
      (label && (keys.has(`label:${label}`) || keys.has(`id:${label}`)))
    ) {
      matched += 1;
    }
  }
  return { matched, newCount: Math.max(0, imported.length - matched) };
}

export function countCodeframeNets(codes: CodeframeTheme[]): number {
  return new Set(codes.map(code => String(code.net || '').trim()).filter(Boolean)).size;
}

/** Paper 9d summary line under the import filename. */
export function codeframeImportSummary(
  parsed: CodeframeImportParsed,
  current: Array<Pick<CodeframeTheme, 'id' | 'label'>>
): string {
  const codes = Array.isArray(parsed.codes) ? parsed.codes : [];
  const codeCount = Number(parsed.code_count) || codes.length;
  const netCount = Number(parsed.net_count) || countCodeframeNets(codes);
  const { matched, newCount } = matchImportedThemes(codes, current);
  const nets = netCount
    ? `${codeCount} code${codeCount === 1 ? '' : 's'}, ${netCount} net${netCount === 1 ? '' : 's'}`
    : `${codeCount} code${codeCount === 1 ? '' : 's'}`;
  return `${nets}. ${matched} match current themes, ${newCount} ${
    newCount === 1 ? 'is' : 'are'
  } new.`;
}

/** Union current + imported; matching ids/labels take the imported theme. */
export function mergeCodeframeThemes(
  current: CodeframeTheme[],
  imported: CodeframeTheme[]
): CodeframeTheme[] {
  const byKey = new Map<string, CodeframeTheme>();
  for (const theme of current) {
    const key = themeKey(theme);
    if (key) byKey.set(key, { ...theme });
  }
  for (const theme of imported) {
    const key = themeKey(theme);
    if (!key) continue;
    const labelKey = `label:${String(theme.label || '')
      .trim()
      .toLowerCase()}`;
    let replaced = false;
    if (byKey.has(key)) {
      byKey.set(key, { ...theme });
      replaced = true;
    } else if (labelKey !== 'label:' && byKey.has(labelKey)) {
      byKey.set(labelKey, { ...theme });
      replaced = true;
    }
    if (!replaced) byKey.set(key, { ...theme });
  }
  return [...byKey.values()];
}

export function codesForImportMode(
  mode: CodeframeImportMode,
  imported: CodeframeTheme[],
  current: CodeframeTheme[]
): CodeframeTheme[] {
  if (mode === 'merge') return mergeCodeframeThemes(current, imported);
  return imported.map(theme => ({ ...theme }));
}

/** Keep pre-coded answers goes through import-frame apply so assignments map correctly. */
export function shouldUseImportFrameApply(mode: CodeframeImportMode): boolean {
  return mode === 'keep_precoded';
}
