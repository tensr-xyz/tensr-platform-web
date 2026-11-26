import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AnalysisResult } from './analysis-result';
import {
  MarketDecksPanel,
  OverviewDeck,
  OVERVIEW_SLIDES,
  WaveRefresh,
  overviewDeckPayload,
  overviewMarketBatchPayload,
  refreshDecksBatchPayload,
  withOverviewSlideSupport,
} from './overview-deck';

jest.mock('@/lib/output-pptx', () => ({
  exportResultAsPptx: jest.fn(async () => undefined),
  appendResultToDeck: jest.fn(async () => undefined),
}));

jest.mock('@/components/flow/export-dialog', () => ({
  workbookFromRunDocument: jest.fn(async () => undefined),
}));

jest.mock('@/lib/flow-api', () => ({
  flowJson: jest.fn(async (path: string) => {
    if (String(path).includes('/metadata')) {
      return {
        columns: [
          { name: 'wave', label: 'Survey wave', measure: 'nominal' },
          { name: 'region', label: 'Market', measure: 'nominal' },
          { name: 'weight', label: 'Weight', measure: 'numeric' },
        ],
        active_weight_label: 'Projection weight (people)',
        original_filename: 'audience_w2.sav',
      };
    }
    if (String(path).includes('/values')) {
      return {
        values: ['North', 'South', 'Tiny'],
        value_labels: { North: 'North', South: 'South', Tiny: 'Tiny' },
        counts: { North: 120, South: 80, Tiny: 12 },
        weighted_counts: { North: 240000, South: 90000, Tiny: 8000 },
      };
    }
    return {};
  }),
}));

import { appendResultToDeck, exportResultAsPptx } from '@/lib/output-pptx';
import { workbookFromRunDocument } from '@/components/flow/export-dialog';

describe('the deck and refresh screens', () => {
  it('greys the audience profile and size slides when no audience is selected', () => {
    const slides = withOverviewSlideSupport(OVERVIEW_SLIDES, 'Total sample');
    const profile = slides.find(slide => slide.id === 'profile');
    const size = slides.find(slide => slide.id === 'size');
    expect(profile?.unsupported).toBe(true);
    expect(profile?.reason).toMatch(/audience/i);
    expect(size?.unsupported).toBe(true);
    expect(size?.reason).toMatch(/audience/i);
    const ready = withOverviewSlideSupport(OVERVIEW_SLIDES, 'Weekday readers');
    expect(ready.find(slide => slide.id === 'profile')?.unsupported).toBeFalsy();
    expect(ready.find(slide => slide.id === 'size')?.unsupported).toBeFalsy();
  });

  it('lists Audience size and Reach comparison in the default slide set', () => {
    expect(OVERVIEW_SLIDES.some(slide => slide.id === 'size' && /size/i.test(slide.title))).toBe(
      true
    );
    expect(
      OVERVIEW_SLIDES.some(slide => slide.id === 'reach' && /reach comparison/i.test(slide.title))
    ).toBe(true);
  });

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
    expect(screen.getByText('Audience profile')).toBeTruthy();
    expect(screen.getByText(/base of 38/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: `Build ${OVERVIEW_SLIDES.length} slides` }));
    await waitFor(() => expect(onBuild).toHaveBeenCalled());
    expect(onBuild.mock.calls[0][0].audience).toBe('Weekday readers');
    expect(onBuild.mock.calls[0][0].slides).toHaveLength(OVERVIEW_SLIDES.length);
    expect(
      await screen.findByText(
        /Downloaded the overview deck for Weekday readers\. Saved as a recipe/
      )
    ).toBeTruthy();
  });

  it('shows the market table and builds one deck per selected ready market', async () => {
    const onBuild = jest.fn(async () => undefined);
    const { flowJson } = jest.requireMock('@/lib/flow-api') as {
      flowJson: jest.Mock;
    };
    render(
      <OverviewDeck
        audience="Weekday readers"
        datasetId="ds-1"
        dataLabel="audience_w2.sav"
        onBuild={onBuild}
        onClose={() => undefined}
      />
    );
    expect(await screen.findByText('New audience overview · one copy per market')).toBeTruthy();
    expect(await screen.findByTestId('overview-per-market')).toBeTruthy();
    expect(await screen.findByText('North')).toBeTruthy();
    expect(screen.getByText('Base under 50 · skipped')).toBeTruthy();
    expect(screen.getByText('Respondents')).toBeTruthy();
    expect(screen.getByText('Audience (people)')).toBeTruthy();
    // Prefer Market over Survey wave when both are categorical.
    await waitFor(() => expect(onBuild).not.toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Build 2 decks' }));
    await waitFor(() => expect(onBuild).toHaveBeenCalled());
    expect(onBuild.mock.calls[0][0].perMarket).toEqual({
      groupColumn: 'region',
      values: ['North', 'South'],
    });
    expect(
      flowJson.mock.calls.some(
        (args: unknown[]) =>
          typeof args[0] === 'string' &&
          String(args[0]).includes('/values') &&
          String(args[0]).includes('audience=Weekday%20readers')
      )
    ).toBe(true);
    expect(
      await screen.findByText(
        /Downloaded 2 decks for Weekday readers\. Saved one recipe per market/
      )
    ).toBeTruthy();
  });

  it('shows a real error with Retry and per-market Building status', async () => {
    let rejectBuild: (err: Error) => void = () => undefined;
    const onBuild = jest.fn(
      (
        _request: unknown,
        opts?: { onProgress?: (progress: { message: string; marketValue?: string }) => void }
      ) =>
        new Promise<void>((_resolve, reject) => {
          opts?.onProgress?.({
            message: 'Building North · 1 of 2',
            marketValue: 'North',
          });
          rejectBuild = reject;
        })
    );
    render(
      <OverviewDeck
        audience="Weekday readers"
        datasetId="ds-1"
        dataLabel="audience_w2.sav"
        onBuild={onBuild}
        onClose={() => undefined}
      />
    );
    expect(await screen.findByText('North')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Build 2 decks' }));
    expect(await screen.findByText('Building…')).toBeTruthy();
    expect(await screen.findByTestId('overview-deck-progress')).toBeTruthy();
    rejectBuild(new Error('The overview timed out on a large file.'));
    expect(await screen.findByTestId('overview-deck-error')).toBeTruthy();
    expect(screen.getByText(/timed out on a large file/)).toBeTruthy();
    expect(screen.getByTestId('overview-deck-retry')).toBeTruthy();
    fireEvent.click(screen.getByTestId('overview-deck-retry'));
    await waitFor(() => expect(onBuild).toHaveBeenCalledTimes(2));
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
            wave_label: 'Q3',
          },
          {
            id: 'b',
            name: 'Overview · South',
            group_label: 'South',
            group_column_label: 'Region',
            family_id: 'fam',
            new_data: true,
            wave_label: 'Q3',
          },
        ]}
        newWaveLabel="Q4"
        onRefresh={onRefresh}
      />
    );
    expect(screen.getByText(/Audience overview · one per Region/i)).toBeTruthy();
    expect(screen.getByText(/New data: Q4 uploaded/)).toBeTruthy();
    expect(screen.getByText('North')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh 2 decks with Q4' }));
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

  it('builds an overview auto-build payload without pre-saved specs', () => {
    expect(
      JSON.parse(
        overviewDeckPayload({
          audience: 'Weekday readers',
          slides: OVERVIEW_SLIDES,
          options: { headline: true, footnote: true, hide_low: false, low_base_threshold: 50 },
          templateName: 'Client.potx',
        })
      )
    ).toMatchObject({
      audience: 'Weekday readers',
      template_name: 'Client.potx',
      options: { headline: true, low_base_threshold: 50 },
    });
    expect(
      JSON.parse(
        overviewDeckPayload({
          audience: 'Weekday readers',
          slides: OVERVIEW_SLIDES,
          options: {},
          perMarket: { groupColumn: 'region', values: ['North'] },
        })
      ).per_market
    ).toEqual({ group_column: 'region', values: ['North'] });
  });

  it('pads the choose-file step like the market decks dialog', () => {
    render(
      <WaveRefresh
        previous={[{ name: 'role', label: 'Seniority' }]}
        next={[]}
        onClose={() => undefined}
      />
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('wave-refresh');
    expect(dialog.querySelector('.deck-builder-head')).toBeTruthy();
    expect(dialog.querySelector('.wave-refresh-steps')).toBeTruthy();
    expect(dialog.querySelector('.wave-refresh-file')).toBeTruthy();
    expect(screen.getByText('Refresh with a new wave')).toBeTruthy();
    expect(screen.getByText('The current deck and data stay as they are')).toBeTruthy();
    expect(screen.getByText('1 · Choose file')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Choose file' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Build new version' })).toBeDisabled();
  });

  it('walks the second-wave steps and keeps a movers summary', () => {
    render(
      <WaveRefresh
        previous={[
          { name: 'role', label: 'Seniority' },
          { name: 'gone', label: 'Old attitude' },
        ]}
        next={[{ name: 'rank', label: 'Seniority' }]}
        fileName="wave_b.sav"
        movers={[
          {
            label: 'Reach',
            from_percent: 29.2,
            to_percent: 34.0,
            change: 4.8,
            significant: true,
            slide: 3,
          },
        ]}
        onClose={() => undefined}
      />
    );
    expect(screen.getByText('Refresh with a new wave')).toBeTruthy();
    expect(screen.getByText('✓ Choose file · wave_b.sav')).toBeTruthy();
    expect(screen.getByText('matched by label · check these')).toBeTruthy();
    expect(screen.getByText('not found · slide affected')).toBeTruthy();
    expect(screen.getByText('Needs a look')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Keep' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Change' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Drop slide' })).toBeTruthy();
    expect(screen.getByText('+4.8 pts ▲')).toBeTruthy();
    expect(screen.getByText(/significant at 95%/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Review what moved' }));
    expect(screen.getAllByText('Biggest movers since the previous wave').length).toBeGreaterThan(0);
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
    fireEvent.click(screen.getByRole('menuitem', { name: 'Excel table' }));
    await waitFor(() => expect(workbookFromRunDocument).toHaveBeenCalled());
    const [document, stem, options] = (workbookFromRunDocument as jest.Mock).mock.calls[0];
    expect(document.tables[0].rows).toEqual([['Alpha', '40.0%']]);
    expect(stem).toBe('Reach');
    expect(options).toEqual({ datasetId: 'ds-1' });
  });
});
