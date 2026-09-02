import { netPreset, NET_HELPER_COPY } from './nets';

const LIKERT = ['1 Strongly disagree', '2 Disagree', '3 Neither', '4 Agree', '5 Strongly agree'];

describe('net presets', () => {
  it('Net Agree is a union of agree categories, not a sum', () => {
    const net = netPreset('agree', LIKERT);
    expect(net?.label).toBe('NET Agree');
    expect(net?.values).toEqual(['4 Agree', '5 Strongly agree']);
    expect(NET_HELPER_COPY.toLowerCase()).toContain('union');
    expect(NET_HELPER_COPY.toLowerCase()).toContain('recode');
  });

  it('Net Yes matches yes-like values', () => {
    const net = netPreset('yes', ['No', 'Yes', 'Not sure']);
    expect(net?.label).toBe('NET Yes');
    expect(net?.values).toEqual(['Yes']);
  });

  it('Top-2-box takes the last two values in the pinned order', () => {
    const net = netPreset('top2', ['Low', 'Med', 'High', 'Very high']);
    expect(net?.label).toBe('Top-2-box');
    expect(net?.values).toEqual(['High', 'Very high']);
  });

  it('returns null when the preset cannot find categories', () => {
    expect(netPreset('agree', ['Red', 'Blue'])).toBeNull();
    expect(netPreset('yes', ['Male', 'Female'])).toBeNull();
    expect(netPreset('top2', ['Only'])).toBeNull();
  });
});
