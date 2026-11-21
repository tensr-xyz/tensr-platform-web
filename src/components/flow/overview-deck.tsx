'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
};

/** Deliverables strip: market copies with New data and Refresh N decks. */
export function MarketDecksPanel({
  decks,
  busy,
  onRefresh,
}: {
  decks: MarketDeckRow[];
  busy?: boolean;
  onRefresh: () => Promise<void> | void;
}) {
  if (!decks.length) return null;
  const newCount = decks.filter(row => row.new_data).length;
  const columnLabel =
    decks.find(row => row.group_column_label)?.group_column_label ||
    decks.find(row => row.group_label)?.group_label ||
    'group';
  return (
    <div className="market-decks" data-testid="market-decks">
      <div className="market-decks-head">
        <div>
          <h3>Market decks</h3>
          <p className="flow-muted">
            One overview copy per {columnLabel}
            {newCount ? ` · ${newCount} with new data` : ''}
          </p>
        </div>
        {newCount ? (
          <Button
            type="button"
            className="flow-btn primary"
            disabled={busy}
            onClick={() => void onRefresh()}
          >
            {busy ? 'Refreshing…' : `Refresh ${newCount} deck${newCount === 1 ? '' : 's'}`}
          </Button>
        ) : null}
      </div>
      <ul>
        {decks.map(deck => (
          <li key={deck.id}>
            <span>
              {deck.group_label || deck.name}
              {deck.n_versions ? (
                <span className="flow-muted">
                  {' '}
                  · {deck.n_versions} earlier version{deck.n_versions === 1 ? '' : 's'}
                </span>
              ) : null}
            </span>
            {deck.new_data ? <span className="market-deck-new">New data</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The audience overview deck: template, slide list, low-base flags, saved as a recipe. */
export function OverviewDeck({
  audience,
  audiences,
  slides,
  templateName,
  templateSummary,
  datasetId,
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
  onReplaceTemplate?: () => void;
  onBuild?: (request: OverviewBuildRequest) => Promise<void> | void;
  onClose: () => void;
}) {
  const initial = useMemo(() => slides || OVERVIEW_SLIDES, [slides]);
  const [order, setOrder] = useState(initial);
  const [chosenAudience, setChosenAudience] = useState(audience || '');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [headline, setHeadline] = useState(true);
  const [footnote, setFootnote] = useState(true);
  const [hideLow, setHideLow] = useState(false);
  const [perMarket, setPerMarket] = useState(false);
  const [groupColumn, setGroupColumn] = useState('');
  const [groupOptions, setGroupOptions] = useState<{ value: string; label: string }[]>([]);
  const [groupValues, setGroupValues] = useState<ColumnValues | null>(null);
  const [pickedGroups, setPickedGroups] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!datasetId || !perMarket) return;
    let live = true;
    void flowJson<{
      columns?: { name?: string; label?: string; measure?: string }[];
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
      })
      .catch(() => {
        if (live) setGroupOptions([]);
      });
    return () => {
      live = false;
    };
  }, [datasetId, perMarket, groupColumn]);
  useEffect(() => {
    if (!datasetId || !perMarket || !groupColumn) {
      setGroupValues(null);
      return;
    }
    let live = true;
    void flowJson<ColumnValues>(
      `/datasets/${datasetId}/columns/${encodeURIComponent(groupColumn)}/values`
    )
      .then(body => {
        if (!live) return;
        setGroupValues(body);
        setPickedGroups(Object.fromEntries((body.values || []).map(value => [value, true])));
      })
      .catch(() => {
        if (live) setGroupValues(null);
      });
    return () => {
      live = false;
    };
  }, [datasetId, perMarket, groupColumn]);
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
    const values = Object.entries(pickedGroups)
      .filter(([, on]) => on)
      .map(([value]) => value);
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
    void Promise.resolve(
      onBuild({
        audience: chosenAudience || audience || 'Total sample',
        slides: order,
        headline,
        footnote,
        hideLow,
        lowBaseThreshold: 50,
        ...(perMarket ? { perMarket: { groupColumn, values } } : {}),
      })
    )
      .then(() => setSaved(true))
      .catch(err => setError(err instanceof Error ? err.message : 'The deck did not build.'))
      .finally(() => setBusy(false));
  };
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="share-dialog deck-builder">
        <DialogHeader>
          <DialogDescription>Report</DialogDescription>
          <DialogTitle>New audience overview deck</DialogTitle>
        </DialogHeader>
        <div className="deck-columns">
          <div className="deck-setup">
            <p>Audience</p>
            {audiences && audiences.length ? (
              <ChoiceSelect
                aria-label="Audience"
                className="flow-input"
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
              <p>{chosenAudience || audience || 'Total sample'}</p>
            )}
            <p className="flow-muted">Compared with: Total sample</p>
            <p>PowerPoint template</p>
            <p>{templateName || 'The template chosen on Deliverables'}</p>
            {templateSummary ? <p className="flow-muted">{templateSummary}</p> : null}
            {onReplaceTemplate ? (
              <Button type="button" className="flow-btn" onClick={onReplaceTemplate}>
                Replace
              </Button>
            ) : null}
            <p className="flow-muted">
              Each slide uses the template&apos;s own layout and placeholders. Charts and tables
              stay editable in PowerPoint.
            </p>
            <p>On every slide</p>
            <Button
              type="button"
              className="flow-btn"
              aria-pressed={headline}
              onClick={() => setHeadline(value => !value)}
            >
              Headline written from the numbers
            </Button>
            <Button
              type="button"
              className="flow-btn"
              aria-pressed={footnote}
              onClick={() => setFootnote(value => !value)}
            >
              Base, weight and source footnote
            </Button>
            <Button
              type="button"
              className="flow-btn"
              aria-pressed={hideLow}
              onClick={() => setHideLow(value => !value)}
            >
              Hide groups with base under 50
            </Button>
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
            {datasetId && perMarket ? (
              <div className="deck-per-market-fields" data-testid="overview-per-market">
                <p>Market column</p>
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
                <p>Values</p>
                <div className="deck-per-market-values">
                  {(groupValues?.values || []).length === 0 ? (
                    <p className="flow-muted">
                      {groupColumn ? 'Loading values…' : 'Choose a column first.'}
                    </p>
                  ) : (
                    (groupValues?.values || []).map(value => (
                      <label key={value} className="deck-per-market-item">
                        <Checkbox
                          checked={pickedGroups[value] !== false}
                          onCheckedChange={on =>
                            setPickedGroups(current => ({
                              ...current,
                              [value]: on === true,
                            }))
                          }
                        />
                        <span>
                          {valueLabel(value, groupValues?.value_labels)}
                          {typeof groupValues?.counts?.[value] === 'number'
                            ? ` · ${groupValues.counts[value]}`
                            : ''}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            ) : null}
            <div>
              <p>Saved as a recipe</p>
              <p className="flow-muted">
                Rebuild this deck for another audience or a new wave from Report.
              </p>
            </div>
          </div>
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
        </div>
        {error ? <p className="flow-error">{error}</p> : null}
        <div className="flow-row">
          <Button type="button" className="flow-btn" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="flow-btn primary"
            disabled={busy}
            onClick={() => build()}
          >
            {busy ? 'Building…' : `Build ${order.length} slides`}
          </Button>
        </div>
        {saved ? (
          <p className="flow-muted">
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
        <DialogHeader>
          <DialogDescription>{reportLine}</DialogDescription>
          <DialogTitle>Refresh with a new wave</DialogTitle>
        </DialogHeader>
        <div className="wave-refresh-toolbar">
          <p className="flow-muted">The current deck and data stay as they are</p>
          <div className="flow-row">
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
        <div className="wave-refresh-steps">
          <span className={hasNext ? 'wave-refresh-step done' : undefined}>{stepFile}</span>
          <span className={step === 'matches' ? 'wave-refresh-step active' : undefined}>
            2 · Check matches
          </span>
          <span className={step === 'moved' ? 'wave-refresh-step active' : undefined}>
            3 · Review what moved
          </span>
        </div>
        <input
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
        {error ? <p className="flow-error">{error}</p> : null}
        <div className="flow-row">
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
          {step === 'file' ? null : (
            <Button
              type="button"
              className="flow-btn"
              disabled={choosingFile}
              onClick={() => fileInput.current?.click()}
            >
              {fileName ? 'Change file' : 'Choose file'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
