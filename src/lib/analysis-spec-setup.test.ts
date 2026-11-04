import {
  specFor,
  valuesFromSpec,
  bodyFromSpec,
  specRunBlockers,
  fieldChanged,
  advancedChanged,
  defaultsLine,
  ensureAnalysisSpecs,
  installAnalysisSpecs,
  resetAnalysisSpecs,
} from './analysis-spec-setup';
import { SPEC_FIXTURES } from './analysis-spec-fixtures';
import type { DatasetPreview, SchemaColumn } from '@/lib/analysis-report-types';

const SCHEMA: SchemaColumn[] = [
  { name: 'score', type: 'numeric', missing_count: 0 },
  { name: 'group', type: 'categorical', missing_count: 0 },
  { name: 'weight', type: 'numeric', missing_count: 0 },
];

describe('analysis spec setup', () => {
  beforeAll(() => {
    installAnalysisSpecs(SPEC_FIXTURES);
  });

  it('leaves required pickers empty and prefills only the active weight', () => {
    const spec = specFor('linear_regression');
    expect(spec).toBeDefined();
    const values = valuesFromSpec(spec!, null, 'weight', SCHEMA);
    expect(values.dependent).toBe('');
    expect(values.independents).toEqual([]);
    expect(values.include_constant).toBe(true);
    expect(values.decimal_places).toBeUndefined();

    const ttest = specFor('ttest_independent')!;
    const tValues = valuesFromSpec(ttest, null, 'weight', SCHEMA);
    expect(tValues.group_column).toBe('');
    expect(tValues.value_column).toBe('');
    expect(tValues.weight_column).toBe('weight');
    expect(defaultsLine(ttest, tValues)).toBe('confidence 0.95, missing listwise');
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
    expect(advancedChanged(spec!, values)).toBe(true);
  });

  it('blocks a run when a required column is empty', () => {
    const spec = specFor('linear_regression')!;
    const values = valuesFromSpec(spec, null, null, []);
    expect(
      specRunBlockers(spec, { ...values, dependent: '', independents: [] }).length
    ).toBeGreaterThan(0);
  });

  it('labels chi-square slots and skips id and high-cardinality columns', () => {
    const spec = specFor('chi_square');
    expect(spec?.params.find(param => param.name === 'column_a')?.label).toBe('Row variable');
    expect(spec?.params.find(param => param.name === 'column_b')?.label).toBe('Column variable');
    const schema: SchemaColumn[] = [
      { name: 'RespID', type: 'categorical', missing_count: 0 },
      { name: 'Gender', type: 'categorical', missing_count: 0 },
      { name: 'Age', type: 'categorical', missing_count: 0 },
      { name: 'Group', type: 'categorical', missing_count: 0 },
    ];
    const preview: DatasetPreview = {
      headers: ['RespID', 'Gender', 'Age', 'Group'],
      rows: Array.from({ length: 60 }, (_, index) => [
        index + 1,
        index % 2 === 0 ? 'F' : 'M',
        18 + index,
        index % 3 === 0 ? 'Control' : 'Treat',
      ]),
    };
    const values = valuesFromSpec(spec!, null, null, schema, preview);
    expect(values.column_a).toBe('');
    expect(values.column_b).toBe('');
  });

  it('allows None for a weight column by omitting it', () => {
    const spec = specFor('descriptives');
    if (!spec) return;
    const weight = spec.params.find(param => param.name.toLowerCase().includes('weight'));
    if (!weight) return;
    const values = valuesFromSpec(spec, { [weight.name]: '' }, 'weight', SCHEMA);
    const body = bodyFromSpec(spec, values, null);
    expect(body[weight.name]).toBeUndefined();
    expect(specRunBlockers(spec, values)).toContain('Select at least one variable.');
    expect(specRunBlockers(spec, values).join(' ')).not.toMatch(/Weight/);
    const fresh = valuesFromSpec(spec, null, null, SCHEMA);
    expect(defaultsLine(spec, fresh)).toContain('mean, std, min, max');
  });

  it('fetches the API catalog once per session and keeps the written labels', async () => {
    resetAnalysisSpecs();
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        specs: [
          {
            key: 'descriptives',
            family: 'describe',
            r_reference: 'base::summary',
            outputs: [],
            params: [
              {
                name: 'columns',
                type: 'columns',
                role: 'required',
                default: null,
                label: 'Variables',
                column_types: ['numeric'],
                allow_empty: true,
              },
            ],
          },
        ],
      }),
    } as Response);
    try {
      await ensureAnalysisSpecs();
      await ensureAnalysisSpecs();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(specFor('descriptives')?.rReference).toBe('base::summary');
      expect(specFor('descriptives')?.params[0]).toMatchObject({
        label: 'Variables',
        columnTypes: ['numeric'],
        allowEmpty: true,
      });
    } finally {
      fetchMock.mockRestore();
      installAnalysisSpecs(SPEC_FIXTURES);
    }
  });
});
