import { fireEvent, render, screen } from '@testing-library/react';
import { AnalysisResult } from './analysis-result';
import { OverviewDeck, OVERVIEW_SLIDES, WaveRefresh } from './overview-deck';

describe('the deck and refresh screens', () => {
  it('lists the template slides, the low-base flag, and the saved recipe', () => {
    render(
      <OverviewDeck
        audience="Weekday readers"
        templateName="Client.potx"
        templateSummary="9 layouts · theme colours found"
        onClose={() => undefined}
      />
    );
    expect(screen.getByText('New audience overview deck')).toBeTruthy();
    expect(screen.getByText('Client.potx')).toBeTruthy();
    expect(screen.getByText('9 layouts · theme colours found')).toBeTruthy();
    expect(screen.getByText('Saved as a recipe')).toBeTruthy();
    expect(screen.getByText('Reach by market')).toBeTruthy();
    expect(OVERVIEW_SLIDES.some(slide => slide.lowBase)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: `Build ${OVERVIEW_SLIDES.length} slides` }));
    expect(screen.getByText('Saved as a recipe. The original deck is unchanged.')).toBeTruthy();
  });

  it('walks the second-wave steps and keeps a movers summary', () => {
    render(
      <WaveRefresh
        previous={[
          { name: 'role', label: 'Seniority' },
          { name: 'gone', label: 'Old attitude' },
        ]}
        next={[{ name: 'rank', label: 'Seniority' }]}
        onClose={() => undefined}
      />
    );
    expect(screen.getByText('Refresh with a new wave')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Choose file' }));
    expect(screen.getByText('1 matched by label · check these')).toBeTruthy();
    expect(screen.getByText('1 not found · slide affected')).toBeTruthy();
    expect(screen.getByText('Needs a look')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Review what moved' }));
    expect(screen.getByText('Biggest movers since the previous wave')).toBeTruthy();
    expect(screen.getByText(/added as the last slide/)).toBeTruthy();
  });

  it('opens the export menu for one output', () => {
    render(
      <AnalysisResult
        lead="Alpha is 40.0%."
        tables={[{ title: 'Reach', columns: ['Item', '%'], rows: [['Alpha', '40.0%']] }]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(screen.getByRole('menuitem', { name: 'PowerPoint slide' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Add to a deck…' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Excel table' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Image (PNG)' })).toBeTruthy();
  });
});
