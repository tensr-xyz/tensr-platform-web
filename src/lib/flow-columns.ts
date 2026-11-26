/** Columns the ANOVA dependent list may offer. A numeric companion stays even when the preview type is text. */

import { labelledMeasure, orderedValueLabels } from '@/lib/measure-level';

export type FlowColumn = {
  name: string;
  label?: string | null;
  type?: string;
  measure?: string;
  measure_source?: string | null;
  role?: string | null;
  linked_set?: string | null;
  value_labels?: Record<string, string> | null;
  /** Distinct non-blank values. Stub/banner pickers use this for unlabelled text. */
  n_unique?: number | null;
  n_rows?: number | null;
  /** Open-end coding: the verbatim column this themes variable came from. */
  source_text_column?: string | null;
  coded_multi?: boolean;
  multi_response?: boolean;
  code_delimiter?: string | null;
  codeframe?: { source_text_column?: string | null; codes?: unknown } | null;
};

/** Distinct values at or below this count stay stub/banner categories when unlabelled. */
export const TABLE_TEXT_CATEGORY_MAX = 100;

/** Unlabelled string with few distinct values: a category, not an open end. */
export function isTableTextCategorical(
  column: {
    type?: string | null;
    value_labels?: Record<string, string> | null;
    labels?: Record<string, string> | null;
    n_unique?: number | null;
    n_rows?: number | null;
  },
  nRows?: number | null
): boolean {
  const type = String(column.type || '').toLowerCase();
  if (type === 'text') return false;
  if (type !== 'string' && type !== 'categorical') return false;
  const labels = column.value_labels || column.labels || {};
  if (Object.keys(labels).length > 0) return true;
  const nUnique = Number(column.n_unique);
  if (!Number.isFinite(nUnique) || nUnique < 1) return false;
  if (nUnique > TABLE_TEXT_CATEGORY_MAX) return false;
  const rows = Number(nRows ?? column.n_rows);
  if (Number.isFinite(rows) && rows >= 20 && nUnique >= rows / 2) return false;
  return true;
}

export function isDependentColumn(column: FlowColumn): boolean {
  const name = column.name.trim();
  if (!name) return false;
  if (String(column.role || '').toLowerCase() === 'weight') return false;
  if (name.endsWith('_numeric')) return true;
  const measure = String(column.measure || '').toLowerCase();
  if (measure === 'nominal') return false;
  if (measure === 'scale' || measure === 'ordinal') return true;
  const type = String(column.type || '').toLowerCase();
  return type === 'numeric' || type === 'number' || type === 'float' || type === 'double';
}

export function dependentColumns(columns: FlowColumn[]): string[] {
  return columns
    .filter(column => column.name && isDependentColumn(column))
    .map(column => column.name);
}

/** Agent and apply coding store themes as `*_codes` or `*_themes`. */
export function isCodedColumnName(name: string): boolean {
  const trimmed = String(name || '').trim();
  return trimmed.endsWith('_codes') || trimmed.endsWith('_themes');
}

/** Single-code first-theme columns from open-end coding. */
export function isMainThemeColumnName(name: string): boolean {
  return /_first_theme$/i.test(String(name || '').trim());
}

const THEME_LABEL_SUFFIX_RE =
  /(?:\s+themes(?:\s*\((?:all mentioned|main theme)\))?|\s+first theme)\s*$/i;

/** Strip a previous themes / first-theme suffix so a distinct one can be attached. */
export function themeQuestionStem(label: string): string {
  return String(label || '')
    .replace(THEME_LABEL_SUFFIX_RE, '')
    .trim();
}

/** True when a coded open end stores every mentioned theme (pipe-joined). */
export function isCodedMultiThemeColumn(
  column: Pick<
    FlowColumn,
    'name' | 'label' | 'coded_multi' | 'multi_response' | 'source_text_column' | 'codeframe'
  >
): boolean {
  if (isMainThemeColumnName(column.name)) return false;
  const label = String(column.label || '');
  if (/\bfirst theme$/i.test(label) || /\bthemes \(main theme\)$/i.test(label)) {
    return false;
  }
  if (column.coded_multi || column.multi_response) return true;
  if (isCodedColumnName(column.name)) return true;
  // Open-end coding defaults to multi-response when flags are absent.
  return true;
}

/**
 * Outline title for a coded themes column. Single vs multi always differ, including
 * older files that still store the same ``…themes`` label on both.
 */
export function outlineCodedThemeLabel(
  column: Pick<
    FlowColumn,
    'name' | 'label' | 'source_text_column' | 'coded_multi' | 'multi_response' | 'codeframe'
  >
): string {
  const raw = String(column.label || column.name || '').trim();
  if (!isCodedOpenEndColumn(column) && !isMainThemeColumnName(column.name)) {
    return raw;
  }
  const multi = isCodedMultiThemeColumn(column);
  const suffix = multi ? 'themes (all mentioned)' : 'themes (main theme)';
  if (multi && /\bthemes \(all mentioned\)$/i.test(raw)) return raw;
  if (!multi && /\bthemes \(main theme\)$/i.test(raw)) return raw;
  const stem = themeQuestionStem(raw);
  if (!stem || stem === column.name) return suffix[0].toUpperCase() + suffix.slice(1);
  return `${stem} ${suffix}`;
}

/** A themes / code-frame column the Themes screen and Variable rail can open. */
export function isCodedOpenEndColumn(
  column: Pick<
    FlowColumn,
    'name' | 'label' | 'source_text_column' | 'coded_multi' | 'multi_response' | 'codeframe'
  >
): boolean {
  const name = String(column.name || '').trim();
  if (!name) return false;
  if (isCodedColumnName(name) || isMainThemeColumnName(name)) return true;
  if (String(column.label || '').startsWith('Codes for')) return true;
  if (String(column.source_text_column || '').trim()) return true;
  if (column.coded_multi || column.multi_response) return true;
  const frame = column.codeframe;
  if (frame && typeof frame === 'object') return true;
  return false;
}

/** Verbatim column for a coded themes variable. Prefers stored metadata over the name suffix. */
export function sourceTextColumnFor(
  column: Pick<FlowColumn, 'name' | 'source_text_column' | 'codeframe'>,
  columns: { name: string }[] = []
): string {
  const direct = String(column.source_text_column || '').trim();
  if (direct) return direct;
  const frame = column.codeframe;
  if (frame && typeof frame === 'object') {
    const fromFrame = String(frame.source_text_column || '').trim();
    if (fromFrame) return fromFrame;
  }
  const name = String(column.name || '').trim();
  if (name.endsWith('_codes')) {
    const source = name.slice(0, -'_codes'.length);
    if (!columns.length || columns.some(item => item.name === source)) return source;
    return source;
  }
  if (name.endsWith('_themes')) {
    const source = name.slice(0, -'_themes'.length);
    if (!columns.length || columns.some(item => item.name === source)) return source;
    return source;
  }
  if (isMainThemeColumnName(name)) {
    const source = name.replace(/_first_theme$/i, '');
    if (!columns.length || columns.some(item => item.name === source)) return source;
    return source;
  }
  return name;
}

/** Text open ends only. Numeric and already-coded columns stay out of the code frame. */
export function isOpenEndColumn(column: FlowColumn): boolean {
  const name = column.name.trim();
  if (!name || isCodedColumnName(name) || isCodedOpenEndColumn(column)) return false;
  const type = String(column.type || '').toLowerCase();
  if (
    type === 'numeric' ||
    type === 'number' ||
    type === 'float' ||
    type === 'double' ||
    type === 'id'
  ) {
    return false;
  }
  const measure = String(column.measure || '').toLowerCase();
  if (measure === 'scale' || measure === 'ordinal') return false;
  return type === 'string' || type === 'text' || type === '' || measure === 'nominal';
}

export function openEndColumns(columns: FlowColumn[]): string[] {
  return columns
    .filter(column => column.name && isOpenEndColumn(column))
    .map(column => column.name);
}

/** System columns stay out of every picker: row ids, coding scratch, and stored theme codes. */
export function isInternalColumn(name: unknown): boolean {
  if (typeof name !== 'string') return true;
  const trimmed = name.trim();
  return (
    !trimmed || trimmed.startsWith('_') || trimmed.endsWith('_coding') || trimmed.endsWith('_codes')
  );
}

/** Admin / system fields by name or label (Submitted On, ResponseId, …), even without a role. */
const ADMIN_FIELD_RE =
  /^(response|respondent|record|case|participant|panel|user|row|serial|unique)?(id|uuid|no|number|serial)$|^(respondent|pid|psid|panelid|respid)$|^(start|end|recorded|submitted)(date|on|at)?$|^(ip|location)(address|latitude|longitude)?$|^(status|progress|finished|duration.*|distributionchannel|userlanguage|recipient(lastname|firstname|email)|external(data)?reference|tags?|tickets?|q_recaptchascore|q_relevantid.*|meta_.*)$/i;

const OTHER_SPECIFY_RE = /\bother\b.*\b(please\s+)?specify\b|\bother\s+choice\b|\bother\b\s*$/i;

function fieldKey(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/** True for Qualtrics admin columns and similar system fields. */
export function isAdminField(name: string, label = ''): boolean {
  if (!name.trim()) return false;
  return ADMIN_FIELD_RE.test(fieldKey(name)) || ADMIN_FIELD_RE.test(fieldKey(label));
}

/** Free-text "Other Choice" / "Other (please specify)" columns stay off the stub picker. */
export function isOtherSpecifyField(name: string, label = ''): boolean {
  return OTHER_SPECIFY_RE.test(name) || OTHER_SPECIFY_RE.test(label);
}

/** Split "Question - Option" / "Question: Option" labels into left and right. */
export function labelAxisParts(label: string): [string, string] | null {
  const text = String(label || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!text) return null;
  for (const sep of [' - ', ' ~ ', ': ', ' – ', ' — ', ':'] as const) {
    if (!text.includes(sep)) continue;
    const [left, right] = text.split(sep, 2).map(part => part.trim());
    if (left && right) return [left, right];
  }
  return null;
}

/** Shared left = Qualtrics stem; shared right = brand-prefix question. */
export type AxisOrientation = 'left_stem' | 'right_stem';

export function axisOrientation(labels: string[]): AxisOrientation | null {
  const parts = labels.map(label => labelAxisParts(label));
  if (parts.length < 2 || parts.some(part => part == null)) return null;
  const lefts = new Set(parts.map(part => part![0].toLowerCase()));
  const rights = new Set(parts.map(part => part![1].toLowerCase()));
  if (lefts.size === 1 && rights.size > 1) return 'left_stem';
  if (rights.size === 1 && lefts.size > 1) return 'right_stem';
  return null;
}

export function orientedStemItem(
  label: string,
  orientation: AxisOrientation | null = null
): [string, string] | null {
  const parts = labelAxisParts(label);
  if (!parts) return null;
  if (orientation === 'right_stem') return [parts[1], parts[0]];
  return parts;
}

export function sharedAxisStem(labels: string[]): string {
  const orientation = axisOrientation(labels);
  const stems = labels
    .map(label => orientedStemItem(label, orientation))
    .filter((part): part is [string, string] => part != null)
    .map(part => part[0]);
  if (!orientation || stems.length < 2) return '';
  const first = stems[0];
  if (!stems.every(stem => stem.toLowerCase() === first.toLowerCase())) return '';
  return first;
}

export function pickerColumns<
  T extends { name: string; label?: string | null; role?: string | null },
>(columns: T[]): T[] {
  return columns.filter(column => {
    if (!column || typeof column.name !== 'string' || isInternalColumn(column.name)) return false;
    const role = String(column.role || '').toLowerCase();
    if (role === 'stacked_source' || role === 'helper' || role === 'system' || role === 'admin') {
      return false;
    }
    if (isAdminField(column.name, String(column.label || ''))) return false;
    return true;
  });
}

export type OutlineSet = {
  id?: string;
  name?: string;
  label?: string;
  kind?: string;
  columns?: string[];
  items?: { column?: string; label?: string }[];
  text_columns?: { column?: string; label?: string }[];
  summary?: string;
};

export type OutlineQuestion = {
  key: string;
  label: string;
  kind: string;
  columns: string[];
  /** Value for Tables stub/banner: set name when collapsed, else the column. */
  stubValue?: string;
  /** First column used for measure override when the unit is a single question. */
  measureColumn?: string;
  /** Extra search text (set item labels) so stub/banner search hits brands inside a set. */
  keywords?: string;
};

export type OutlineSetWithStructure = OutlineSet & { structure?: string };

/** Outline pill for a stored set: open-end boxes, grids, and multi-selects. */
function outlineSetKind(
  set: OutlineSetWithStructure,
  members: string[],
  kinds: Record<string, string>
): string {
  const structure = String(set.structure || '').toLowerCase();
  if (structure === 'open_end') return 'open';
  if (set.kind === 'grid') return 'grid';
  if (set.kind === 'multiple_response' || set.kind === 'brand_list') return 'multi';
  return kinds[members[0]] || 'multi';
}

/** Stem title when every dichotomy carries ``Stem: A / B / C`` (identical labels). */
function slashJoinedStem(label: string): string | null {
  const parts = labelAxisParts(label);
  if (!parts || !parts[1].includes(' / ')) return null;
  const brands = parts[1]
    .split(' / ')
    .map(piece => piece.trim())
    .filter(Boolean);
  if (brands.length < 2 || parts[0].length < 8) return null;
  return parts[0];
}

/** Infer multi-select / grid groups from shared stem labels when sets are missing. */
function inferredLabelSets(columns: FlowColumn[]): OutlineSetWithStructure[] {
  const candidates: { name: string; label: string; parts: [string, string] }[] = [];
  for (const column of columns) {
    // Coded theme columns share a stem on purpose (single vs multi). Keep them separate.
    if (isCodedOpenEndColumn(column) || isMainThemeColumnName(column.name)) continue;
    const label = String(column.label || column.name || '');
    if (isOtherSpecifyField(column.name, label)) continue;
    const parts = labelAxisParts(label);
    if (!parts) continue;
    // Numbered form boxes ("Question - 1") are open-end slots, not tick-box options.
    if (/^\d+$/.test(parts[1])) continue;
    candidates.push({ name: column.name, label, parts });
  }

  const buckets = new Map<string, { stem: string; members: string[] }>();
  const claimed = new Set<string>();

  // Qualtrics: shared left stem (long enough to be question text).
  const leftGroups = new Map<string, typeof candidates>();
  for (const entry of candidates) {
    if (entry.parts[0].length < 12) continue;
    const key = entry.parts[0].toLowerCase();
    const group = leftGroups.get(key) || [];
    group.push(entry);
    leftGroups.set(key, group);
  }
  for (const group of leftGroups.values()) {
    const rights = new Set(group.map(entry => entry.parts[1].toLowerCase()));
    if (group.length < 2 || rights.size <= 1) continue;
    const stem = group[0].parts[0];
    buckets.set(`left:${stem.toLowerCase()}`, {
      stem,
      members: group.map(entry => entry.name),
    });
    for (const entry of group) claimed.add(entry.name);
  }

  // Brand-prefix: shared right question, distinct brand on the left.
  const rightGroups = new Map<string, typeof candidates>();
  for (const entry of candidates) {
    if (claimed.has(entry.name) || entry.parts[1].length < 12) continue;
    const key = entry.parts[1].toLowerCase();
    const group = rightGroups.get(key) || [];
    group.push(entry);
    rightGroups.set(key, group);
  }
  for (const group of rightGroups.values()) {
    const lefts = new Set(group.map(entry => entry.parts[0].toLowerCase()));
    if (group.length < 2 || lefts.size <= 1) continue;
    const stem = group[0].parts[1];
    buckets.set(`right:${stem.toLowerCase()}`, {
      stem,
      members: group.map(entry => entry.name),
    });
    for (const entry of group) claimed.add(entry.name);
  }

  // Identical labels (often ``Stem: Brand A / Brand B / …`` on every dichotomy).
  const identicalGroups = new Map<string, { stem: string; members: string[] }>();
  for (const column of columns) {
    if (claimed.has(column.name)) continue;
    if (isCodedOpenEndColumn(column) || isMainThemeColumnName(column.name)) continue;
    const label = String(column.label || '')
      .trim()
      .replace(/\s+/g, ' ');
    if (!label || label.length < 8 || isOtherSpecifyField(column.name, label)) continue;
    const stem = slashJoinedStem(label) || label;
    const key = label.toLowerCase();
    const group = identicalGroups.get(key) || { stem, members: [] };
    group.members.push(column.name);
    identicalGroups.set(key, group);
  }
  for (const group of identicalGroups.values()) {
    if (group.members.length < 2) continue;
    buckets.set(`identical:${group.stem.toLowerCase()}`, {
      stem: group.stem,
      members: group.members,
    });
  }

  const byName = new Map(columns.map(column => [column.name, column]));
  const sets: OutlineSetWithStructure[] = [];
  for (const bucket of buckets.values()) {
    const members = [...new Set(bucket.members)];
    if (members.length < 2) continue;
    const memberLabels = members.map(name => {
      const column = byName.get(name);
      return String(column?.label || column?.name || name);
    });
    const orientation = axisOrientation(memberLabels);
    const items = members.map((name, index) => {
      const label = memberLabels[index];
      const oriented = orientedStemItem(label, orientation);
      return { column: name, label: oriented ? oriented[1] : label };
    });
    sets.push({
      id: `label:${bucket.stem}`,
      name: bucket.stem,
      label: bucket.stem,
      kind: 'multiple_response',
      columns: members,
      items,
    });
  }
  return sets;
}

/** True when name, role, or label marks the column as a survey weight (not a question). */
export function looksLikeWeightColumn(
  column: Pick<FlowColumn, 'name' | 'label' | 'role'>
): boolean {
  const name = String(column.name || '')
    .trim()
    .toLowerCase();
  if (!name) return false;
  if (String(column.role || '').toLowerCase() === 'weight') return true;
  if (
    name === 'weight' ||
    name === 'wt' ||
    name === 'wgt' ||
    name === 'wght' ||
    name.endsWith('_wt')
  ) {
    return true;
  }
  if (name.includes('weight')) return true;
  return String(column.label || '')
    .toLowerCase()
    .includes('weight');
}

/** Sentence-case a leading lowercase letter on set titles. */
function sentenceCaseStem(label: string): string {
  const text = label.trim().replace(/\s+/g, ' ');
  if (!text) return text;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (/[A-Za-z]/.test(character)) {
      if (character === character.toLowerCase()) {
        return text.slice(0, index) + character.toUpperCase() + text.slice(index + 1);
      }
      return text;
    }
  }
  return text;
}

/** True when a multi-set title is a short question fragment needing brand tails. */
function incompleteMultiStem(stem: string): boolean {
  const text = stem
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.?…]+$/, '');
  if (!text || stem.trim().endsWith('?')) return false;
  const words = text.split(/\s+/);
  if (words.length <= 5) return true;
  return ['of', 'about', 'for', 'to', 'a', 'an', 'the', 'in', 'on', 'with'].includes(
    words[words.length - 1].toLowerCase()
  );
}

/** Outline title for a multi set: stem plus brands when the stored label is a fragment. */
function outlineMultiSetLabel(set: OutlineSetWithStructure, fallback: string): string {
  const raw = String(set.label || set.name || fallback).trim();
  const stem = sentenceCaseStem(raw);
  if (!incompleteMultiStem(stem)) return stem || fallback;
  const brands = (set.items || [])
    .map(item => String(item.label || '').trim())
    .filter(label => label && label.toLowerCase() !== stem.toLowerCase() && label.length <= 48);
  if (brands.length < 2) return stem || fallback;
  const shown = brands.slice(0, 8);
  const joined = shown.join(', ') + (brands.length > shown.length ? ', …' : '');
  return `${stem.replace(/[.…]+$/, '')}…? (${joined})`;
}

/** One outline row per question in file order; sets collapse; admin and ids stay out. */
export function questionnaireOutline(
  columns: FlowColumn[],
  sets: OutlineSetWithStructure[] = [],
  options: { weightName?: string; kinds?: Record<string, string> } = {}
): OutlineQuestion[] {
  const weightName = String(options.weightName || '').trim();
  const kinds = options.kinds || {};
  const visible = pickerColumns(columns).filter(column => {
    if (column.name === weightName || looksLikeWeightColumn(column)) return false;
    if (column.linked_set) return false;
    if (isIdColumn(column.name) || isIdColumn(String(column.label || ''))) return false;
    if (isOtherSpecifyField(column.name, String(column.label || ''))) return false;
    return true;
  });
  const byName = new Map(visible.map(column => [column.name, column]));
  const covered = new Set<string>();
  const linkedText = new Set<string>();
  const setByColumn = new Map<string, { set: OutlineSetWithStructure; members: string[] }>();
  const effectiveSets = sets.length ? sets : inferredLabelSets(visible);

  for (const set of effectiveSets) {
    // Data Preparation is a folder for flag columns, not a questionnaire question.
    const setId = String(set.id || '').toLowerCase();
    const setLabel = String(set.label || set.name || '').toLowerCase();
    if (setId === 'data_preparation' || setLabel === 'data preparation') continue;
    const members = (set.columns || []).map(name => String(name)).filter(name => byName.has(name));
    for (const text of set.text_columns || []) {
      const name = String(text.column || '');
      if (name) linkedText.add(name);
    }
    if (members.length < 2) continue;
    for (const name of members) {
      if (!setByColumn.has(name)) {
        setByColumn.set(name, { set, members });
      }
    }
  }

  const units: OutlineQuestion[] = [];
  for (const column of visible) {
    if (covered.has(column.name) || linkedText.has(column.name)) continue;
    const found = setByColumn.get(column.name);
    if (found) {
      if (found.members.some(name => covered.has(name))) {
        covered.add(column.name);
        continue;
      }
      found.members.forEach(name => covered.add(name));
      for (const text of found.set.text_columns || []) {
        const name = String(text.column || '');
        if (name) covered.add(name);
      }
      const fallback =
        byName.get(found.members[0])?.label || found.members[0] || found.set.name || '';
      const setKind = outlineSetKind(found.set, found.members, kinds);
      const setLabel =
        setKind === 'multi'
          ? outlineMultiSetLabel(found.set, String(fallback))
          : sentenceCaseStem(String(found.set.label || found.set.name || fallback)) ||
            String(fallback);
      const setName = String(found.set.name || found.set.label || found.members[0]);
      const itemKeywords = (found.set.items || [])
        .map(item => String(item.label || '').trim())
        .filter(Boolean);
      const memberKeywords = found.members
        .map(name => String(byName.get(name)?.label || '').trim())
        .filter(Boolean);
      const keywords = [...itemKeywords, ...memberKeywords].join(' ');
      units.push({
        key: String(found.set.id || found.set.name || found.members[0]),
        label: setLabel,
        kind: setKind,
        columns: found.members,
        stubValue: setName,
        ...(keywords ? { keywords } : {}),
      });
      continue;
    }
    const outlineLabel =
      isCodedOpenEndColumn(column) || isMainThemeColumnName(column.name)
        ? outlineCodedThemeLabel(column)
        : String(column.label || column.name);
    units.push({
      key: column.name,
      label: outlineLabel,
      kind: kinds[column.name] || questionKind(column, []),
      columns: [column.name],
      stubValue: column.name,
      measureColumn: column.name,
    });
  }
  return units;
}

/** Stub / banner picker rows: one entry per question or set (labels only). */
export function tableStubPickerOptions(
  columns: FlowColumn[],
  sets: OutlineSetWithStructure[] = [],
  weights: string[] = []
): { value: string; label: string; keywords?: string }[] {
  const weightName = weights.find(name => Boolean(name)) || '';
  const outline = questionnaireOutline(columns, sets, { weightName });
  return outline
    .filter(item => item.kind !== 'open')
    .map(item => ({
      value: String(item.stubValue || item.columns[0] || item.key),
      label: item.label,
      ...(item.keywords ? { keywords: item.keywords } : {}),
    }))
    .filter(item => item.value);
}

/** Coded open ends for the Theme picker. The value is the stored codes column, the label its open end. */
export function themeColumns(
  columns: Array<
    Pick<
      FlowColumn,
      'name' | 'label' | 'source_text_column' | 'coded_multi' | 'multi_response' | 'codeframe'
    >
  >
): { value: string; label: string }[] {
  return columns
    .filter(column => isCodedOpenEndColumn(column))
    .map(column => {
      const source = sourceTextColumnFor(column, columns);
      const sourceColumn = columns.find(item => item.name === source);
      const own = themeQuestionStem(String(column.label || '').replace(/^Codes for\s+/i, ''));
      const ownIsStoredName =
        !own ||
        own === column.name ||
        own === source ||
        own === `${source} themes` ||
        own === `${source} first theme` ||
        own === `${source} themes (all mentioned)` ||
        own === `${source} themes (main theme)`;
      const sourceLabel = String(sourceColumn?.label || '').trim();
      const label = !ownIsStoredName
        ? own
        : sourceLabel && sourceLabel !== source
          ? sourceLabel
          : source;
      return { value: column.name, label };
    });
}

/** True when a short integer run may be shown as a rating scale pill. */
function looksLikeRatingScale(
  column: FlowColumn,
  min: number,
  max: number,
  distinct: number
): boolean {
  if (!((min === 0 || min === 1) && (max === 5 || max === 7 || max === 10) && distinct >= 3)) {
    return false;
  }
  const measure = String(column.measure || '').toLowerCase();
  // Named places and brands are never a rating scale, even on a 1–5 code run.
  if (measure === 'nominal') return false;
  const valueLabels = column.value_labels || {};
  const labelKeys = Object.keys(valueLabels);
  if (labelKeys.length >= 2) {
    const map: Record<string, string> = {};
    for (const key of labelKeys) map[key] = String(valueLabels[key] ?? '');
    // Unordered labelled codes (Region, profession) stay single choice.
    if (labelledMeasure(map) === 'nominal') return false;
    if (measure === 'ordinal' || measure === 'scale') return true;
    return orderedValueLabels(map);
  }
  // Unlabelled short integer runs (trust 1–5) stay a scale.
  return measure === 'scale' || measure === 'ordinal' || measure === '';
}

/** The question type for an outline pill: single, multi, scale with its range, numeric, or open. */
export function questionKind(
  column: FlowColumn & { coded_multi?: boolean },
  values: unknown[],
  multiNames: Set<string> = new Set()
): string {
  if (column.coded_multi || multiNames.has(column.name)) return 'multi';
  const labels = Object.keys(column.value_labels || {});
  const seen = values
    .map(value => (value == null ? '' : String(value).trim()))
    .filter(value => value !== '' && value !== 'null' && value !== 'nan');
  const numbers = seen.map(Number).filter(value => Number.isFinite(value));
  const codes = labels.length ? labels.map(Number).filter(Number.isFinite) : numbers;
  const integers = codes.length > 0 && codes.every(value => Number.isInteger(value));
  const distinct = new Set(codes).size;
  const type = String(column.type || '').toLowerCase();
  const measure = String(column.measure || '').toLowerCase();
  if (integers && (labels.length > 0 || numbers.length === seen.length)) {
    const min = Math.min(...codes);
    const max = Math.max(...codes);
    if ((min === 0 || min === 1) && distinct <= 2 && max <= 1) return 'single';
    if (looksLikeRatingScale(column, min, max, distinct)) {
      return `scale ${min}-${max}`;
    }
    if (labels.length || distinct <= 12) return 'single';
  }
  if (labels.length) return 'single';
  if (['numeric', 'number', 'float', 'integer', 'double'].includes(type)) {
    // Mistyped open ends (numeric storage, nominal measure, many distinct values).
    if (measure === 'nominal') {
      const nUnique = Number(column.n_unique);
      if (Number.isFinite(nUnique) && nUnique > 12) return 'open';
      if (seen.length && new Set(seen).size > 12) return 'open';
      return 'single';
    }
    return 'numeric';
  }
  const nUniqueMeta = Number(column.n_unique);
  // Prefer metadata uniqueness over a sparse preview page for free-text open ends.
  if (
    (type === 'string' || type === 'text' || type === '') &&
    Number.isFinite(nUniqueMeta) &&
    nUniqueMeta > 12
  ) {
    return 'open';
  }
  const unique = new Set(seen).size;
  if (
    seen.length &&
    unique <= 12 &&
    unique < seen.length / 2 &&
    (!Number.isFinite(nUniqueMeta) || nUniqueMeta <= 12)
  ) {
    return 'single';
  }
  // Short unlabelled lists (gender, region) stay single; wider text stays open.
  if (isTableTextCategorical(column) && Number.isFinite(nUniqueMeta) && nUniqueMeta <= 12) {
    return 'single';
  }
  return 'open';
}

/** A respondent or record id: by name, or because every loaded value is different. */
export function isIdColumn(name: string, values: unknown[] = []): boolean {
  if (!name.trim()) return false;
  if (isInternalColumn(name)) return true;
  const key = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
  if (
    /^(resp|respondent|record|case|response|participant|panel|user|row|serial|unique)?(id|uuid|no|number|serial)$/.test(
      key
    ) ||
    /^(respondent|pid|psid|panelid|respid)$/.test(key) ||
    /(^|[_\s-])id$/i.test(name.trim())
  ) {
    return true;
  }
  const seen = values
    .map(value => (value == null ? '' : String(value).trim()))
    .filter(value => value !== '' && value !== 'null');
  return seen.length >= 20 && new Set(seen).size === seen.length;
}
