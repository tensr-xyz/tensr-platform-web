import { MIN_TEAM_SEATS, monthlyEquivalentRate } from './pricing';

describe('subscription list prices', () => {
  it('requires three Teams seats', () => {
    expect(MIN_TEAM_SEATS).toBe(3);
  });

  it('rounds annual monthly equivalent to a whole pound', () => {
    expect(monthlyEquivalentRate(79)).toBe(63);
    expect(monthlyEquivalentRate(149)).toBe(119);
    expect(monthlyEquivalentRate(119)).toBe(95);
  });
});
