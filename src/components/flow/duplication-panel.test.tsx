import { fireEvent, render, screen } from '@testing-library/react';
import { DuplicationPanel, formatProjectedK } from './duplication-panel';

describe('formatProjectedK', () => {
  it('formats thousands the way Paper 6n shows them', () => {
    expect(formatProjectedK(289.4)).toBe('289k');
    expect(formatProjectedK(1221)).toBe('1,221k');
    expect(formatProjectedK(47.5)).toBe('47.5k');
  });
});

describe('DuplicationPanel', () => {
  const panel = {
    labels: ['Alpha', 'Beta', 'Gamma'],
    rows: [
      {
        label: 'Alpha',
        cells: [
          { diagonal: true },
          { percent: 23.7, thousands: 289.4 },
          { percent: 18.2, thousands: 222 },
        ],
        reach: { percent: 31.3, thousands: 1221 },
        exclusive: { percent: 23.9, thousands: 932 },
      },
      {
        label: 'Beta',
        cells: [
          { percent: 31.4, thousands: 289.4 },
          { diagonal: true },
          { percent: 20.5, thousands: 189 },
        ],
        reach: { percent: 23.7, thousands: 922 },
        exclusive: { percent: 16.2, thousands: 633 },
      },
      {
        label: 'Gamma',
        cells: [
          { percent: 26.9, thousands: 222 },
          { percent: 22.9, thousands: 189 },
          { diagonal: true },
        ],
        reach: { percent: 21.1, thousands: 824 },
        exclusive: { percent: 14.0, thousands: 545 },
      },
    ],
    subset_nets: [
      {
        indexes: [0, 1],
        labels: ['Alpha', 'Beta'],
        net_percent: 47.5,
        net_thousands: 1854,
        sum_reach_thousands: 2143,
        overlap_thousands: 289,
      },
      {
        indexes: [0, 1, 2],
        labels: ['Alpha', 'Beta', 'Gamma'],
        net_percent: 60.1,
        net_thousands: 2340,
        sum_reach_thousands: 2967,
        overlap_thousands: 627,
      },
    ],
    default_indexes: [0, 1],
    checks: [
      { ok: true, label: 'Net reach ≤ sum of reaches' },
      { ok: true, label: 'Exclusive + duplicated = reach, every title' },
    ],
    net_percent: 60.1,
    net_thousands: 2340,
    base_thousands: 3900,
    unweighted_n: 3000,
  };

  it('shows stacked % and 000s, chips, and a passing checks card', () => {
    render(<DuplicationPanel panel={panel} rCheck="verified" rStatement="max |Δ| = 0" />);
    expect(screen.getAllByText('23.7%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('289k').length).toBeGreaterThan(0);
    expect(screen.getByText('Reach')).toBeInTheDocument();
    expect(screen.getByText('Exclusive')).toBeInTheDocument();
    expect(screen.getByText('47.5%')).toBeInTheDocument();
    expect(screen.getByText(/1,854k people/)).toBeInTheDocument();
    expect(screen.getByText(/Net reach ≤ sum of reaches/)).toBeInTheDocument();
    expect(screen.getByText(/Reproduced in R/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /\+ Add title/i }));
    expect(screen.getByText('60.1%')).toBeInTheDocument();
  });

  it('names the audience on the base line from the panel', () => {
    render(
      <DuplicationPanel
        panel={{ ...panel, audience_label: 'US institutional investors' }}
        rCheck="verified"
      />
    );
    expect(screen.getByText(/Base: US institutional investors/)).toBeInTheDocument();
    expect(screen.queryByText(/Base: all respondents/)).not.toBeInTheDocument();
  });
});
