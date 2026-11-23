import { labelledMeasure } from './measure-level';

describe('labelledMeasure', () => {
  it('keeps named markets nominal even on codes 1–3', () => {
    expect(
      labelledMeasure({
        '1': 'United States',
        '2': 'United Kingdom',
        '3': 'Germany',
      })
    ).toBe('nominal');
  });

  it('keeps seniority ordinal from rank words', () => {
    expect(
      labelledMeasure({
        '1': 'Junior',
        '2': 'Mid-level',
        '3': 'Senior',
        '4': 'Director',
      })
    ).toBe('ordinal');
  });

  it('keeps numbered bands ordinal', () => {
    expect(
      labelledMeasure({
        '1': 'Band 1',
        '2': 'Band 2',
        '3': 'Band 3',
        '4': 'Band 4',
        '5': 'Band 5',
      })
    ).toBe('ordinal');
  });

  it('keeps a pair of codes nominal', () => {
    expect(labelledMeasure({ '1': 'Female', '2': 'Male' })).toBe('nominal');
  });
});
