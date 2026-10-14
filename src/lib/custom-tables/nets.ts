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

const LIKERT_WORD =
  /agree|disagree|satisfied|dissatisfied|likely|unlikely|never|always|poor|fair|good|excellent|strongly/i;

function scaleCode(value: string): number | null {
  const text = value.trim();
  if (!/^-?\d+(\.0+)?$/.test(text)) return null;
  const number = Number(text);
  return Number.isInteger(number) ? number : null;
}

/** Top-2-box is a scale net. Gender and other nominal columns do not get the button. */
export function offersTop2Box(values: string[], columnType?: string | null): boolean {
  const kind = (columnType || '').toLowerCase();
  if (['id', 'date', 'datetime', 'text', 'open'].includes(kind)) return false;
  if (values.length < 2) return false;
  const codes = values.map(scaleCode);
  const integerScale =
    codes.every(code => code != null) && values.length >= 3 && values.length <= 11;
  if (kind === 'nominal' || (kind === 'categorical' && !integerScale)) return false;
  if (integerScale) return true;
  if (['ordinal', 'numeric', 'integer', 'float', 'scale'].includes(kind)) return true;
  const likert = values.filter(value => LIKERT_WORD.test(value)).length;
  return likert >= 2;
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
