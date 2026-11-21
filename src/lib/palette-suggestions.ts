/**
 * Type-fit ⌘K suggestions for the selected variable (Paper 10d).
 * Display labels match the artboard; launches use live catalog menu names.
 */

import type { PaletteColumnKind } from '@/lib/palette-column-context';

export type SuggestableItem = { name: string };

/** One suggestion row: show `label`, launch `menuName` or hand `ask` to chat. */
export type PaletteSuggestion<T extends SuggestableItem = SuggestableItem> = {
  label: string;
  menuName?: string;
  ask?: string;
  item?: T;
};

type SuggestionSpec = {
  label: string;
  menuName?: string;
  /** When true, `ask` is `Top-2 box for ${label}` (no dedicated menu item). */
  askTop2?: boolean;
};

/** Preferred suggestions by column kind, in display order (Paper 10d / Displayr capability). */
const SUGGESTION_SPECS_BY_KIND: Record<PaletteColumnKind, readonly SuggestionSpec[]> = {
  numeric: [
    { label: 'Standardize Variables', menuName: 'Standardize Variables' },
    { label: 'Visual Binning', menuName: 'Visual Binning' },
    { label: 'Descriptives', menuName: 'Descriptives' },
    { label: 'Rank Cases', menuName: 'Rank Cases' },
  ],
  categorical: [
    { label: 'Top-2 box', askTop2: true },
    { label: 'Crosstab by a banner', menuName: 'Custom Tables' },
    { label: 'Driver Analysis', menuName: 'Driver Analysis' },
  ],
  text: [
    { label: 'Frequencies', menuName: 'Frequencies' },
    { label: 'Recode Variables', menuName: 'Recode Variables' },
  ],
  unknown: [
    { label: 'Frequencies', menuName: 'Frequencies' },
    { label: 'Descriptives', menuName: 'Descriptives' },
  ],
};

/**
 * Returns type-fit suggestions for the focused variable.
 * Catalog misses are dropped; Top-2 always offers ask-chat when kind fits.
 */
export function suggestPaletteActionsForKind<T extends SuggestableItem>(
  kind: PaletteColumnKind | null | undefined,
  catalog: readonly T[],
  variableLabel = '',
  limit = 4
): PaletteSuggestion<T>[] {
  if (!kind) return [];
  const specs = SUGGESTION_SPECS_BY_KIND[kind] || SUGGESTION_SPECS_BY_KIND.unknown;
  const byName = new Map(catalog.map(item => [item.name, item] as const));
  const trimmed = variableLabel.trim();
  const out: PaletteSuggestion<T>[] = [];
  for (const spec of specs) {
    if (spec.askTop2) {
      out.push({
        label: spec.label,
        ask: trimmed ? `Top-2 box for ${trimmed}` : 'Top-2 box',
      });
    } else if (spec.menuName) {
      const item = byName.get(spec.menuName);
      if (!item) continue;
      out.push({ label: spec.label, menuName: spec.menuName, item });
    }
    if (out.length >= limit) break;
  }
  return out;
}

/** Results / section heading for the focused variable (Paper 10d: For "…"). */
export function suggestedPaletteResultsLabel(label: string | null | undefined): string {
  const trimmed = (label || '').trim();
  return trimmed ? `For "${trimmed}"` : 'Suggested';
}

export const SUGGESTED_PALETTE_SECTION = 'Suggested';
export const RECENT_PALETTE_SECTION = 'Recent';

/** Idle footer when a question is selected (Paper 10d). */
export const PALETTE_ASK_CHAT_HINT = 'No match? Press ⏎ to ask chat instead';
