export function isNotebookRunChord(event: {
  key: string;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}): boolean {
  return event.key === 'Enter' && (event.shiftKey || event.metaKey || event.ctrlKey);
}

export function presentCellError(
  error: string | null,
  traceback?: string | null,
  suggestion?: string | null
): { error: string | null; errorDetail: string | null } {
  if (!error) return { error: null, errorDetail: null };
  const lines = error
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  let summary = lines[lines.length - 1] || 'That cell failed.';
  if (suggestion && !summary.toLowerCase().includes('did you mean')) {
    summary = `${summary} ${suggestion}`;
  }
  if (summary.includes('{') || summary.length > 400) {
    summary = 'That cell failed.';
  }
  const detail = traceback?.trim();
  return {
    error: summary,
    errorDetail: detail && detail !== summary ? detail : null,
  };
}
