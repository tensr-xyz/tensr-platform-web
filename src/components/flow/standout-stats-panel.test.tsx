import { fireEvent, render, screen } from '@testing-library/react';
import {
  StandoutStatsPanel,
  formatStandoutIndexPhrase,
  standoutMetaLine,
} from './standout-stats-panel';
import { resultViewFromToolResults } from './result-tables';
import { resultLead } from './chat-output';

describe('formatStandoutIndexPhrase', () => {
  it('formats Paper 14a multiples with ×', () => {
    expect(formatStandoutIndexPhrase(267)).toBe('2.7× the average');
    expect(formatStandoutIndexPhrase(200)).toBe('2× the average');
  });
});

describe('StandoutStatsPanel', () => {
  const panel = {
    lead: "Half of US institutional investors read the WSJ, 2.7× the average, and they're nearly 3× as likely to be in the C-suite.",
    audience_label: 'US institutional investors',
    comparison_label: 'Total',
    audience_n: 218,
    weight_phrase: 'Weighted to people.',
    n_above_average: 34,
    min_base: 50,
    low_base_mark: 100,
    themes: [
      {
        theme: 'Media',
        stats: [
          {
            audience_percent: 50,
            percent_label: '50%',
            subject: 'read The Wall Street Journal',
            index: 267,
            index_phrase: '2.7x the average',
          },
          {
            audience_percent: 51,
            percent_label: '51%',
            subject: 'use CNBC',
            index: 260,
            index_phrase: '2.6x the average',
          },
        ],
      },
      {
        theme: 'Work',
        stats: [
          {
            audience_percent: 28,
            percent_label: '28%',
            subject: 'are in the C-suite',
            index: 280,
            index_phrase: '2.8x the average',
          },
        ],
      },
    ],
  };

  it('TEN-269: shows themed big %, subject, accent index, rules, and actions', () => {
    render(<StandoutStatsPanel panel={panel} />);
    expect(screen.getByTestId('standout-stats-panel')).toBeInTheDocument();
    expect(screen.getByText('Media')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('read The Wall Street Journal')).toBeInTheDocument();
    expect(screen.getByText('2.7× the average')).toBeInTheDocument();
    expect(screen.getByText('are in the C-suite')).toBeInTheDocument();
    expect(screen.getByText(/Only answers significantly above the average/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show all 34 above average/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Show all 34 above average/i }));
    expect(screen.getByRole('button', { name: /Show top standouts/i })).toBeInTheDocument();
  });
});

describe('standout result wiring', () => {
  it('TEN-269: extracts a standout panel from tool results', () => {
    const view = resultViewFromToolResults({
      analysis_type: 'standout_stats',
      lead: 'Half of the audience read the WSJ, 2.7x the average.',
      audience_label: 'Audience',
      comparison_label: 'Total',
      audience_n: 80,
      weight_phrase: 'Weighted.',
      n_above_average: 6,
      themes: [
        {
          theme: 'Media',
          stats: [
            {
              percent_label: '50%',
              subject: 'read the WSJ',
              index_phrase: '2.7x the average',
              index: 267,
              audience_percent: 50,
            },
          ],
        },
      ],
    });
    expect(view.standout?.themes).toHaveLength(1);
    expect(view.standout?.lead).toMatch(/WSJ/);
    expect(standoutMetaLine(view.standout!)).toContain('Audience vs all respondents');
  });

  it('TEN-269: resultLead prefers the standout lead sentence', () => {
    const lead = resultLead('standout_stats; flags: weight_in_use', [
      {
        result: {
          analysis_type: 'standout_stats',
          lead: 'Half of the audience read the WSJ, 2.7x the average.',
          summary: { line: 'Half of the audience read the WSJ, 2.7x the average.' },
        },
      },
    ]);
    expect(lead).toMatch(/Half of the audience read the WSJ/);
  });
});
