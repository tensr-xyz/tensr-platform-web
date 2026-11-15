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

const SLIDES = [
  { id: 'size', title: 'Size and projected reach' },
  { id: 'demographics', title: 'Demographics' },
  { id: 'seniority', title: 'Seniority and role' },
  { id: 'attitudes', title: 'Key attitudes' },
  { id: 'reach', title: 'Brand reach versus the total, with index' },
];

/** The audience overview deck: audience, template, and a reorderable slide list. */
export function OverviewDeck({ audience, onClose }: { audience: string; onClose: () => void }) {
  const [order, setOrder] = useState(SLIDES);
  const [saved, setSaved] = useState(false);
  const move = (index: number, direction: -1 | 1) => {
    const next = index + direction;
    if (next < 0 || next >= order.length) return;
    const copy = order.slice();
    const [item] = copy.splice(index, 1);
    if (!item) return;
    copy.splice(next, 0, item);
    setOrder(copy);
  };
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="share-dialog">
        <DialogHeader>
          <DialogTitle>Audience overview</DialogTitle>
          <DialogDescription>
            {audience || 'The total sample'}. Slides use the uploaded template’s layouts and theme.
          </DialogDescription>
        </DialogHeader>
        <p className="flow-muted">
          Uses the template chosen on Deliverables. Low bases stay flagged on the slide.
        </p>
        <ol>
          {order.map((slide, index) => (
            <li key={slide.id} className="details-member">
              <span>{slide.title}</span>
              <Button type="button" className="flow-btn" onClick={() => move(index, -1)}>
                Up
              </Button>
              <Button type="button" className="flow-btn" onClick={() => move(index, 1)}>
                Down
              </Button>
            </li>
          ))}
        </ol>
        <div className="flow-row">
          <Button type="button" className="flow-btn primary" onClick={() => setSaved(true)}>
            Save as a recipe
          </Button>
          <Button type="button" className="flow-btn" onClick={onClose}>
            Close
          </Button>
        </div>
        {saved ? <p className="flow-muted">Saved. The original deck is unchanged.</p> : null}
      </DialogContent>
    </Dialog>
  );
}

/** A new wave matched onto a saved deck. The original deck and file stay as they are. */
export function WaveRefresh({
  previous,
  next,
  onClose,
}: {
  previous: WaveColumn[];
  next: WaveColumn[];
  onClose: () => void;
}) {
  const matched = matchWave(previous, next);
  const [kept, setKept] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(matched.byLabel.map(item => [item.previous, true]))
  );
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="share-dialog">
        <DialogHeader>
          <DialogTitle>Refresh on a new wave</DialogTitle>
          <DialogDescription>
            {matched.byName.length} matched by name, {matched.byLabel.length} by label,{' '}
            {matched.missing.length} not found. The original deck and data stay unchanged.
          </DialogDescription>
        </DialogHeader>
        {matched.byLabel.map(item => (
          <div key={item.previous} className="details-member">
            <span>{item.label}</span>
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
          <p key={label} className="flow-muted">
            Not found: {label}. Fix the question or drop that slide.
          </p>
        ))}
        <Button type="button" className="flow-btn" onClick={onClose}>
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
}
