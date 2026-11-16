/** The upload proposal, and which parts the user keeps. Rows are never dropped here. */

export type PrepProposal = {
  label_changes?: { column?: string; from?: string; to?: string }[];
  variable_sets?: { label?: string; name?: string; columns?: string[] }[];
  weight?: string | null;
  weight_label?: string | null;
  nps?: { column?: string; label?: string } | null;
  quality?: {
    flagged?: number;
    checked?: number;
    respondents?: number;
    outlier_rows?: number;
    poor_text_rows?: number;
  };
};

export type PrepPart = {
  id: 'labels' | 'sets' | 'weight' | 'nps' | 'flags';
  label: string;
  title: string;
  hint: string;
  before: string;
  after: string;
  rest: string[];
};

/** The name shown when Apply writes the copy. The upload itself keeps its name. */
export function preparedCopyLabel(name: string): string {
  const text = name.trim() || 'dataset';
  const dot = text.lastIndexOf('.');
  const stem = dot > 0 && !text.slice(dot + 1).includes(' ') ? text.slice(0, dot) : text;
  return `${stem} · prepared`;
}

function row(
  id: PrepPart['id'],
  label: string,
  title: string,
  hint: string,
  before: string,
  after: string,
  rest: string[] = []
): PrepPart {
  return { id, label, title, hint, before, after, rest };
}

export function prepParts(proposal: PrepProposal | null | undefined): PrepPart[] {
  if (!proposal) return [];
  const parts: PrepPart[] = [];
  const labels = proposal.label_changes || [];
  if (labels.length) {
    const first = labels[0];
    const rest = labels.slice(1).flatMap(change => {
      const from = (change.from || '').trim();
      const to = (change.to || '').trim();
      if (!from && !to) return [];
      return [to ? `${from} → ${to}` : from];
    });
    parts.push(
      row(
        'labels',
        `${labels.length} shortened labels`,
        `Shorten ${labels.length} ${labels.length === 1 ? 'label' : 'labels'}`,
        'Tables and answers use these',
        (first?.from || '').trim(),
        first?.to ? `→ ${first.to}` : '',
        rest.filter(Boolean)
      )
    );
  }
  const sets = proposal.variable_sets || [];
  if (sets.length) {
    const names = sets.map(set => set.label || set.name || 'Set').filter(Boolean);
    const first = sets[0];
    const columns = (first?.columns || []).filter(Boolean);
    const setLabel = first?.label || first?.name || 'Set';
    parts.push(
      row(
        'sets',
        names.join(', '),
        `Group ${sets.length} question ${sets.length === 1 ? 'set' : 'sets'}`,
        'Answered as one question',
        columns.length
          ? `${columns.join(', ')} · ${columns.length} columns that share one question`
          : setLabel,
        `→ ${setLabel}`,
        sets.slice(1).map(set => set.label || set.name || 'Set')
      )
    );
  }
  const weight = (proposal.weight_label || '').trim();
  if (weight) {
    parts.push(
      row(
        'weight',
        `Weight: ${weight}`,
        'Use a weight',
        'Applied to every result',
        weight,
        "→ Default weight for this file. Answers say when it's used."
      )
    );
  }
  const nps = proposal.nps?.label || proposal.nps?.column;
  parts.push(
    nps
      ? row(
          'nps',
          `NPS groups for ${nps}`,
          'Score as NPS',
          'Found one 0–10 scale',
          nps,
          '→ NPS · promoters 9–10, passives 7–8, detractors 0–6',
          ['Not an NPS question? Skip it']
        )
      : row('nps', 'No NPS scale found', 'No NPS scale found', 'Nothing to score', '', '')
  );
  const flagged = proposal.quality?.flagged;
  if (typeof flagged === 'number' && flagged > 0) {
    const fast = proposal.quality?.outlier_rows;
    const same = proposal.quality?.poor_text_rows;
    const bits = [
      typeof fast === 'number' && fast > 0 ? `${fast} finished far faster than the median` : '',
      typeof same === 'number' && same > 0 ? `${same} gave the same answer down a grid` : '',
    ].filter(Boolean);
    parts.push(
      row(
        'flags',
        `${flagged} quality flags`,
        `Flag ${flagged} ${flagged === 1 ? 'respondent' : 'respondents'}`,
        'Flagged, never removed',
        bits.join(' · '),
        '→ Adds a Quality flag column you can filter on'
      )
    );
  } else {
    parts.push(row('flags', 'No quality flags', 'No quality flags', 'Nothing to flag', '', ''));
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
