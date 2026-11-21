import { formatMoverChange, formatMoverDetail, rankWaveMovers } from './wave-movers';

describe('wave movers', () => {
  it('ranks the biggest percent moves and formats significance', () => {
    const movers = rankWaveMovers(
      [
        { label: 'Reach', percent: 40, n: 400 },
        { label: 'Age 55+', percent: 50, n: 200 },
        { label: 'Stable', percent: 20, n: 400 },
      ],
      [
        { label: 'Reach', percent: 55, n: 400 },
        { label: 'Age 55+', percent: 51, n: 200 },
        { label: 'Stable', percent: 20.02, n: 400 },
      ]
    );
    expect(movers.map(item => item.label)).toEqual(['Reach', 'Age 55+']);
    expect(movers[0].change).toBe(15);
    expect(movers[0].significant).toBe(true);
    expect(formatMoverChange(movers[0].change)).toBe('+15.0 pts ▲');
    expect(formatMoverDetail(movers[0])).toContain('significant at 95%');
    expect(movers[1].significant).toBe(false);
    expect(formatMoverChange(movers[1].change)).toBe('+1.0 pts ▲');
  });

  it('leaves significance unset when bases are missing', () => {
    const movers = rankWaveMovers(
      [{ label: 'Reach', percent: 30 }],
      [{ label: 'Reach', percent: 40 }]
    );
    expect(movers[0].significant).toBeNull();
    expect(formatMoverDetail(movers[0])).toBe('30.0% → 40.0%');
  });
});
