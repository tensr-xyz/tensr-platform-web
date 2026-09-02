import type { CustomTableNet } from './spec';

export type NetPresetId = 'agree' | 'yes' | 'top2';

export const NET_HELPER_COPY =
  'A net is a union of respondents in this table. Recode is a new column. Both remain available.';

function looksAgree(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.includes('agree') && !lower.includes('disagree');
}

function looksYes(value: string): boolean {
  const lower = value.trim().toLowerCase();
  if (lower === 'no' || lower.startsWith('no ')) return false;
  return /^(yes|definitely yes)$/i.test(lower) || (/\byes\b/.test(lower) && !/\bno\b/.test(lower));
}

export function netPreset(kind: NetPresetId, values: string[]): CustomTableNet | null {
  if (kind === 'top2') {
    if (values.length < 2) return null;
    return { label: 'Top-2-box', values: values.slice(-2) };
  }
  if (kind === 'agree') {
    const matched = values.filter(looksAgree);
    if (!matched.length) return null;
    return { label: 'NET Agree', values: matched };
  }
  const matched = values.filter(looksYes);
  if (!matched.length) return null;
  return { label: 'NET Yes', values: matched };
}
