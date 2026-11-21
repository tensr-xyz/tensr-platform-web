/** Columns the ANOVA dependent list may offer. A numeric companion stays even when the preview type is text. */

export type FlowColumn = {
  name: string;
  label?: string | null;
  type?: string;
  measure?: string;
  measure_source?: string | null;
  role?: string | null;
  linked_set?: string | null;
  value_labels?: Record<string, string> | null;
};

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

/** Text open ends only. Numeric and already-coded columns stay out of the code frame. */
export function isOpenEndColumn(column: FlowColumn): boolean {
  const name = column.name.trim();
  if (!name || name.endsWith('_codes')) return false;
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

/** Split "Question - Option" / "Question: Option" labels into stem and option. */
export function labelAxisParts(label: string): [string, string] | null {
  const text = String(label || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!text) return null;
  for (const sep of [' - ', ': ', ' – ', ' — ', ':'] as const) {
    if (!text.includes(sep)) continue;
    const [left, right] = text.split(sep, 2).map(part => part.trim());
    if (left && right) return [left, right];
  }
  return null;
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

/** Infer multi-select / grid groups from shared "Question - Option" labels when sets are missing. */
function inferredLabelSets(columns: FlowColumn[]): OutlineSetWithStructure[] {
  const buckets = new Map<string, { stem: string; members: string[] }>();
  for (const column of columns) {
    const label = String(column.label || column.name || '');
    if (isOtherSpecifyField(column.name, label)) continue;
    const parts = labelAxisParts(label);
    if (!parts || parts[0].length < 12) continue;
    // Numbered form boxes ("Question - 1") are open-end slots, not tick-box options.
    if (/^\d+$/.test(parts[1])) continue;
    const key = parts[0].toLowerCase();
    const bucket = buckets.get(key);
    if (bucket) bucket.members.push(column.name);
    else buckets.set(key, { stem: parts[0], members: [column.name] });
  }
  const sets: OutlineSetWithStructure[] = [];
  for (const bucket of buckets.values()) {
    const members = [...new Set(bucket.members)];
    if (members.length < 2) continue;
    sets.push({
      id: `label:${bucket.stem}`,
      name: bucket.stem,
      label: bucket.stem,
      kind: 'multiple_response',
      columns: members,
    });
  }
  return sets;
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
    if (column.name === weightName || column.name.toLowerCase() === 'weight') return false;
    if (String(column.role || '').toLowerCase() === 'weight') return false;
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
      const setLabel = String(
        found.set.label || found.set.name || byName.get(found.members[0])?.label || found.members[0]
      );
      const setName = String(found.set.name || found.set.label || found.members[0]);
      units.push({
        key: String(found.set.id || found.set.name || found.members[0]),
        label: setLabel,
        kind: outlineSetKind(found.set, found.members, kinds),
        columns: found.members,
        stubValue: setName,
      });
      continue;
    }
    units.push({
      key: column.name,
      label: String(column.label || column.name),
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
): { value: string; label: string }[] {
  const weightName = weights.find(name => Boolean(name)) || '';
  const outline = questionnaireOutline(columns, sets, { weightName });
  return outline
    .filter(item => item.kind !== 'open')
    .map(item => ({
      value: String(item.stubValue || item.columns[0] || item.key),
      label: item.label,
    }))
    .filter(item => item.value);
}

/** Coded open ends for the Theme picker. The value is the stored codes column, the label its open end. */
export function themeColumns(
  columns: { name: string; label?: string | null }[]
): { value: string; label: string }[] {
  return columns
    .filter(column => column.name.endsWith('_codes'))
    .map(column => {
      const source = column.name.replace(/_codes$/, '');
      const sourceColumn = columns.find(item => item.name === source);
      const own = String(column.label || '')
        .replace(/^Codes for\s+/i, '')
        .trim();
      const ownIsStoredName = !own || own === column.name || own === source;
      const sourceLabel = String(sourceColumn?.label || '').trim();
      const label = !ownIsStoredName
        ? own
        : sourceLabel && sourceLabel !== source
          ? sourceLabel
          : source;
      return { value: column.name, label };
    });
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
  if (integers && numbers.length === seen.length) {
    const min = Math.min(...codes);
    const max = Math.max(...codes);
    if ((min === 0 || min === 1) && distinct <= 2 && max <= 1) return 'single';
    if ((min === 0 || min === 1) && (max === 5 || max === 7 || max === 10) && distinct >= 3) {
      return `scale ${min}-${max}`;
    }
    if (distinct <= 12) return 'single';
  }
  if (labels.length) return 'single';
  if (['numeric', 'number', 'float', 'integer', 'double'].includes(type)) return 'numeric';
  const unique = new Set(seen).size;
  if (seen.length && unique <= 12 && unique < seen.length / 2) return 'single';
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
