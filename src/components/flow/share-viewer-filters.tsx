'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/rest';
import {
  DEFAULT_ALL_LABEL,
  normalizeSavedViews,
  viewerControlChipText,
  type PublicViewerControl,
  type SavedViewerView,
} from '@/lib/share-viewer-controls';

const ALL_VALUE = '__all__';

function selectionForControl(
  control: PublicViewerControl,
  values: Record<string, unknown>
): unknown {
  return values[control.id];
}

function setDropdownValue(
  control: PublicViewerControl,
  next: string
): string | typeof ALL_VALUE | string[] {
  if (next === ALL_VALUE || next === control.allLabel) return ALL_VALUE;
  return next;
}

/** Paper 9f: filter chips + Save view on a shared output. */
export function ShareViewerFilters({
  controls,
  savedViews,
  values,
  busy,
  error,
  onChange,
  onSaveView,
  onApplyView,
}: {
  controls: PublicViewerControl[];
  savedViews?: SavedViewerView[] | unknown[];
  values: Record<string, unknown>;
  busy?: boolean;
  error?: string;
  onChange: (next: Record<string, unknown>) => void;
  onSaveView: (name: string, values: Record<string, unknown>) => void;
  onApplyView?: (view: SavedViewerView) => void;
}) {
  const [naming, setNaming] = useState(false);
  const [viewName, setViewName] = useState('');
  const views = useMemo(() => normalizeSavedViews(savedViews), [savedViews]);

  if (!controls.length) return null;

  const update = (controlId: string, raw: unknown) => {
    const next = { ...values };
    if (raw === ALL_VALUE || raw == null) delete next[controlId];
    else next[controlId] = raw;
    onChange(next);
  };

  const save = () => {
    const name = viewName.trim();
    if (!name) return;
    onSaveView(name, values);
    setViewName('');
    setNaming(false);
  };

  return (
    <div className="share-viewer-filters" aria-label="Viewer filters">
      <div className="share-viewer-filters-row">
        <span className="share-viewer-filters-label">Filter</span>
        {controls.map(control => {
          const raw = selectionForControl(control, values);
          const chip = viewerControlChipText(control, raw);
          const allLabel = (control.allLabel || DEFAULT_ALL_LABEL).replace(/^\(|\)$/g, '') || 'All';
          return (
            <DropdownMenu key={control.id}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={
                    chip.active ? 'share-viewer-filter-chip active' : 'share-viewer-filter-chip'
                  }
                  disabled={busy}
                  aria-label={`${control.label} filter`}
                >
                  {chip.text} ▾
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="share-viewer-filter-menu">
                {control.type === 'text' ? (
                  <div className="share-viewer-filter-text">
                    <Input
                      aria-label={control.label}
                      value={typeof raw === 'string' ? raw : ''}
                      placeholder={allLabel}
                      onChange={event => {
                        const text = event.target.value;
                        update(control.id, text.trim() ? text : ALL_VALUE);
                      }}
                    />
                  </div>
                ) : null}
                {control.type === 'date' ? (
                  <div className="share-viewer-filter-date">
                    <Input
                      type="date"
                      aria-label={`${control.label} from`}
                      value={
                        raw && typeof raw === 'object' && !Array.isArray(raw)
                          ? String((raw as { from?: string }).from || '')
                          : typeof raw === 'string'
                            ? raw
                            : ''
                      }
                      onChange={event => {
                        const from = event.target.value;
                        const end =
                          raw && typeof raw === 'object' && !Array.isArray(raw)
                            ? String((raw as { to?: string }).to || '')
                            : '';
                        if (!from && !end) update(control.id, ALL_VALUE);
                        else update(control.id, { from, to: end });
                      }}
                    />
                    <Input
                      type="date"
                      aria-label={`${control.label} to`}
                      value={
                        raw && typeof raw === 'object' && !Array.isArray(raw)
                          ? String((raw as { to?: string }).to || '')
                          : ''
                      }
                      onChange={event => {
                        const to = event.target.value;
                        const from =
                          raw && typeof raw === 'object' && !Array.isArray(raw)
                            ? String((raw as { from?: string }).from || '')
                            : typeof raw === 'string'
                              ? raw
                              : '';
                        if (!from && !to) update(control.id, ALL_VALUE);
                        else update(control.id, { from, to });
                      }}
                    />
                  </div>
                ) : null}
                {control.type === 'dropdown' || control.type === 'listbox' ? (
                  <>
                    <DropdownMenuItem
                      onSelect={() => update(control.id, ALL_VALUE)}
                      aria-checked={!chip.active}
                    >
                      {allLabel}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {control.options.map(option => {
                      const selected =
                        control.type === 'listbox' && control.multi
                          ? Array.isArray(raw) && raw.map(String).includes(option.value)
                          : String(raw ?? '') === option.value;
                      return (
                        <DropdownMenuItem
                          key={option.value}
                          onSelect={event => {
                            if (control.type === 'listbox' && control.multi) {
                              event.preventDefault();
                              const current = Array.isArray(raw)
                                ? raw.map(String)
                                : raw
                                  ? [String(raw)]
                                  : [];
                              const next = selected
                                ? current.filter(value => value !== option.value)
                                : [...current, option.value];
                              update(control.id, next.length ? next : ALL_VALUE);
                              return;
                            }
                            update(
                              control.id,
                              setDropdownValue(control, option.value) === ALL_VALUE
                                ? ALL_VALUE
                                : option.value
                            );
                          }}
                        >
                          {control.type === 'listbox' && control.multi
                            ? `${selected ? '✓ ' : ''}${option.label}`
                            : option.label}
                        </DropdownMenuItem>
                      );
                    })}
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })}
        {views.length ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="share-viewer-filter-chip"
                disabled={busy}
                aria-label="Saved views"
              >
                Views ▾
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="share-viewer-filter-menu">
              <DropdownMenuLabel>Saved views</DropdownMenuLabel>
              {views.map(view => (
                <DropdownMenuItem key={view.id} onSelect={() => onApplyView?.(view)}>
                  {view.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {naming ? (
          <span className="share-viewer-save-inline">
            <Input
              aria-label="View name"
              value={viewName}
              placeholder="Name this view"
              onChange={event => setViewName(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') save();
                if (event.key === 'Escape') {
                  setNaming(false);
                  setViewName('');
                }
              }}
            />
            <Button
              type="button"
              className="share-viewer-filter-chip"
              disabled={busy || !viewName.trim()}
              onClick={save}
            >
              Save
            </Button>
            <Button
              type="button"
              className="share-viewer-filter-chip"
              disabled={busy}
              onClick={() => {
                setNaming(false);
                setViewName('');
              }}
            >
              Cancel
            </Button>
          </span>
        ) : (
          <Button
            type="button"
            className="share-viewer-filter-chip"
            disabled={busy}
            onClick={() => setNaming(true)}
          >
            Save view
          </Button>
        )}
      </div>
      {error ? <p className="share-viewer-filters-error">{error}</p> : null}
    </div>
  );
}
