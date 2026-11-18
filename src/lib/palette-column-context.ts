/**
 * Column the Responses sheet has in focus. ⌘K reads this for type-fit suggestions.
 * Labels only — never codes or machine column names in user-facing copy.
 */

export type PaletteColumnKind = 'numeric' | 'categorical' | 'text' | 'unknown';

export type PaletteColumnContext = {
  /** Human-readable variable / question label. */
  label: string;
  kind: PaletteColumnKind;
};

let current: PaletteColumnContext | null = null;
const listeners = new Set<() => void>();

export function getPaletteColumnContext(): PaletteColumnContext | null {
  return current;
}

export function setPaletteColumnContext(next: PaletteColumnContext | null): void {
  const same =
    (current == null && next == null) ||
    (current != null && next != null && current.label === next.label && current.kind === next.kind);
  if (same) return;
  current = next;
  listeners.forEach(listener => listener());
}

export function subscribePaletteColumnContext(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Map sheet / metadata type strings onto the suggestion kinds. */
export function paletteColumnKindFromType(type: string | null | undefined): PaletteColumnKind {
  const folded = String(type || '')
    .trim()
    .toLowerCase();
  if (!folded) return 'unknown';
  if (['numeric', 'number', 'float', 'integer', 'double', 'int', 'continuous'].includes(folded)) {
    return 'numeric';
  }
  if (['text', 'string', 'open', 'open_end', 'open-end', 'verbatim'].includes(folded)) {
    return 'text';
  }
  if (
    [
      'categorical',
      'category',
      'nominal',
      'ordinal',
      'factor',
      'boolean',
      'bool',
      'binary',
      'single',
      'multiple',
    ].includes(folded)
  ) {
    return 'categorical';
  }
  return 'unknown';
}
