import {
  specFor,
  valuesFromSpec,
  bodyFromSpec,
  specRunBlockers,
  fieldChanged,
} from './analysis-spec-setup';
import type { SchemaColumn } from '@/lib/analysis-report-types';

const SCHEMA: SchemaColumn[] = [
  { name: 'score', type: 'numeric', missing_count: 0 },
  { name: 'group', type: 'categorical', missing_count: 0 },
  { name: 'weight', type: 'numeric', missing_count: 0 },
];

describe('analysis spec setup', () => {
  it('prefills a required numeric column and the active weight', () => {
    const spec = specFor('linear_regression');
    expect(spec).toBeDefined();
    const values = valuesFromSpec(spec!, null, 'weight', SCHEMA);
    expect(values.dependent).toBe('score');
    expect(values.independents).toEqual(['weight']);
    expect(values.include_constant).toBe(true);
    expect(values.decimal_places).toBeUndefined();
  });

  it('prefills a re-run from the stored body and keeps keys the form does not edit', () => {
    const spec = specFor('linear_regression');
    const stored = {
      dependent: 'score',
      independents: ['group'],
      include_constant: false,
      method: 'backward',
      extra_flag: 'keep',
    };
    const values = valuesFromSpec(spec!, stored, 'weight', SCHEMA);
    expect(values.dependent).toBe('score');
    expect(values.include_constant).toBe(false);
    expect(values.method).toBe('backward');
    const body = bodyFromSpec(spec!, values, stored);
    expect(body.extra_flag).toBe('keep');
    expect(body.include_constant).toBe(false);
    expect(body.decimal_places).toBeUndefined();
    expect(fieldChanged(spec!.params.find(param => param.name === 'method')!, values.method)).toBe(
      true
    );
  });

  it('blocks a run when a required column is empty', () => {
    const spec = specFor('linear_regression')!;
    const values = valuesFromSpec(spec, null, null, []);
    expect(
      specRunBlockers(spec, { ...values, dependent: '', independents: [] }).length
    ).toBeGreaterThan(0);
  });

  it('allows None for a weight column by omitting it', () => {
    const spec = specFor('descriptives');
    if (!spec) return;
    const weight = spec.params.find(param => param.name.toLowerCase().includes('weight'));
    if (!weight) return;
    const values = valuesFromSpec(spec, { [weight.name]: '' }, 'weight', SCHEMA);
    const body = bodyFromSpec(spec, values, null);
    expect(body[weight.name]).toBeUndefined();
  });
});
