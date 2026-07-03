/** Cmd/Ctrl + K — analysis command palette */
export function isAnalysisPaletteShortcut(event: KeyboardEvent): boolean {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return false;
  return event.key.toLowerCase() === 'k';
}

/** Cmd/Ctrl + ` — workspace terminal (physical backtick key) */
export function isTerminalToggleShortcut(event: KeyboardEvent): boolean {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return false;
  return event.code === 'Backquote' || event.key === '`' || event.key === 'Backquote';
}

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}
