import type { OutlineQuestion } from '@/lib/flow-columns';

/** Show the Paper 5c first-run board: no saved tables and no stub picked yet. */
export function isTablesFirstRun(args: {
  railReady: boolean;
  savedCount: number;
  stub: string;
}): boolean {
  return Boolean(args.railReady && args.savedCount === 0 && !String(args.stub || '').trim());
}

/** Plain-language question type for the first-run list. */
export function firstRunQuestionTypeLabel(kind: string): string {
  const key = String(kind || '')
    .trim()
    .toLowerCase();
  if (key === 'multi') return 'Multiple choice';
  if (key.startsWith('scale')) return 'Rating scale';
  if (key === 'single') return 'Single choice';
  if (key === 'numeric' || key === 'number') return 'Number';
  if (key === 'grid') return 'Grid';
  if (key === 'open') return 'Open text';
  return kind ? kind.charAt(0).toUpperCase() + kind.slice(1) : 'Question';
}

export type FirstRunQuestion = {
  value: string;
  label: string;
  typeLabel: string;
};

/** A few suggested stubs from this file's outline (labels only, never a fixed list). */
export function firstRunSuggestedQuestions(
  outline: OutlineQuestion[],
  limit = 3
): FirstRunQuestion[] {
  return outline
    .filter(item => item.kind !== 'open')
    .map(item => ({
      value: String(item.stubValue || item.columns[0] || item.key),
      label: item.label,
      typeLabel: firstRunQuestionTypeLabel(item.kind),
    }))
    .filter(item => item.value && item.label)
    .slice(0, Math.max(0, limit));
}

/** Banner-like groups: low-cardinality singles preferred, labels from the file. */
export function firstRunGroupChips(
  outline: OutlineQuestion[],
  columns: { name: string; n_unique?: number | null }[],
  opts?: { limit?: number; exclude?: string }
): { value: string; label: string }[] {
  const limit = opts?.limit ?? 3;
  const exclude = String(opts?.exclude || '').trim();
  const byName = new Map(columns.map(column => [column.name, column]));
  return outline
    .filter(item => item.kind === 'single' || item.kind.startsWith('scale'))
    .map(item => {
      const value = String(item.stubValue || item.columns[0] || item.key);
      const measure = item.measureColumn || item.columns[0] || value;
      const n = Number(byName.get(measure)?.n_unique);
      return {
        value,
        label: item.label,
        n: Number.isFinite(n) && n > 0 ? n : 99,
      };
    })
    .filter(item => item.value && item.label && item.value !== exclude)
    .sort((a, b) => a.n - b.n || a.label.localeCompare(b.label))
    .slice(0, Math.max(0, limit))
    .map(({ value, label }) => ({ value, label }));
}

/**
 * Agent starter lines for an empty Tables pane. Built from this file's questions;
 * always ends with a generic "what first" prompt.
 */
export function firstRunAgentPrompts(outline: OutlineQuestion[], limit = 3): string[] {
  const questions = outline.filter(item => item.kind !== 'open' && item.label);
  const groups = outline.filter(
    item => (item.kind === 'single' || item.kind.startsWith('scale')) && item.label
  );
  const prompts: string[] = [];
  const q0 = questions[0];
  const g0 = groups.find(item => item.key !== q0?.key) || groups[0];
  if (q0 && g0 && q0.key !== g0.key) {
    prompts.push(`${q0.label} by ${g0.label}`);
  }
  const q1 = questions.find(item => item.key !== q0?.key && item.key !== g0?.key);
  const g1 = groups.find(item => item.key !== q1?.key && item.key !== g0?.key);
  if (q1 && g1) {
    prompts.push(`${q1.label}, split by ${g1.label}`);
  } else if (q1) {
    prompts.push(`Build a table for ${q1.label}`);
  }
  prompts.push('What should I look at first?');
  return prompts.filter((prompt, index) => prompts.indexOf(prompt) === index).slice(0, limit);
}

/** Filter outline questions by a search string against their labels. */
export function filterFirstRunQuestions(
  outline: OutlineQuestion[],
  query: string
): FirstRunQuestion[] {
  const needle = query.trim().toLowerCase();
  const rows = outline
    .filter(item => item.kind !== 'open')
    .map(item => ({
      value: String(item.stubValue || item.columns[0] || item.key),
      label: item.label,
      typeLabel: firstRunQuestionTypeLabel(item.kind),
    }))
    .filter(item => item.value && item.label);
  if (!needle) return rows;
  return rows.filter(item => item.label.toLowerCase().includes(needle));
}
