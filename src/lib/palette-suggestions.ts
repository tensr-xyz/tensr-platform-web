/**
 * Type-fit ⌘K suggestions for the selected variable.
 * Uses Tensr menu labels that already exist in the palette catalog — Displayr capability, not wording.
 */

import type { PaletteColumnKind } from '@/lib/palette-column-context';

/** Preferred menu names by column kind, in display order. */
const SUGGESTIONS_BY_KIND: Record<PaletteColumnKind, readonly string[]> = {
  numeric: ['Standardize Variables', 'Visual Binning', 'Descriptives', 'Rank Cases'],
  categorical: ['Frequencies', 'Recode Variables', 'Custom Tables', 'Chi-square'],
  text: ['Frequencies', 'Recode Variables'],
  unknown: ['Frequencies', 'Descriptives'],
};

export type SuggestableItem = { name: string };

/**
 * Returns catalog items that fit `kind`, preserving suggestion order and dropping unknown names.
 */
export function suggestPaletteActionsForKind<T extends SuggestableItem>(
  kind: PaletteColumnKind | null | undefined,
  catalog: readonly T[],
  limit = 4
): T[] {
  if (!kind) return [];
  const preferred = SUGGESTIONS_BY_KIND[kind] || SUGGESTIONS_BY_KIND.unknown;
  const byName = new Map(catalog.map(item => [item.name, item] as const));
  const out: T[] = [];
  for (const name of preferred) {
    const hit = byName.get(name);
    if (!hit) continue;
    out.push(hit);
    if (out.length >= limit) break;
  }
  return out;
}

/** Results heading; prefers the variable label when present. */
export function suggestedPaletteResultsLabel(label: string | null | undefined): string {
  const trimmed = (label || '').trim();
  return trimmed ? `Suggested for ${trimmed}` : 'Suggested';
}

export const SUGGESTED_PALETTE_SECTION = 'Suggested';
export const RECENT_PALETTE_SECTION = 'Recent';
