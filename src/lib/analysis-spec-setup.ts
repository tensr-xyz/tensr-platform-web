import specs from '@/lib/analysis-specs.generated.json';
import type { ColumnSlotType } from '@/lib/analysis-column-types';
import { columnSlotType, slotTypeMatchesExpected } from '@/lib/analysis-column-types';
import type { SchemaColumn } from '@/lib/analysis-report-types';

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
};

export type AnalysisSpec = {
  key: string;
  family: string;
  rReference: string;
  outputs: string[];
  params: SpecParam[];
};

const BY_KEY = new Map<string, AnalysisSpec>(
  (specs as AnalysisSpec[]).map(spec => [spec.key, spec])
);

export function specFor(key: string): AnalysisSpec | undefined {
  return BY_KEY.get(key);
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

export function namesForParam(schema: SchemaColumn[], param: SpecParam): string[] {
  const names = schema.map(column => column.name);
  const slot = slotFor(param.columnTypes);
  if (!slot) return names;
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
  schema: SchemaColumn[]
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
    if (!stored && param.role === 'required' && param.type === 'column') {
      const taken = new Set(
        Object.values(values).filter((item): item is string => typeof item === 'string')
      );
      values[param.name] = namesForParam(schema, param).find(name => !taken.has(name)) ?? '';
      continue;
    }
    if (!stored && param.role === 'required' && param.type === 'columns') {
      const taken = new Set(
        Object.values(values).filter((item): item is string => typeof item === 'string')
      );
      const first = namesForParam(schema, param).find(name => !taken.has(name));
      values[param.name] = first ? [first] : [];
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
    if (param.role !== 'required' || param.report) continue;
    if (!present(values[param.name])) blockers.push(`${paramLabel(param)} is required.`);
  }
  return blockers;
}

export function defaultsLine(spec: AnalysisSpec, values: Record<string, unknown>): string {
  const parts = spec.params
    .filter(param => param.role === 'default' && !param.report)
    .map(param => `${paramLabel(param)}: ${displayValue(values[param.name] ?? param.default)}`);
  return parts.length
    ? parts.join('. ') + '.'
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
