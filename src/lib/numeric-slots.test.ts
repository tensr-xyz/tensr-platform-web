import { namesForParam, type SpecParam } from '@/lib/analysis-spec-setup';
import { isDependentColumn } from '@/lib/flow-columns';
import type { SchemaColumn } from '@/lib/analysis-report-types';

/**
 * Two files, neither of them a vehicle file.
 * A numeric slot takes ordinal and scale, never nominal, and never a weight.
 * The weight slot takes only a weight.
 */

const clinic: SchemaColumn[] = [
  { name: 'arm', type: 'categorical', missing_count: 0, measure: 'nominal', label: 'Study arm' },
  {
    name: 'reading',
    type: 'numeric',
    missing_count: 0,
    measure: 'scale',
    label: 'Systolic reading',
  },
  {
    name: 'comfort',
    type: 'categorical',
    missing_count: 0,
    measure: 'ordinal',
    label: 'How comfortable was the visit',
    value_labels: {
      '1': 'Not at all',
      '2': 'A little',
      '3': 'Somewhat',
      '4': 'Quite',
      '5': 'Very',
    },
  },
  { name: 'note', type: 'string', missing_count: 0, measure: 'nominal', label: 'Comment' },
  {
    name: 'design',
    type: 'numeric',
    missing_count: 0,
    measure: 'scale',
    role: 'weight',
    label: 'Design weight',
  },
];

const till: SchemaColumn[] = [
  { name: 'tender', type: 'categorical', missing_count: 0, measure: 'nominal', label: 'Payment' },
  { name: 'amount', type: 'numeric', missing_count: 0, measure: 'scale', label: 'Basket amount' },
  {
    name: 'wait',
    type: 'categorical',
    missing_count: 0,
    measure: 'ordinal',
    label: 'Queue rating',
    value_labels: { '1': 'Poor', '2': 'Fair', '3': 'Good', '4': 'Very good', '5': 'Excellent' },
  },
  { name: 'lane', type: 'string', missing_count: 0, label: 'Lane note' },
  {
    name: 'lane_wt',
    type: 'numeric',
    missing_count: 0,
    measure: 'scale',
    role: 'weight',
    label: 'Lane weight',
  },
  { name: 'units', type: 'numeric', missing_count: 0, label: 'Units sold' },
];

function column(name: string, types: string[]): SpecParam {
  return { name, type: 'column', role: 'required', default: '', columnTypes: types };
}

const numericSlots = [
  column('variables', ['numeric']),
  column('value_column', ['numeric']),
  column('dependent', ['numeric']),
  column('columns', ['numeric']),
  column('x', ['numeric']),
  column('y', ['numeric']),
];

describe('numeric slots follow the measurement rule', () => {
  it.each(numericSlots)('offers ordinal and scale on $name and leaves the weight out', param => {
    for (const schema of [clinic, till]) {
      const offered = namesForParam(schema, param);
      const ordinal = schema.filter(item => item.measure === 'ordinal').map(item => item.name);
      const nominal = schema.filter(item => item.measure === 'nominal').map(item => item.name);
      const weights = schema.filter(item => item.role === 'weight').map(item => item.name);
      expect(offered).toEqual(expect.arrayContaining(ordinal));
      for (const name of nominal) expect(offered).not.toContain(name);
      for (const name of weights) expect(offered).not.toContain(name);
      expect(offered.length).toBeGreaterThan(0);
    }
  });

  it('puts a weight only in the weight picker', () => {
    const param = column('weight_column', ['numeric']);
    expect(namesForParam(clinic, param)).toEqual(['design']);
    expect(namesForParam(till, param)).toEqual(['lane_wt']);
    expect(namesForParam(clinic, column('value_column', ['numeric']))).not.toContain('design');
  });

  it('keeps an unlabelled number and a stored scale, and drops nominal from a dependent list', () => {
    expect(isDependentColumn(till[5])).toBe(true);
    expect(isDependentColumn(clinic[1])).toBe(true);
    expect(isDependentColumn(clinic[2])).toBe(true);
    expect(isDependentColumn(clinic[0])).toBe(false);
    expect(isDependentColumn(clinic[4])).toBe(false);
    expect(isDependentColumn(till[0])).toBe(false);
    expect(isDependentColumn(till[4])).toBe(false);
  });
});
