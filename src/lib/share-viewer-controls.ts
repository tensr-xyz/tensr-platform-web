/** Viewer filters and saved views on a shared output (published-report controls). */

export type ViewerControlType = 'dropdown' | 'listbox' | 'date' | 'text';

export type ViewerControl = {
  id: string;
  type: ViewerControlType;
  column: string;
  label: string;
  allLabel: string;
  values: string[];
  valueLabels: Record<string, string>;
  hideFromViewers: boolean;
  multi: boolean;
};

export type ViewerControlOption = { value: string; label: string };

export type PublicViewerControl = {
  id: string;
  type: ViewerControlType;
  column: string;
  label: string;
  allLabel: string;
  multi: boolean;
  options: ViewerControlOption[];
};

export type SavedViewerView = {
  id: string;
  name: string;
  values: Record<string, unknown>;
};

export type ShareViewerConfig = {
  viewerControls: ViewerControl[];
  exploreMode: boolean;
  exploreHiddenColumns: string[];
  savedViews: SavedViewerView[];
};

export const DEFAULT_ALL_LABEL = '(All)';

const CONTROL_TYPES = new Set<ViewerControlType>(['dropdown', 'listbox', 'date', 'text']);

function cleanText(value: unknown, limit = 200): string {
  return String(value ?? '')
    .trim()
    .slice(0, limit);
}

function asStringList(raw: unknown, limit = 500): string[] {
  if (raw == null) return [];
  if (typeof raw === 'string') {
    const text = raw.trim();
    return text ? [text] : [];
  }
  if (!Array.isArray(raw)) {
    const text = cleanText(raw, 120);
    return text ? [text] : [];
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const text = cleanText(item, 120);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeControl(raw: unknown): ViewerControl | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  let kind = String(source.type || source.kind || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (['combo', 'combo_box', 'combobox', 'select'].includes(kind)) kind = 'dropdown';
  else if (['list', 'list_box', 'listbox', 'multi_select'].includes(kind)) kind = 'listbox';
  else if (['date_range', 'daterange'].includes(kind)) kind = 'date';
  else if (['textbox', 'text_box', 'string'].includes(kind)) kind = 'text';
  if (!CONTROL_TYPES.has(kind as ViewerControlType)) return null;
  const column = cleanText(source.column || source.variable || source.field, 120);
  if (!column) return null;
  const label = cleanText(source.label || source.title || column, 120) || column;
  const allLabel = cleanText(source.all_label || source.allLabel, 80) || DEFAULT_ALL_LABEL;
  const valueLabelsRaw = (source.value_labels || source.valueLabels) as
    | Record<string, string>
    | undefined;
  const valueLabels: Record<string, string> = {};
  if (valueLabelsRaw && typeof valueLabelsRaw === 'object') {
    for (const [key, value] of Object.entries(valueLabelsRaw)) {
      const code = cleanText(key, 120);
      const shown = cleanText(value, 200);
      if (code && shown) valueLabels[code] = shown;
    }
  }
  let multi = kind === 'listbox' ? Boolean(source.multi) : false;
  if (kind === 'listbox' && source.multi == null) multi = true;
  return {
    id: cleanText(source.id, 64) || newId('ctrl'),
    type: kind as ViewerControlType,
    column,
    label,
    allLabel,
    values: asStringList(source.values || source.options),
    valueLabels,
    hideFromViewers: Boolean(source.hide_from_viewers || source.hideFromViewers),
    multi,
  };
}

export function normalizeControls(raw: unknown): ViewerControl[] {
  if (!Array.isArray(raw)) return [];
  const out: ViewerControl[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const control = normalizeControl(item);
    if (!control) continue;
    const next = seen.has(control.id) ? { ...control, id: newId('ctrl') } : control;
    seen.add(next.id);
    out.push(next);
    if (out.length >= 24) break;
  }
  return out;
}

export function controlsForViewer(
  controls: ViewerControl[],
  opts?: { exploreMode?: boolean; exploreHiddenColumns?: string[] }
): ViewerControl[] {
  const blocked = new Set((opts?.exploreHiddenColumns || []).map(String).filter(Boolean));
  return controls.filter(control => {
    if (control.hideFromViewers) return false;
    if (opts?.exploreMode && blocked.has(control.column)) return false;
    return true;
  });
}

export function optionLabel(value: string, valueLabels?: Record<string, string> | null): string {
  if (!value) return '';
  const labels = valueLabels || {};
  const shown = labels[value];
  if (shown && shown !== value) return shown;
  if (/^-?\d+\.0+$/.test(value)) {
    const twin = String(parseInt(value, 10));
    if (labels[twin]) return labels[twin];
  }
  return value;
}

export function publicControl(control: ViewerControl): PublicViewerControl {
  return {
    id: control.id,
    type: control.type,
    column: control.column,
    label: control.label,
    allLabel: control.allLabel,
    multi: control.multi,
    options: control.values.map(value => ({
      value,
      label: optionLabel(value, control.valueLabels),
    })),
  };
}

export function isAllSelection(control: Pick<ViewerControl, 'allLabel'>, raw: unknown): boolean {
  if (raw == null) return true;
  const allLabel = control.allLabel || DEFAULT_ALL_LABEL;
  if (typeof raw === 'string' && !raw.trim()) return true;
  if (typeof raw === 'string' && [allLabel, '*', 'all', '(all)', 'All'].includes(raw.trim())) {
    return true;
  }
  if (Array.isArray(raw) && raw.length === 0) return true;
  if (Array.isArray(raw) && raw.length === 1) {
    const only = cleanText(raw[0], 120);
    if ([allLabel, '*', 'all', '(all)', 'All'].includes(only)) return true;
  }
  return false;
}

/** FilterRef clauses from viewer picks (dropdown / listbox / date). Text uses contains client-side. */
export function filterClausesFromSelections(
  controls: ViewerControl[],
  selections: Record<string, unknown> | null | undefined
): Array<Record<string, unknown>> {
  const byId = new Map(controls.map(control => [control.id, control]));
  const picks = selections && typeof selections === 'object' ? selections : {};
  const clauses: Array<Record<string, unknown>> = [];
  for (const [controlId, raw] of Object.entries(picks)) {
    const control = byId.get(controlId);
    if (!control || isAllSelection(control, raw)) continue;
    const { column, type } = control;
    if (!column) continue;
    const allowed = new Set(control.values);
    if (type === 'dropdown' || type === 'listbox') {
      let values = asStringList(raw, 50);
      if (allowed.size) values = values.filter(value => allowed.has(value));
      if (!values.length) continue;
      if (values.length === 1) {
        clauses.push({ column, op: 'equals', value: values[0] });
      } else {
        clauses.push({ column, op: 'in', value: values });
      }
    } else if (type === 'date') {
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const range = raw as Record<string, unknown>;
        const start = cleanText(range.from || range.start, 40);
        const end = cleanText(range.to || range.end, 40);
        if (start && end && start !== end) {
          clauses.push({ column, op: 'between', value: [start, end] });
        } else if (start) {
          clauses.push({ column, op: '>=', value: start });
        } else if (end) {
          clauses.push({ column, op: '<=', value: end });
        }
      } else {
        const start = cleanText(raw, 40);
        if (start) clauses.push({ column, op: '>=', value: start });
      }
    } else if (type === 'text') {
      const needle = cleanText(raw, 200);
      if (needle) clauses.push({ column, op: 'contains', value: needle });
    }
  }
  return clauses;
}

export function filterRefFromSelections(
  controls: ViewerControl[],
  selections: Record<string, unknown> | null | undefined
): { combine: 'and'; filters: Array<Record<string, unknown>> } | null {
  const filters = filterClausesFromSelections(controls, selections).filter(
    clause => clause.op !== 'contains'
  );
  if (!filters.length) return null;
  return { combine: 'and', filters };
}

export function controlsToApi(controls: ViewerControl[]): Array<Record<string, unknown>> {
  return controls.map(control => ({
    id: control.id,
    type: control.type,
    column: control.column,
    label: control.label,
    all_label: control.allLabel,
    values: control.values,
    value_labels: control.valueLabels,
    hide_from_viewers: control.hideFromViewers,
    multi: control.multi,
  }));
}

function optionMap(control: PublicViewerControl): Map<string, string> {
  return new Map(control.options.map(option => [option.value, option.label]));
}

/** Chip text people read: "Region: All" / "Gender: Women". */
export function viewerControlChipText(
  control: PublicViewerControl,
  raw: unknown
): { text: string; active: boolean } {
  const allLabel = control.allLabel || DEFAULT_ALL_LABEL;
  if (isAllSelection({ allLabel }, raw)) {
    return {
      text: `${control.label}: ${allLabel.replace(/^\(|\)$/g, '') || 'All'}`,
      active: false,
    };
  }
  const labels = optionMap(control);
  if (control.type === 'date') {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const range = raw as Record<string, unknown>;
      const start = cleanText(range.from || range.start, 40);
      const end = cleanText(range.to || range.end, 40);
      if (start && end) return { text: `${control.label}: ${start}–${end}`, active: true };
      if (start) return { text: `${control.label}: from ${start}`, active: true };
      if (end) return { text: `${control.label}: to ${end}`, active: true };
    }
    const single = cleanText(raw, 40);
    if (single) return { text: `${control.label}: ${single}`, active: true };
  }
  if (control.type === 'text') {
    const needle = cleanText(raw, 80);
    if (needle) return { text: `${control.label}: ${needle}`, active: true };
  }
  const values = asStringList(raw, 8);
  if (!values.length) {
    return {
      text: `${control.label}: ${allLabel.replace(/^\(|\)$/g, '') || 'All'}`,
      active: false,
    };
  }
  const shown = values.map(value => labels.get(value) || value);
  if (shown.length === 1) return { text: `${control.label}: ${shown[0]}`, active: true };
  if (shown.length === 2)
    return { text: `${control.label}: ${shown[0]}, ${shown[1]}`, active: true };
  return { text: `${control.label}: ${shown.length} selected`, active: true };
}

export function normalizeSavedViews(raw: unknown): SavedViewerView[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedViewerView[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = cleanText(row.id, 64);
    const name = cleanText(row.name, 80);
    if (!id || !name) continue;
    const values =
      row.values && typeof row.values === 'object' && !Array.isArray(row.values)
        ? (row.values as Record<string, unknown>)
        : {};
    out.push({ id, name, values });
    if (out.length >= 40) break;
  }
  return out;
}
