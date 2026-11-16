'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { matchWave, type WaveColumn } from '@/lib/wave-match';

export const OVERVIEW_SLIDES = [
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
    lowBase: true,
  },
];

/** The audience overview deck: template, slide list, low-base flags, saved as a recipe. */
export function OverviewDeck({
  audience,
  templateName,
  templateSummary,
  onClose,
}: {
  audience: string;
  templateName?: string;
  /** e.g. "9 layouts · theme colours found" from the uploaded PPTX. */
  templateSummary?: string;
  onClose: () => void;
}) {
  const [order, setOrder] = useState(OVERVIEW_SLIDES);
  const [saved, setSaved] = useState(false);
  const [headline, setHeadline] = useState(true);
  const [footnote, setFootnote] = useState(true);
  const [hideLow, setHideLow] = useState(false);
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
            <p>{audience || 'Total sample'}</p>
            <p className="flow-muted">Compared with: Total sample</p>
            <p>PowerPoint template</p>
            <p>{templateName || 'The template chosen on Deliverables'}</p>
            {templateSummary ? <p className="flow-muted">{templateSummary}</p> : null}
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
              {order.map((slide, index) => (
                <li key={slide.id}>
                  <span>{index + 1}</span>
                  <span>
                    {slide.title}
                    <span className="flow-muted">
                      {slide.lowBase && !hideLow ? ' · low-base note' : ''} {slide.note}
                    </span>
                  </span>
                  <Button type="button" className="flow-btn" onClick={() => move(index, -1)}>
                    Up
                  </Button>
                  <Button type="button" className="flow-btn" onClick={() => move(index, 1)}>
                    Down
                  </Button>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div className="flow-row">
          <Button type="button" className="flow-btn" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" className="flow-btn primary" onClick={() => setSaved(true)}>
            Build {order.length} slides
          </Button>
        </div>
        {saved ? (
          <p className="flow-muted">Saved as a recipe. The original deck is unchanged.</p>
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
