import type { ColumnSlotType } from '@/lib/analysis-column-types';
import { columnSlotType, slotTypeMatchesExpected } from '@/lib/analysis-column-types';
import { categoricalColumnNames } from '@/lib/analysis-definitions';
import type { DatasetPreview, SchemaColumn } from '@/lib/analysis-report-types';
import { tensrApiUrl } from '@/lib/tensr-api-url';
import { getStytchBearerForTensrApi } from '@/utils/auth';

export type SpecParam = {
  name: string;
  type: string;
  role: 'required' | 'default' | 'advanced' | string;
  default: unknown;
  columnTypes?: string[];
  enum?: string[];
  report?: boolean;
  label?: string;
  alias?: string;
  displayDefault?: string;
  allowEmpty?: boolean;
};

export type AnalysisSpec = {
  key: string;
  family: string;
  rReference: string;
  outputs: string[];
  params: SpecParam[];
};

let cachedSpecs: Map<string, AnalysisSpec> | null = null;
let loading: Promise<void> | null = null;

function readString(raw: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string') return value;
  }
  return undefined;
}

function normalizeParam(raw: Record<string, unknown>): SpecParam {
  const columnTypes = raw.columnTypes ?? raw.column_types;
  const displayDefault = readString(raw, 'displayDefault', 'display_default');
  return {
    name: String(raw.name ?? ''),
    type: String(raw.type ?? 'string'),
    role: String(raw.role ?? 'advanced'),
    default: raw.default,
    columnTypes: Array.isArray(columnTypes) ? columnTypes.map(String) : undefined,
    enum: Array.isArray(raw.enum) ? raw.enum.map(String) : undefined,
    report: raw.report === true,
    label: typeof raw.label === 'string' ? raw.label : undefined,
    alias: typeof raw.alias === 'string' ? raw.alias : undefined,
    displayDefault,
    allowEmpty: raw.allowEmpty === true || raw.allow_empty === true,
  };
}

function normalizeSpec(raw: Record<string, unknown>): AnalysisSpec {
  const params = Array.isArray(raw.params) ? raw.params : [];
  const outputs = Array.isArray(raw.outputs) ? raw.outputs : [];
  return {
    key: String(raw.key ?? ''),
    family: String(raw.family ?? ''),
    rReference: readString(raw, 'rReference', 'r_reference') ?? '',
    outputs: outputs.map(String),
    params: params
      .filter((param): param is Record<string, unknown> => Boolean(param) && typeof param === 'object')
      .map(normalizeParam),
  };
}

/** Jest installs a fixture. The app loads GET /datasets/analysis-specs once per session. */
export function installAnalysisSpecs(specs: AnalysisSpec[]): void {
  cachedSpecs = new Map(specs.map(spec => [spec.key, spec]));
  loading = Promise.resolve();
}

export function resetAnalysisSpecs(): void {
  cachedSpecs = null;
  loading = null;
}

export function specFor(key: string): AnalysisSpec | undefined {
  return cachedSpecs?.get(key);
}

export function ensureAnalysisSpecs(): Promise<void> {
  if (cachedSpecs) return Promise.resolve();
  if (loading) return loading;
  const token = getStytchBearerForTensrApi();
  const request = fetch(tensrApiUrl('/datasets/analysis-specs'), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!request || typeof request.then !== 'function') {
    loading = Promise.resolve();
    return loading;
  }
  loading = request
    .then(async response => {
      if (!response.ok) throw new Error(`analysis specs ${response.status}`);
      const body = (await response.json()) as { specs?: unknown };
      const specs = Array.isArray(body.specs) ? body.specs : [];
      cachedSpecs = new Map(
        specs
          .filter((spec): spec is Record<string, unknown> => Boolean(spec) && typeof spec === 'object')
          .map(spec => normalizeSpec(spec))
          .filter(spec => spec.key)
          .map(spec => [spec.key, spec])
      );
    })
    .catch(error => {
      loading = null;
      throw error;
    });
  return loading;
}

export function paramLabel(param: SpecParam): string {
  if (param.label) return param.label;
  return param.name.replace(/_/g, ' ');
}

export function isWeightParam(param: SpecParam): boolean {
  return param.type === 'column' && param.name.toLowerCase().includes('weight');
}

function camel(name: string): string {
  return name.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function readStored(body: Record<string, unknown> | null | undefined, param: SpecParam): unknown {
  if (!body) return undefined;
  if (Object.prototype.hasOwnProperty.call(body, param.name)) return body[param.name];
  if (param.alias && Object.prototype.hasOwnProperty.call(body, param.alias))
    return body[param.alias];
  const alias = camel(param.name);
  if (alias !== param.name && Object.prototype.hasOwnProperty.call(body, alias)) return body[alias];
  return undefined;
}

function slotFor(types: string[] | undefined): ColumnSlotType | undefined {
  const wanted = (types ?? []).filter(type => type && type !== 'any');
  if (wanted.length !== 1) return undefined;
  const slot = wanted[0];
  if (slot === 'numeric' || slot === 'categorical' || slot === 'date/time' || slot === 'string') {
    return slot;
  }
  return undefined;
}

export function namesForParam(
  schema: SchemaColumn[],
  param: SpecParam,
  preview?: DatasetPreview | null
): string[] {
  const names = schema.map(column => column.name);
  const slot = slotFor(param.columnTypes);
  if (!slot) return names;
  if (slot === 'categorical') {
    const categorical = categoricalColumnNames(schema, preview);
    if (categorical.length) return categorical;
  }
  const matched = names.filter(name => slotTypeMatchesExpected(columnSlotType(schema, name), slot));
  return matched.length ? matched : names;
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function baseline(param: SpecParam): unknown {
  if (param.default !== undefined && param.default !== null) return param.default;
  if (param.type === 'columns') return [];
  if (param.type === 'boolean') return false;
  return '';
}

export function fieldChanged(param: SpecParam, value: unknown): boolean {
  if (param.report || param.role === 'required') return false;
  return !sameValue(value ?? null, baseline(param));
}

export function valuesFromSpec(
  spec: AnalysisSpec,
  body: Record<string, unknown> | null | undefined,
  activeWeight: string | null,
  _schema: SchemaColumn[],
  _preview?: DatasetPreview | null
): Record<string, unknown> {
  const stored = body && Object.keys(body).length > 0;
  const values: Record<string, unknown> = {};
  for (const param of spec.params) {
    if (param.report) continue;
    const fromBody = readStored(body, param);
    if (fromBody !== undefined) {
      values[param.name] = fromBody;
      continue;
    }
    if (!stored && isWeightParam(param) && activeWeight) {
      values[param.name] = activeWeight;
      continue;
    }
    if (param.default !== undefined && param.default !== null) {
      values[param.name] = param.default;
      continue;
    }
    if (param.type === 'columns') values[param.name] = [];
    else if (param.type === 'boolean') values[param.name] = false;
    else values[param.name] = '';
  }
  return values;
}

function present(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function bodyFromSpec(
  spec: AnalysisSpec,
  values: Record<string, unknown>,
  stored: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const known = new Set(
    spec.params.flatMap(param => [param.name, param.alias, camel(param.name)].filter(Boolean))
  );
  const body: Record<string, unknown> = {};
  if (stored) {
    for (const [name, value] of Object.entries(stored)) {
      if (!known.has(name) && !name.startsWith('_')) body[name] = value;
    }
  }
  for (const param of spec.params) {
    if (param.report) continue;
    const value = values[param.name];
    if (!present(value)) continue;
    body[param.name] = value;
  }
  return body;
}

export function specRunBlockers(spec: AnalysisSpec, values: Record<string, unknown>): string[] {
  const blockers: string[] = [];
  for (const param of spec.params) {
    if (param.role !== 'required' || param.report || isWeightParam(param)) continue;
    if (!present(values[param.name])) blockers.push(`${paramLabel(param)} is required.`);
  }
  return blockers;
}

function chipValue(param: SpecParam, values: Record<string, unknown>): string {
  const raw = values[param.name];
  const empty = raw == null || raw === '' || (Array.isArray(raw) && raw.length === 0);
  if (empty && param.displayDefault) return param.displayDefault;
  return displayValue(raw ?? param.default);
}

export function defaultsLine(spec: AnalysisSpec, values: Record<string, unknown>): string {
  const parts = spec.params
    .filter(param => param.role === 'default' && !param.report)
    .map(param => `${paramLabel(param)} ${chipValue(param, values)}`);
  return parts.length
    ? parts.join(', ')
    : 'The usual settings for this analysis. Open Advanced options to change them.';
}

function displayValue(value: unknown): string {
  if (value == null || value === '') return 'none';
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'none';
  return String(value);
}

export function advancedChanged(spec: AnalysisSpec, values: Record<string, unknown>): boolean {
  return spec.params.some(
    param =>
      (param.role === 'advanced' || param.role === 'default') &&
      !param.report &&
      fieldChanged(param, values[param.name])
  );
}
