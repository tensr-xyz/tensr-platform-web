import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AnalysisResult } from './analysis-result';
import {
  MarketDecksPanel,
  OverviewDeck,
  OVERVIEW_SLIDES,
  WaveRefresh,
  overviewMarketBatchPayload,
  refreshDecksBatchPayload,
} from './overview-deck';

jest.mock('@/lib/output-pptx', () => ({
  exportResultAsPptx: jest.fn(async () => undefined),
  appendResultToDeck: jest.fn(async () => undefined),
}));

jest.mock('@/lib/flow-api', () => ({
  flowJson: jest.fn(async (path: string) => {
    if (String(path).includes('/metadata')) {
      return {
        columns: [
          { name: 'region', label: 'Region', measure: 'nominal' },
          { name: 'weight', label: 'Weight', measure: 'numeric' },
        ],
      };
    }
    if (String(path).includes('/values')) {
      return {
        values: ['North', 'South'],
        value_labels: { North: 'North', South: 'South' },
        counts: { North: 12, South: 8 },
      };
    }
    return {};
  }),
}));

import { appendResultToDeck, exportResultAsPptx } from '@/lib/output-pptx';

describe('the deck and refresh screens', () => {
  it('lists the template slides, the low-base flag, and the saved recipe', async () => {
    const onBuild = jest.fn(async () => undefined);
    render(
      <OverviewDeck
        audience="Weekday readers"
        templateName="Client.potx"
        templateSummary="9 layouts · theme colours found"
        slides={OVERVIEW_SLIDES.map(slide =>
          slide.id === 'market'
            ? {
                ...slide,
                lowBase: true,
                lowBaseNote: 'One market has a base of 38 · shown with a low-base note',
              }
            : slide
        )}
        onBuild={onBuild}
        onClose={() => undefined}
      />
    );
    expect(screen.getByText('New audience overview deck')).toBeTruthy();
    expect(screen.getByText('Client.potx')).toBeTruthy();
    expect(screen.getByText('9 layouts · theme colours found')).toBeTruthy();
    expect(screen.getByText('Saved as a recipe')).toBeTruthy();
    expect(screen.getByText('Reach by market')).toBeTruthy();
    expect(screen.getByText(/base of 38/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: `Build ${OVERVIEW_SLIDES.length} slides` }));
    await waitFor(() => expect(onBuild).toHaveBeenCalled());
    expect(onBuild.mock.calls[0][0].audience).toBe('Weekday readers');
    expect(onBuild.mock.calls[0][0].slides).toHaveLength(OVERVIEW_SLIDES.length);
    expect(
      await screen.findByText('Saved as a recipe. The original deck is unchanged.')
    ).toBeTruthy();
  });

  it('offers one copy per market and passes the chosen values to onBuild', async () => {
    const onBuild = jest.fn(async () => undefined);
    render(
      <OverviewDeck
        audience="Total sample"
        datasetId="ds-1"
        onBuild={onBuild}
        onClose={() => undefined}
      />
    );
    fireEvent.click(screen.getByLabelText('One copy per market'));
    expect(await screen.findByTestId('overview-per-market')).toBeTruthy();
    expect(await screen.findByText(/North/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: `Build ${OVERVIEW_SLIDES.length} slides` }));
    await waitFor(() => expect(onBuild).toHaveBeenCalled());
    expect(onBuild.mock.calls[0][0].perMarket).toEqual({
      groupColumn: 'region',
      values: ['North', 'South'],
    });
    expect(
      await screen.findByText(
        'Saved one recipe per market. Refresh them together when new data arrives.'
      )
    ).toBeTruthy();
  });

  it('shows New data and Refresh N decks on the market panel', () => {
    const onRefresh = jest.fn(async () => undefined);
    render(
      <MarketDecksPanel
        decks={[
          {
            id: 'a',
            name: 'Overview · North',
            group_label: 'North',
            group_column_label: 'Region',
            family_id: 'fam',
            new_data: true,
            n_versions: 1,
          },
          {
            id: 'b',
            name: 'Overview · South',
            group_label: 'South',
            group_column_label: 'Region',
            family_id: 'fam',
            new_data: true,
          },
        ]}
        onRefresh={onRefresh}
      />
    );
    expect(screen.getByText('Market decks')).toBeTruthy();
    expect(screen.getAllByText('New data')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh 2 decks' }));
    expect(onRefresh).toHaveBeenCalled();
  });

  it('builds batch and refresh payloads for market decks', () => {
    expect(
      JSON.parse(
        overviewMarketBatchPayload({
          specIds: ['s1'],
          groupColumn: 'region',
          values: ['North'],
          name: 'Audience overview',
          audience: 'Total sample',
        })
      )
    ).toMatchObject({
      spec_ids: ['s1'],
      group_column: 'region',
      values: ['North'],
      save_family: true,
    });
    expect(
      JSON.parse(refreshDecksBatchPayload({ familyId: 'fam', onlyNewData: true }))
    ).toMatchObject({
      family_id: 'fam',
      only_new_data: true,
    });
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

  it('opens the export menu for one output and downloads a PowerPoint slide', async () => {
    render(
      <AnalysisResult
        lead="Alpha is 40.0%."
        tables={[{ title: 'Reach', columns: ['Item', '%'], rows: [['Alpha', '40.0%']] }]}
        datasetId="ds-1"
        templateName="Sales_master_2026.potx"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(screen.getByRole('menuitem', { name: 'PowerPoint slide' })).toBeTruthy();
    expect(screen.getByText(/On Sales_master_2026 · editable chart/)).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Add to a deck…' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Excel table' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Image (PNG)' })).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: 'PowerPoint slide' }));
    await waitFor(() => expect(exportResultAsPptx).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add to a deck…' }));
    await waitFor(() => expect(appendResultToDeck).toHaveBeenCalled());
  });
});
