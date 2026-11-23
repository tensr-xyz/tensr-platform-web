'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/rest';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChoiceSelect } from '@/components/ui/select';
import { valueLabel, type ColumnValues } from '@/components/flow/filters-panel-logic';
import { flowJson } from '@/lib/flow-api';
import { isIdColumn, isInternalColumn } from '@/lib/flow-columns';
import { matchWave, type WaveColumn } from '@/lib/wave-match';
import { formatMoverChange, formatMoverDetail, type WaveMover } from '@/lib/wave-movers';
import { ACCEPTED_UPLOAD_ACCEPT } from '@/lib/accepted-upload-types';

export type OverviewSlide = {
  id: string;
  title: string;
  note: string;
  lowBase?: boolean;
  lowBaseNote?: string;
};

export const OVERVIEW_SLIDES: OverviewSlide[] = [
  { id: 'title', title: 'Title', note: 'Title layout · audience definition as subtitle' },
  { id: 'size', title: 'Size and market split', note: 'People (000s)' },
  {
    id: 'reach',
    title: 'Title reach vs total, with index',
    note: 'Reach %, people (000s), index',
  },
  {
    id: 'demographics',
    title: 'Demographics: age, gender, income',
    note: 'Audience vs total · index',
  },
  { id: 'seniority', title: 'Seniority, role and sector', note: 'Audience vs total · index' },
  {
    id: 'attitudes',
    title: 'Key attitudes',
    note: 'Top statements where the audience over-indexes',
  },
  {
    id: 'market',
    title: 'Reach by market',
    note: 'A group under the base is shown with a low-base note',
  },
];

export type OverviewBuildRequest = {
  audience: string;
  slides: OverviewSlide[];
  headline: boolean;
  footnote: boolean;
  hideLow: boolean;
  lowBaseThreshold: number;
  /** When set, build one PowerPoint recipe per selected group value. */
  perMarket?: { groupColumn: string; values: string[] };
};

/** Body for /export/deck/overview — auto-builds tables from a saved audience. */
export function overviewDeckPayload(args: {
  audience: string;
  slides: OverviewSlide[];
  options: Record<string, unknown>;
  templateName?: string;
  templateBase64?: string;
  perMarket?: { groupColumn: string; values: string[] };
}): string {
  return JSON.stringify({
    audience: args.audience || '',
    slides: args.slides || [],
    options: args.options || {},
    template_name: args.templateName || '',
    ...(args.templateBase64 ? { template_base64: args.templateBase64 } : {}),
    ...(args.perMarket
      ? {
          per_market: {
            group_column: args.perMarket.groupColumn,
            values: args.perMarket.values,
          },
        }
      : {}),
  });
}

/** Body for /export/deck/batch when saving a market-deck family. */
export function overviewMarketBatchPayload(args: {
  specIds: string[];
  groupColumn: string;
  values: string[];
  name: string;
  audience?: string;
  slides?: OverviewSlide[];
  options?: Record<string, unknown>;
  templateName?: string;
}): string {
  return JSON.stringify({
    spec_ids: args.specIds,
    group_column: args.groupColumn,
    values: args.values,
    name: args.name,
    audience: args.audience || '',
    slides: args.slides || [],
    options: args.options || {},
    template_name: args.templateName || '',
    save_family: true,
  });
}

/** Body for /export/deck/refresh/batch. */
export function refreshDecksBatchPayload(args: {
  familyId?: string;
  deckSpecIds?: string[];
  onlyNewData?: boolean;
}): string {
  return JSON.stringify({
    family_id: args.familyId || '',
    deck_spec_ids: args.deckSpecIds || [],
    only_new_data: args.onlyNewData !== false,
  });
}

export type MarketDeckRow = {
  id: string;
  name: string;
  family_id?: string | null;
  group_label?: string | null;
  group_column_label?: string | null;
  new_data?: boolean;
  export_id?: string | null;
  n_versions?: number;
  n_slides?: number | null;
  wave_label?: string | null;
};

const MARKET_DECK_PREVIEW = 3;

/** Deliverables strip: market copies with New data and Refresh N decks (artboard 10i). */
export function MarketDecksPanel({
  decks,
  busy,
  newWaveLabel,
  onRefresh,
}: {
  decks: MarketDeckRow[];
  busy?: boolean;
  /** Label for the wave that just landed, when known (e.g. "Q4"). */
  newWaveLabel?: string;
  onRefresh: () => Promise<void> | void;
}) {
  if (!decks.length) return null;
  const newCount = decks.filter(row => row.new_data).length;
  const columnLabel =
    decks.find(row => row.group_column_label)?.group_column_label ||
    decks.find(row => row.group_label)?.group_label ||
    'group';
  const priorWave =
    decks.find(row => row.wave_label)?.wave_label || (newCount ? 'the previous wave' : '');
  const preview = decks.slice(0, MARKET_DECK_PREVIEW);
  const more = Math.max(0, decks.length - preview.length);
  const refreshLabel = (() => {
    if (busy) return 'Refreshing…';
    const count = newCount || decks.length;
    const noun = `Refresh ${count} deck${count === 1 ? '' : 's'}`;
    return newWaveLabel ? `${noun} with ${newWaveLabel}` : noun;
  })();
  return (
    <div className="market-decks" data-testid="market-decks">
      <p className="market-decks-eyebrow">Audience overview · one per {columnLabel}</p>
      {newCount ? (
        <div className="market-decks-banner" role="status">
          New data
          {newWaveLabel ? `: ${newWaveLabel} uploaded` : ' uploaded'}
          {`. ${newCount} market deck${newCount === 1 ? '' : 's'} use ${priorWave || 'an earlier wave'}.`}
        </div>
      ) : null}
      <ul>
        {preview.map(deck => {
          const slides = deck.n_slides || OVERVIEW_SLIDES.length;
          const wave = deck.wave_label || (deck.n_versions ? `v${deck.n_versions}` : null);
          return (
            <li key={deck.id}>
              <span>{deck.group_label || deck.name}</span>
              <span className="flow-muted">
                {wave ? `${wave} · ` : ''}
                {slides} slide{slides === 1 ? '' : 's'}
              </span>
            </li>
          );
        })}
        {more ? (
          <li className="market-decks-more">
            <span>+ {more} more</span>
            <span />
          </li>
        ) : null}
      </ul>
      {newCount ? (
        <>
          <p className="flow-muted market-decks-note">
            Refreshing keeps your layout and edits, updates every number and chart, and rewrites
            commentary where numbers moved. Earlier versions stay in history.
          </p>
          <div className="market-decks-actions">
            <Button
              type="button"
              className="flow-btn accent"
              disabled={busy}
              onClick={() => void onRefresh()}
            >
              {refreshLabel}
            </Button>
          </div>
        </>
      ) : (
        <p className="flow-muted market-decks-note">
          One overview copy per {columnLabel}. When a new wave is uploaded this set shows New data
          and a single Refresh button.
        </p>
      )}
    </div>
  );
}

const LOW_BASE_THRESHOLD = 50;

function formatCount(value: number | undefined | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return Math.round(value).toLocaleString('en-GB');
}

/** The audience overview deck: template, slide list, low-base flags, saved as a recipe. */
export function OverviewDeck({
  audience,
  audiences,
  slides,
  templateName,
  templateSummary,
  datasetId,
  projectLabel,
  dataLabel,
  weightLabel,
  onReplaceTemplate,
  onBuild,
  onClose,
}: {
  audience: string;
  audiences?: string[];
  /** When set, replaces the default slide list (e.g. after a low-base scan). */
  slides?: OverviewSlide[];
  templateName?: string;
  /** e.g. "9 layouts · theme colours found" from the uploaded PPTX. */
  templateSummary?: string;
  datasetId?: string;
  /** Project name shown in the dialog eyebrow. */
  projectLabel?: string;
  /** Open file name for the Data section (labels only). */
  dataLabel?: string;
  /** Active weight label, when the project has one. */
  weightLabel?: string;
  onReplaceTemplate?: () => void;
  onBuild?: (request: OverviewBuildRequest) => Promise<void> | void;
  onClose: () => void;
}) {
  const initial = useMemo(() => slides || OVERVIEW_SLIDES, [slides]);
  const [order, setOrder] = useState(initial);
  const [chosenAudience, setChosenAudience] = useState(audience || '');
  const [saved, setSaved] = useState(false);
  const [downloadNote, setDownloadNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    // Keep the picker on the audience the parent passed (do not snap to Total).
    if (audience) setChosenAudience(audience);
  }, [audience]);
  const [headline, setHeadline] = useState(true);
  const [footnote, setFootnote] = useState(true);
  const [hideLow, setHideLow] = useState(false);
  const [perMarket, setPerMarket] = useState(Boolean(datasetId));
  const [groupColumn, setGroupColumn] = useState('');
  const [groupOptions, setGroupOptions] = useState<{ value: string; label: string }[]>([]);
  const [groupValues, setGroupValues] = useState<ColumnValues | null>(null);
  const [weightedCounts, setWeightedCounts] = useState<Record<string, number>>({});
  const [pickedGroups, setPickedGroups] = useState<Record<string, boolean>>({});
  const [metaWeightLabel, setMetaWeightLabel] = useState('');
  const [metaDataLabel, setMetaDataLabel] = useState('');
  useEffect(() => {
    if (!datasetId) return;
    let live = true;
    void flowJson<{
      columns?: { name?: string; label?: string; measure?: string }[];
      active_weight_label?: string;
      original_filename?: string;
      filename?: string;
    }>(`/datasets/${datasetId}/metadata`)
      .then(body => {
        if (!live) return;
        const next = (body.columns || [])
          .filter(col => {
            const name = String(col.name || '');
            if (!name || isInternalColumn(name) || isIdColumn(name)) return false;
            const measure = String(col.measure || '').toLowerCase();
            return measure !== 'numeric' && measure !== 'text' && measure !== 'datetime';
          })
          .map(col => ({
            value: String(col.name || ''),
            label: String(col.label || col.name || '').trim() || String(col.name || ''),
          }));
        setGroupOptions(next);
        if (!groupColumn && next[0]) setGroupColumn(next[0].value);
        const weight = String(body.active_weight_label || '').trim();
        if (weight) setMetaWeightLabel(weight);
        const file = String(body.original_filename || body.filename || '').trim();
        if (file) setMetaDataLabel(file);
      })
      .catch(() => {
        if (live) setGroupOptions([]);
      });
    return () => {
      live = false;
    };
  }, [datasetId, groupColumn]);
  useEffect(() => {
    if (!datasetId || !perMarket || !groupColumn) {
      setGroupValues(null);
      setWeightedCounts({});
      return;
    }
    let live = true;
    void flowJson<ColumnValues>(
      `/datasets/${datasetId}/columns/${encodeURIComponent(groupColumn)}/values`
    )
      .then(body => {
        if (!live) return;
        setGroupValues(body);
        setWeightedCounts(
          body.weighted_counts && typeof body.weighted_counts === 'object'
            ? body.weighted_counts
            : {}
        );
        const weight = String(body.weight_label || '').trim();
        if (weight) setMetaWeightLabel(weight);
        setPickedGroups(
          Object.fromEntries(
            (body.values || []).map(value => {
              const count = Number(body.counts?.[value] ?? 0);
              return [value, count >= LOW_BASE_THRESHOLD];
            })
          )
        );
      })
      .catch(() => {
        if (live) {
          setGroupValues(null);
          setWeightedCounts({});
        }
      });
    return () => {
      live = false;
    };
  }, [datasetId, perMarket, groupColumn]);
  const groupColumnLabel =
    groupOptions.find(option => option.value === groupColumn)?.label || 'Market';
  const marketRows = useMemo(() => {
    const values = groupValues?.values || [];
    return values.map(value => {
      const respondents = Number(groupValues?.counts?.[value] ?? 0);
      const lowBase = respondents < LOW_BASE_THRESHOLD;
      return {
        value,
        label: valueLabel(value, groupValues?.value_labels),
        respondents,
        people: weightedCounts[value],
        lowBase,
      };
    });
  }, [groupValues, weightedCounts]);
  const visibleMarkets = hideLow ? marketRows.filter(row => !row.lowBase) : marketRows;
  const selectedMarkets = visibleMarkets.filter(
    row => !row.lowBase && pickedGroups[row.value] !== false
  );
  const move = (index: number, direction: -1 | 1) => {
    const next = index + direction;
    if (next < 0 || next >= order.length) return;
    const copy = order.slice();
    const [item] = copy.splice(index, 1);
    if (!item) return;
    copy.splice(next, 0, item);
    setOrder(copy);
    setSaved(false);
  };
  const build = () => {
    if (!onBuild) {
      setSaved(true);
      return;
    }
    const values = selectedMarkets.map(row => row.value);
    if (perMarket) {
      if (!groupColumn.trim()) {
        setError('Choose a column to make one copy per market.');
        return;
      }
      if (!values.length) {
        setError('Choose at least one market value.');
        return;
      }
    }
    setBusy(true);
    setError('');
    setDownloadNote('');
    const buildAudience = chosenAudience || audience || 'Total sample';
    const nDecks = perMarket ? values.length : 1;
    void Promise.resolve(
      onBuild({
        audience: buildAudience,
        slides: order,
        headline,
        footnote,
        hideLow,
        lowBaseThreshold: LOW_BASE_THRESHOLD,
        ...(perMarket ? { perMarket: { groupColumn, values } } : {}),
      })
    )
      .then(() => {
        setSaved(true);
        setDownloadNote(
          perMarket
            ? `Downloaded ${nDecks} deck${nDecks === 1 ? '' : 's'} for ${buildAudience}.`
            : `Downloaded the overview deck for ${buildAudience}.`
        );
      })
      .catch(err => setError(err instanceof Error ? err.message : 'The deck did not build.'))
      .finally(() => setBusy(false));
  };
  const eyebrow = projectLabel ? `${projectLabel} · Report` : 'Report';
  const title = perMarket
    ? 'New audience overview · one copy per market'
    : 'New audience overview deck';
  const primaryLabel = busy
    ? 'Building…'
    : perMarket
      ? `Build ${selectedMarkets.length} deck${selectedMarkets.length === 1 ? '' : 's'}`
      : `Build ${order.length} slides`;
  const shownData = dataLabel || metaDataLabel;
  const shownWeight = weightLabel || metaWeightLabel;
  const setupColumn = (
    <div className="deck-setup">
      <section className="deck-setup-section">
        <h3>Audience</h3>
        {audiences && audiences.length ? (
          <ChoiceSelect
            aria-label="Audience"
            className="flow-input deck-setup-field"
            value={chosenAudience}
            onValueChange={value => {
              setChosenAudience(value);
              setSaved(false);
            }}
            options={[
              { value: '', label: 'Total sample' },
              ...audiences.map(name => ({ value: name, label: name })),
            ]}
          />
        ) : (
          <p className="deck-setup-field">{chosenAudience || audience || 'Total sample'}</p>
        )}
        <p className="flow-muted">Compared with: Total sample</p>
      </section>
      {(shownData || shownWeight) && (
        <section className="deck-setup-section">
          <h3>Data</h3>
          {shownData ? (
            <div className="deck-setup-field deck-setup-data">
              <span>{shownData}</span>
              <span className="flow-muted">Latest</span>
            </div>
          ) : null}
          {shownWeight ? <p className="flow-muted">Weight: {shownWeight}</p> : null}
        </section>
      )}
      <section className="deck-setup-section">
        <h3>PowerPoint template</h3>
        <div className="deck-setup-template">
          <div className="deck-template-thumb" aria-hidden />
          <div className="deck-setup-template-copy">
            <p>{templateName || 'The template chosen on Deliverables'}</p>
            {templateSummary ? <p className="flow-muted">{templateSummary}</p> : null}
          </div>
          {onReplaceTemplate ? (
            <Button type="button" className="flow-btn linkish" onClick={onReplaceTemplate}>
              Replace
            </Button>
          ) : null}
        </div>
        <p className="flow-muted">
          Each slide uses the template&apos;s own layout and placeholders. Charts and tables stay
          editable in PowerPoint.
        </p>
      </section>
      <section className="deck-setup-section">
        <h3>On every slide</h3>
        <label className="deck-check">
          <Checkbox
            checked={headline}
            onCheckedChange={on => {
              setHeadline(on === true);
              setSaved(false);
            }}
          />
          <span>Headline written from the numbers</span>
        </label>
        <label className="deck-check">
          <Checkbox
            checked={footnote}
            onCheckedChange={on => {
              setFootnote(on === true);
              setSaved(false);
            }}
          />
          <span>Base, weight and source footnote</span>
        </label>
        <label className="deck-check">
          <Checkbox
            checked={hideLow}
            onCheckedChange={on => {
              setHideLow(on === true);
              setSaved(false);
            }}
          />
          <span>Hide groups with base under {LOW_BASE_THRESHOLD}</span>
        </label>
        {datasetId ? (
          <label className="deck-per-market">
            <span>
              <strong>One copy per market</strong>
              <span className="flow-muted">
                {' '}
                Separate deck for each value; refresh together when data changes
              </span>
            </span>
            <Switch
              checked={perMarket}
              onCheckedChange={on => {
                setPerMarket(on);
                setSaved(false);
              }}
              aria-label="One copy per market"
            />
          </label>
        ) : null}
      </section>
      <div className="deck-recipe-note">
        <p>Saved as a recipe</p>
        <p className="flow-muted">
          Rebuild this deck for another audience or a new wave from Report → Recipes.
        </p>
      </div>
    </div>
  );
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent
        className={
          perMarket ? 'share-dialog deck-builder deck-builder-markets' : 'share-dialog deck-builder'
        }
      >
        <div className="deck-builder-head">
          <DialogHeader className="deck-builder-titles">
            <DialogDescription>{eyebrow}</DialogDescription>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="deck-builder-actions">
            <Button type="button" className="flow-btn" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              className="flow-btn primary"
              disabled={busy || (perMarket && selectedMarkets.length === 0)}
              onClick={() => build()}
            >
              {primaryLabel}
            </Button>
          </div>
        </div>
        <div className={perMarket ? 'deck-columns deck-columns-markets' : 'deck-columns'}>
          {setupColumn}
          {perMarket ? (
            <div className="deck-markets" data-testid="overview-per-market">
              <div className="deck-markets-head">
                <div>
                  <h3>
                    Market decks · {selectedMarkets.length} of {visibleMarkets.length} selected
                  </h3>
                  <p className="flow-muted">
                    One deck per value of {groupColumnLabel}. Same {order.length}
                    {' slides '}
                    in each, built on that market&apos;s audience.
                  </p>
                </div>
                <label className="deck-markets-column">
                  <span className="flow-muted">Market column</span>
                  <ChoiceSelect
                    aria-label="Market column"
                    className="flow-input"
                    value={groupColumn}
                    onValueChange={value => {
                      setGroupColumn(value);
                      setSaved(false);
                    }}
                    options={groupOptions}
                    placeholder="Choose a column"
                  />
                </label>
              </div>
              <div className="deck-markets-table" role="table" aria-label="Market decks">
                <div className="deck-markets-row head" role="row">
                  <span className="check" role="columnheader" />
                  <span role="columnheader">Market</span>
                  <span className="num" role="columnheader">
                    Respondents
                  </span>
                  <span className="num" role="columnheader">
                    Audience (people)
                  </span>
                  <span className="status" role="columnheader">
                    Status
                  </span>
                </div>
                {visibleMarkets.length === 0 ? (
                  <p className="flow-muted deck-markets-empty">
                    {groupColumn ? 'Loading values…' : 'Choose a column first.'}
                  </p>
                ) : (
                  visibleMarkets.map(row => {
                    const skipped = row.lowBase;
                    const checked = !skipped && pickedGroups[row.value] !== false;
                    return (
                      <label
                        key={row.value}
                        className={skipped ? 'deck-markets-row skipped' : 'deck-markets-row'}
                        role="row"
                      >
                        <span className="check">
                          <Checkbox
                            checked={checked}
                            disabled={skipped}
                            onCheckedChange={on => {
                              if (skipped) return;
                              setPickedGroups(current => ({
                                ...current,
                                [row.value]: on === true,
                              }));
                              setSaved(false);
                            }}
                            aria-label={row.label}
                          />
                        </span>
                        <span>{row.label}</span>
                        <span className="num">{formatCount(row.respondents)}</span>
                        <span className="num">{formatCount(row.people)}</span>
                        <span className={skipped ? 'status warn' : 'status ready'}>
                          {skipped ? `Base under ${LOW_BASE_THRESHOLD} · skipped` : 'Ready'}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
              <div className="deck-markets-foot">
                <p className="flow-muted">
                  Decks are saved as one set. When a new wave is uploaded the set shows &quot;New
                  data&quot; and a single Refresh button, and your layout and edits are kept (see
                  Refresh with a new wave).
                </p>
                <p className="flow-muted">
                  Markets under the base threshold are skipped; change the threshold in the options
                  on the left.
                </p>
              </div>
            </div>
          ) : (
            <div className="deck-slides">
              <p>Slides · drag to reorder</p>
              <ol>
                {order.map((slide, index) => {
                  const showLow = Boolean(slide.lowBase || slide.lowBaseNote) && !hideLow;
                  return (
                    <li key={slide.id} className={showLow ? 'deck-slide-low' : undefined}>
                      <span>{index + 1}</span>
                      <span>
                        {slide.title}
                        <span className={showLow ? 'deck-low-note' : 'flow-muted'}>
                          {showLow ? ` · ${slide.lowBaseNote || 'shown with a low-base note'}` : ''}{' '}
                          {slide.note}
                        </span>
                      </span>
                      <Button type="button" className="flow-btn" onClick={() => move(index, -1)}>
                        Up
                      </Button>
                      <Button type="button" className="flow-btn" onClick={() => move(index, 1)}>
                        Down
                      </Button>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
        {error ? <p className="flow-error deck-builder-error">{error}</p> : null}
        {saved ? (
          <p className="flow-muted deck-builder-saved" data-testid="overview-deck-saved">
            {downloadNote ? `${downloadNote} ` : ''}
            {perMarket
              ? 'Saved one recipe per market. Refresh them together when new data arrives.'
              : 'Saved as a recipe. The original deck is unchanged.'}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export type WaveRefreshBuildRequest = {
  kept: Record<string, boolean>;
  dropped: Record<string, boolean>;
  fileName: string;
  matchedByName: string[];
  matchedByLabel: { previous: string; next: string; label: string }[];
  missing: string[];
};

/** A new wave matched onto a saved deck. The original deck and file stay as they are. */
export function WaveRefresh({
  previous,
  next,
  fileName,
  deckLabel,
  audienceLabel,
  audienceCarryNote,
  movers = [],
  choosingFile,
  onPickFile,
  onBuild,
  onClose,
}: {
  previous: WaveColumn[];
  next: WaveColumn[];
  fileName?: string;
  deckLabel?: string;
  audienceLabel?: string;
  audienceCarryNote?: string;
  movers?: WaveMover[];
  choosingFile?: boolean;
  /** Opens a file picker; parent uploads and supplies `next` + `fileName`. */
  onPickFile?: (file: File) => void | Promise<void>;
  onBuild?: (request: WaveRefreshBuildRequest) => void | Promise<void>;
  onClose: () => void;
}) {
  const matched = matchWave(previous, next);
  const hasNext = next.length > 0 || Boolean(fileName);
  const [step, setStep] = useState<'file' | 'matches' | 'moved'>(hasNext ? 'matches' : 'file');
  const [kept, setKept] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(matched.byLabel.map(item => [item.previous, true]))
  );
  const [dropped, setDropped] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (hasNext && step === 'file') setStep('matches');
  }, [hasNext, step]);

  const labelMatchKey = matched.byLabel.map(item => item.previous).join('|');
  useEffect(() => {
    setKept(Object.fromEntries(matched.byLabel.map(item => [item.previous, true])));
  }, [labelMatchKey]);

  const previousByName = useMemo(
    () => new Map(previous.map(column => [column.name, column])),
    [previous]
  );

  const build = async () => {
    if (!onBuild) {
      onClose();
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onBuild({
        kept,
        dropped,
        fileName: fileName || '',
        matchedByName: matched.byName,
        matchedByLabel: matched.byLabel,
        missing: matched.missing,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the new version.');
    } finally {
      setBusy(false);
    }
  };

  const stepFile = fileName ? `✓ Choose file · ${fileName}` : '1 · Choose file';
  const reportLine = deckLabel ? `Report · ${deckLabel}` : 'Report · Refresh with a new wave';

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="share-dialog deck-builder wave-refresh">
        <div className="deck-builder-head">
          <DialogHeader className="deck-builder-titles">
            <DialogDescription>{reportLine}</DialogDescription>
            <DialogTitle>Refresh with a new wave</DialogTitle>
          </DialogHeader>
          <div className="wave-refresh-toolbar">
            <p className="flow-muted">The current deck and data stay as they are</p>
            <div className="deck-builder-actions">
              <Button type="button" className="flow-btn" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                className="flow-btn primary"
                disabled={busy || (!hasNext && step === 'file')}
                onClick={() => void build()}
              >
                {busy ? 'Building…' : 'Build new version'}
              </Button>
            </div>
          </div>
        </div>
        <div className="wave-refresh-steps">
          <span className={hasNext ? 'wave-refresh-step done' : undefined}>{stepFile}</span>
          <span className={step === 'matches' ? 'wave-refresh-step active' : undefined}>
            2 · Check matches
          </span>
          <span className={step === 'moved' ? 'wave-refresh-step active' : undefined}>
            3 · Review what moved
          </span>
        </div>
        <Input
          ref={fileInput}
          type="file"
          accept={ACCEPTED_UPLOAD_ACCEPT}
          className="sr-only"
          aria-label="Second wave file"
          onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file || !onPickFile) return;
            void Promise.resolve(onPickFile(file)).then(() => setStep('matches'));
          }}
        />
        {step === 'file' ? (
          <div className="wave-refresh-file">
            <p>Second wave</p>
            <p className="flow-muted">
              Choose the updated file. Questions are matched by name, then by label. The current
              deck stays as it is.
            </p>
            <Button
              type="button"
              className="flow-btn"
              disabled={choosingFile || !onPickFile}
              onClick={() => fileInput.current?.click()}
            >
              {choosingFile ? 'Reading file…' : 'Choose file'}
            </Button>
          </div>
        ) : null}
        {step === 'matches' ? (
          <div className="wave-refresh-body">
            <div className="wave-refresh-matches">
              <div className="wave-refresh-counts">
                <div className="wave-refresh-count">
                  <strong className="wave-refresh-count-ok">{matched.byName.length}</strong>
                  <span>questions matched by name</span>
                </div>
                <div className="wave-refresh-count">
                  <strong>{matched.byLabel.length}</strong>
                  <span>matched by label · check these</span>
                </div>
                <div className="wave-refresh-count">
                  <strong className="wave-refresh-count-warn">{matched.missing.length}</strong>
                  <span>not found · slide affected</span>
                </div>
              </div>
              {matched.byLabel.length || matched.missing.length ? (
                <p className="wave-refresh-needs">Needs a look</p>
              ) : (
                <p className="flow-muted">Every question matched by name.</p>
              )}
              {matched.missing.map(label => (
                <div key={label} className="wave-refresh-row wave-refresh-row-missing">
                  <div className="wave-refresh-row-main">
                    <div className="wave-refresh-row-title">
                      <span>{label}</span>
                      <span className="wave-refresh-pill warn">Not found</span>
                    </div>
                    <p className="flow-muted">
                      No question in the new file has this name or a close label.
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="flow-btn"
                    aria-pressed={dropped[label] === true}
                    onClick={() =>
                      setDropped(current => ({ ...current, [label]: !current[label] }))
                    }
                  >
                    {dropped[label] ? 'Slide dropped' : 'Drop slide'}
                  </Button>
                </div>
              ))}
              {matched.byLabel.map(item => {
                const prior = previousByName.get(item.previous);
                const priorLabel = prior?.label || item.previous;
                const keep = kept[item.previous] !== false;
                return (
                  <div key={item.previous} className="wave-refresh-row">
                    <div className="wave-refresh-row-main">
                      <p>
                        {priorLabel} → <strong>{item.label}</strong>
                      </p>
                      <p className="flow-muted">Matched by label</p>
                    </div>
                    <div className="wave-refresh-keep">
                      <Button
                        type="button"
                        className={keep ? 'flow-btn wave-refresh-keep-on' : 'flow-btn'}
                        aria-pressed={keep}
                        onClick={() => setKept(current => ({ ...current, [item.previous]: true }))}
                      >
                        Keep
                      </Button>
                      <Button
                        type="button"
                        className={!keep ? 'flow-btn wave-refresh-keep-on' : 'flow-btn'}
                        aria-pressed={!keep}
                        onClick={() => setKept(current => ({ ...current, [item.previous]: false }))}
                      >
                        Change
                      </Button>
                    </div>
                  </div>
                );
              })}
              {audienceLabel ? (
                <div className="wave-refresh-audience">
                  <span>Audience &quot;{audienceLabel}&quot; carries over</span>
                  <span className="wave-refresh-audience-ok">
                    {audienceCarryNote || 'All conditions matched'}
                  </span>
                </div>
              ) : null}
            </div>
            <aside className="wave-refresh-movers">
              <div>
                <p className="wave-refresh-movers-title">Biggest movers since the previous wave</p>
                <p className="flow-muted">
                  {audienceLabel
                    ? `${audienceLabel} · preview from matched questions`
                    : 'Preview from matched questions'}
                </p>
              </div>
              {movers.length ? (
                movers.slice(0, 6).map(mover => (
                  <div key={mover.label} className="wave-refresh-mover">
                    <div className="wave-refresh-mover-head">
                      <span>{mover.label}</span>
                      <strong
                        className={
                          mover.significant
                            ? mover.change > 0
                              ? 'wave-refresh-count-ok'
                              : 'wave-refresh-count-warn'
                            : undefined
                        }
                      >
                        {formatMoverChange(mover.change)}
                      </strong>
                    </div>
                    <p className="flow-muted">{formatMoverDetail(mover)}</p>
                  </div>
                ))
              ) : (
                <p className="flow-muted">
                  Movers appear once both waves have figures for the matched questions.
                </p>
              )}
              <p className="flow-muted wave-refresh-movers-note">
                The new deck keeps the slide order and template. This summary is added as the last
                slide.
              </p>
            </aside>
          </div>
        ) : null}
        {step === 'moved' ? (
          <div className="wave-refresh-review">
            <p className="wave-refresh-movers-title">Biggest movers since the previous wave</p>
            {movers.length ? (
              <ul className="wave-refresh-review-list">
                {movers.slice(0, 10).map(mover => (
                  <li key={mover.label}>
                    <strong>{mover.label}</strong> {formatMoverChange(mover.change)} ·{' '}
                    {formatMoverDetail(mover)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flow-muted">No figure moved yet, or bases are still loading.</p>
            )}
            <p className="flow-muted">
              The new deck keeps the slide order and template. This summary is added as the last
              slide. The original deck is unchanged.
            </p>
          </div>
        ) : null}
        {error ? <p className="flow-error wave-refresh-error">{error}</p> : null}
        {step === 'file' ? null : (
          <div className="wave-refresh-foot">
            {step === 'matches' ? (
              <Button type="button" className="flow-btn" onClick={() => setStep('moved')}>
                Review what moved
              </Button>
            ) : null}
            {step === 'moved' ? (
              <Button type="button" className="flow-btn" onClick={() => setStep('matches')}>
                Back to matches
              </Button>
            ) : null}
            <Button
              type="button"
              className="flow-btn"
              disabled={choosingFile}
              onClick={() => fileInput.current?.click()}
            >
              {fileName ? 'Change file' : 'Choose file'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
