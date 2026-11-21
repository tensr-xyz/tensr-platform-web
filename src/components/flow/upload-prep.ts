/** The upload proposal, and which parts the user keeps. Rows are never dropped here. */

export type PrepProposal = {
  label_changes?: { column?: string; from?: string; to?: string }[];
  variable_sets?: {
    label?: string;
    name?: string;
    columns?: string[];
    items?: { column?: string; label?: string }[];
    summary?: string;
    binary?: boolean;
  }[];
  weight?: string | null;
  weight_label?: string | null;
  weight_summary?: {
    mean?: number;
    min?: number;
    max?: number;
    effective_base?: number;
  } | null;
  questions?: number;
  nps?: { column?: string; label?: string } | null;
  quality?: {
    flagged?: number;
    checked?: number;
    respondents?: number;
    outlier_rows?: number;
    poor_text_rows?: number;
    speeder_rows?: number;
    straightline_rows?: number;
    trap_rows?: number;
    bot_rows?: number;
    non_substantive_rows?: number;
    duplicate_rows?: number;
    threshold?: number;
    would_remove?: number;
    would_remove_share?: number;
    would_review?: number;
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

function formatWeightSummary(label: string, summary: PrepProposal['weight_summary']): string {
  if (!summary) return label;
  const bits = [label];
  if (typeof summary.mean === 'number') bits.push(`mean ${summary.mean.toFixed(2)}`);
  if (typeof summary.min === 'number' && typeof summary.max === 'number') {
    bits.push(`range ${summary.min.toFixed(2)}–${summary.max.toFixed(2)}`);
  }
  if (typeof summary.effective_base === 'number') {
    bits.push(`effective base ${summary.effective_base.toLocaleString('en-GB')}`);
  }
  return bits.join(' · ');
}

function setBefore(set: NonNullable<PrepProposal['variable_sets']>[number]): string {
  const items = (set.items || []).map(item => (item.label || '').trim()).filter(Boolean);
  const count = (set.columns || []).length || items.length;
  const kind = set.binary
    ? 'yes/no columns that share one question'
    : 'columns that share one question';
  if (items.length) {
    const shown = items.slice(0, 6).join(' · ');
    return `${shown} · ${count} ${kind}`;
  }
  return `${count} ${kind}`;
}

function setAfter(set: NonNullable<PrepProposal['variable_sets']>[number]): string {
  const name = set.label || set.name || 'Set';
  const summary = (set.summary || '').trim();
  return summary ? `→ ${name} · ${summary}` : `→ ${name}`;
}

function qualityBefore(quality: NonNullable<PrepProposal['quality']>): string {
  const speeder = quality.speeder_rows;
  const straight = quality.straightline_rows;
  const trap = quality.trap_rows;
  const bot = quality.bot_rows;
  const outlier = quality.outlier_rows;
  const poor = quality.poor_text_rows;
  const bits = [
    typeof speeder === 'number' && speeder > 0
      ? `${speeder} finished in under a third of the median time`
      : '',
    typeof straight === 'number' && straight > 0
      ? `${straight} gave the same answer down a grid`
      : '',
    typeof trap === 'number' && trap > 0 ? `${trap} failed an attention check` : '',
    typeof bot === 'number' && bot > 0 ? `${bot} look like bot or copy-pasted answers` : '',
    typeof outlier === 'number' && outlier > 0 && !(typeof speeder === 'number' && speeder > 0)
      ? `${outlier} numeric outliers`
      : '',
    typeof poor === 'number' && poor > 0 && !(typeof straight === 'number' && straight > 0)
      ? `${poor} short open answers`
      : '',
  ].filter(Boolean);
  return bits.join(' · ');
}

/** Threshold line for the existing flags row. Rows stay until the user chooses. */
function qualityAfter(quality: NonNullable<PrepProposal['quality']>): string {
  const bits = ['→ Adds a Quality flag column you can filter on'];
  const remove = quality.would_remove;
  const respondents = quality.respondents;
  const review = quality.would_review;
  const threshold =
    typeof quality.threshold === 'number' && quality.threshold > 0 && quality.threshold <= 1
      ? Math.round(quality.threshold * 100)
      : null;
  if (
    typeof remove === 'number' &&
    typeof respondents === 'number' &&
    respondents > 0 &&
    threshold !== null
  ) {
    const share =
      typeof quality.would_remove_share === 'number'
        ? quality.would_remove_share
        : remove / respondents;
    const pct = (share * 100).toFixed(1).replace(/\.0$/, '');
    bits.push(
      `${remove.toLocaleString('en-GB')} of ${respondents.toLocaleString('en-GB')} (${pct}%) would be removed at the ${threshold}% bar`
    );
  }
  if (typeof review === 'number' && review > 0) {
    bits.push(`${review.toLocaleString('en-GB')} to review`);
  }
  return bits.join(' · ');
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
    parts.push(
      row(
        'sets',
        names.join(', '),
        `Group ${sets.length} question ${sets.length === 1 ? 'set' : 'sets'}`,
        'Answered as one question',
        first ? setBefore(first) : '',
        first ? setAfter(first) : '',
        sets.slice(1).map(set => {
          const name = set.label || set.name || 'Set';
          const summary = (set.summary || '').trim();
          return summary ? `${name} · ${summary}` : name;
        })
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
        formatWeightSummary(weight, proposal.weight_summary),
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
    parts.push(
      row(
        'flags',
        `${flagged} quality flags`,
        `Flag ${flagged} ${flagged === 1 ? 'respondent' : 'respondents'}`,
        'Flagged, never removed',
        qualityBefore(proposal.quality || {}),
        qualityAfter(proposal.quality || {})
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
