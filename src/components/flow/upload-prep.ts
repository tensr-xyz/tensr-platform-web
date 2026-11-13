/** The upload proposal, and which parts the user keeps. Rows are never dropped here. */

export type PrepProposal = {
  label_changes?: { column?: string; from?: string; to?: string }[];
  variable_sets?: { label?: string; name?: string; columns?: string[] }[];
  weight?: string | null;
  weight_label?: string | null;
  nps?: { column?: string; label?: string } | null;
  quality?: { flagged?: number; checked?: number };
};

export type PrepPart = {
  id: 'labels' | 'sets' | 'weight' | 'nps' | 'flags';
  label: string;
};

export function prepParts(proposal: PrepProposal | null | undefined): PrepPart[] {
  if (!proposal) return [];
  const parts: PrepPart[] = [];
  const labels = proposal.label_changes || [];
  if (labels.length) {
    parts.push({ id: 'labels', label: `${labels.length} shortened labels` });
  }
  const sets = proposal.variable_sets || [];
  if (sets.length) {
    const names = sets.map(set => set.label || set.name || 'Set').filter(Boolean);
    parts.push({ id: 'sets', label: names.join(', ') });
  }
  const weight = (proposal.weight_label || '').trim();
  if (weight) parts.push({ id: 'weight', label: `Weight: ${weight}` });
  const nps = proposal.nps?.label || proposal.nps?.column;
  if (nps) parts.push({ id: 'nps', label: `NPS groups for ${nps}` });
  const flagged = proposal.quality?.flagged;
  if (typeof flagged === 'number' && flagged > 0) {
    parts.push({ id: 'flags', label: `${flagged} quality flags` });
  }
  return parts;
}

export function prepApplyBody(kept: string[]): {
  labels: boolean;
  sets: boolean;
  weight: boolean;
  nps: boolean;
  flags: boolean;
  drop_rows: boolean;
} {
  const chosen = new Set(kept);
  return {
    labels: chosen.has('labels'),
    sets: chosen.has('sets'),
    weight: chosen.has('weight'),
    nps: chosen.has('nps'),
    flags: chosen.has('flags'),
    drop_rows: false,
  };
}
