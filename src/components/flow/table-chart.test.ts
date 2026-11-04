import { fitLabel, linearFit } from './table-chart';

describe('table chart fit', () => {
  it('fits a line through the plotted points', () => {
    const fit = linearFit([
      { x: 0, y: 0 },
      { x: 1, y: 2 },
      { x: 2, y: 4 },
    ]);
    expect(fit?.slope).toBeCloseTo(2);
    expect(fit?.intercept).toBeCloseTo(0);
    expect(fit?.r).toBeCloseTo(1);
    expect(fit ? fitLabel(fit) : '').toBe('y = 2.00x + 0.00, r = 1.00');
  });
});
