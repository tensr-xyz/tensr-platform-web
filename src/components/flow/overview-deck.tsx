'use client';

import { useEffect, useMemo, useState } from 'react';
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

/** A new wave matched onto a saved deck. The original deck and file stay as they are. */
export function WaveRefresh({
  previous,
  next,
  fileName,
  onChooseFile,
  onClose,
}: {
  previous: WaveColumn[];
  next: WaveColumn[];
  fileName?: string;
  onChooseFile?: () => void;
  onClose: () => void;
}) {
  const matched = matchWave(previous, next);
  const [step, setStep] = useState<'file' | 'matches' | 'moved'>(fileName ? 'matches' : 'file');
  const [kept, setKept] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(matched.byLabel.map(item => [item.previous, true]))
  );
  const [dropped, setDropped] = useState<Record<string, boolean>>({});
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="share-dialog deck-builder">
        <DialogHeader>
          <DialogDescription>Report</DialogDescription>
          <DialogTitle>Refresh with a new wave</DialogTitle>
        </DialogHeader>
        <p className="flow-muted">The current deck and data stay as they are</p>
        <div className="flow-row">
          <span>{fileName ? `Choose file · ${fileName}` : '1 · Choose file'}</span>
          <span>2 · Check matches</span>
          <span>3 · Review what moved</span>
        </div>
        {step === 'file' ? (
          <div>
            <p>Second wave</p>
            <Button
              type="button"
              className="flow-btn"
              onClick={() => {
                onChooseFile?.();
                setStep('matches');
              }}
            >
              Choose file
            </Button>
          </div>
        ) : null}
        {step === 'matches' ? (
          <div>
            <p>{matched.byName.length} questions matched by name</p>
            <p>{matched.byLabel.length} matched by label · check these</p>
            <p>{matched.missing.length} not found · slide affected</p>
            <p>Needs a look</p>
            {matched.byLabel.map(item => (
              <div key={item.previous} className="details-member">
                <span>
                  {item.previous} → {item.label}
                  <span className="flow-muted">Matched by label</span>
                </span>
                <Button
                  type="button"
                  className="flow-btn"
                  aria-pressed={kept[item.previous] !== false}
                  onClick={() =>
                    setKept(current => ({
                      ...current,
                      [item.previous]: current[item.previous] === false,
                    }))
                  }
                >
                  {kept[item.previous] === false ? 'Change' : 'Keep'}
                </Button>
              </div>
            ))}
            {matched.missing.map(label => (
              <div key={label} className="details-member">
                <span>
                  {label}
                  <span className="flow-muted">
                    Not found. No question in the new file has this name or a close label.
                  </span>
                </span>
                <Button
                  type="button"
                  className="flow-btn"
                  aria-pressed={dropped[label] === true}
                  onClick={() => setDropped(current => ({ ...current, [label]: !current[label] }))}
                >
                  {dropped[label] ? 'Slide dropped' : 'Drop slide'}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <p>Biggest movers since the previous wave</p>
            <p className="flow-muted">
              The new deck keeps the slide order and template. This summary is added as the last
              slide.
            </p>
          </div>
        )}
        <div className="flow-row">
          <Button type="button" className="flow-btn" onClick={onClose}>
            Cancel
          </Button>
          {step === 'matches' ? (
            <Button type="button" className="flow-btn" onClick={() => setStep('moved')}>
              Review what moved
            </Button>
          ) : null}
          <Button type="button" className="flow-btn primary" onClick={onClose}>
            Build new version
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
