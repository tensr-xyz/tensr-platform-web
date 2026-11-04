import cases from './analysis-spec-dialog-cases.json';
import {
  defaultsLine,
  installAnalysisSpecs,
  namesForParam,
  resetAnalysisSpecs,
  valuesFromSpec,
  type AnalysisSpec,
} from './analysis-spec-setup';
import { suggestChoiceRoles } from './choice-roles';
import type { SchemaColumn } from '@/lib/analysis-report-types';

type CaseParam = {
  name: string;
  type: string;
  role: string;
  label: string;
  default: unknown;
  displayDefault?: string;
  columnTypes?: string[];
};

type DialogCase = { key: string; params: CaseParam[] };

const DIALOG_CASES = cases as DialogCase[];

function specFrom(row: DialogCase): AnalysisSpec {
  return {
    key: row.key,
    family: 'test',
    rReference: 'hand-written',
    outputs: [],
    params: row.params.map(param => ({
      name: param.name,
      type: param.type,
      role: param.role,
      label: param.label,
      default: param.default,
      displayDefault: param.displayDefault,
      columnTypes: param.columnTypes,
    })),
  };
}

const SCHEMA: SchemaColumn[] = [
  { name: 'score', type: 'numeric', missing_count: 0 },
  { name: 'group', type: 'categorical', missing_count: 0 },
  { name: 'note', type: 'string', missing_count: 0 },
];

function looksRaw(label: string, name: string): boolean {
  const spaced = name.replace(/_/g, ' ');
  if (label === name && name.includes('_')) return true;
  return spaced.includes(' ') && label.toLowerCase() === spaced;
}

describe.each(DIALOG_CASES)('$key setup dialog', row => {
  const spec = specFrom(row);
  const required = spec.params.filter(param => param.role === 'required');

  it('names the required variables in SPSS wording', () => {
    const choosesVariable = spec.params.some(
      param => param.type === 'column' || param.type === 'columns'
    );
    if (choosesVariable) expect(required.length).toBeGreaterThan(0);
    for (const param of required) {
      expect(param.label).toBeTruthy();
      expect(looksRaw(param.label || '', param.name)).toBe(false);
    }
  });

  it('starts required pickers empty and prefills only weight', () => {
    const values = valuesFromSpec(spec, null, 'active_w', SCHEMA);
    for (const param of required) {
      const value = values[param.name];
      if (
        param.name === 'weight' ||
        param.name === 'weight_column' ||
        param.name === 'design_weight_column'
      ) {
        expect(value).toBe('active_w');
      } else if (param.type === 'columns') {
        expect(value).toEqual([]);
      } else if (param.type === 'column') {
        expect(value === '' || value == null).toBe(true);
      }
    }
  });

  it('lists real defaults and offers only the declared column types', () => {
    const values = valuesFromSpec(spec, null, null, SCHEMA);
    const defaults = spec.params.filter(param => param.role === 'default');
    if (defaults.length) {
      const line = defaultsLine(spec, values);
      expect(line).not.toMatch(/usual settings/);
      expect(line.length).toBeGreaterThan(0);
    }
    for (const param of spec.params) {
      if (param.type !== 'column' && param.type !== 'columns') continue;
      if (!param.columnTypes || param.columnTypes.length !== 1) continue;
      const offered = namesForParam(SCHEMA, param);
      if (param.columnTypes[0] === 'numeric') {
        expect(offered).toContain('score');
        expect(offered).not.toContain('group');
      }
      if (param.columnTypes[0] === 'categorical') {
        expect(offered).not.toContain('score');
      }
    }
  });
});

describe('named dialogs', () => {
  beforeAll(() => {
    installAnalysisSpecs(DIALOG_CASES.map(specFrom));
  });
  afterAll(() => {
    resetAnalysisSpecs();
  });

  it('descriptives, t-test, and banner use the researcher labels', () => {
    const labels = (key: string) =>
      specFrom(DIALOG_CASES.find(row => row.key === key)!)
        .params.filter(param => param.role === 'required')
        .map(param => param.label);
    expect(labels('descriptives')).toEqual(expect.arrayContaining(['Variables', 'Weight']));
    expect(labels('ttest_independent')).toEqual(
      expect.arrayContaining(['Test variable', 'Grouping variable'])
    );
    expect(labels('banner_table')).toEqual(expect.arrayContaining(['Rows', 'Columns', 'Weight']));
  });

  it('keeps the weight a descriptives re-run already stored', () => {
    const spec = specFrom(DIALOG_CASES.find(row => row.key === 'descriptives')!);
    const values = valuesFromSpec(spec, { weight_column: 'w_saved' }, 'active_w', SCHEMA);
    expect(values.weight_column).toBe('w_saved');
  });
});

describe('long-format CBC roles', () => {
  it('treats brand as an attribute on qa_cbc_long headers', () => {
    const roles = suggestChoiceRoles([
      'respondent',
      'task',
      'alternative',
      'chosen',
      'price',
      'segment',
      'brand',
    ]);
    expect(roles.brand).toBe('attribute');
    expect(roles.price).toBe('price');
    expect(roles.segment).toBe('segment');
  });
});
