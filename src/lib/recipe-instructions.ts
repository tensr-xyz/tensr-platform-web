import { analysisDisplayName } from '@/lib/analysis-definitions';
import type { RecipeReferenceFile, SavedRecipe } from '@/lib/api-client';

const PREP_STEP_LABELS: Record<string, string> = {
  weight: 'Weight',
  rake: 'Weight to targets',
  join: 'Join files',
  stack: 'Stack waves',
  filter: 'Filter',
  recode: 'Recode',
  derive: 'Derived question',
  clean: 'Clean data',
  report: 'Report',
};

/** Keep labelled reference rows only. Filename alone is enough for a label. */
export function normalizeRecipeReferenceFiles(raw: unknown): RecipeReferenceFile[] {
  if (!Array.isArray(raw)) return [];
  const out: RecipeReferenceFile[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const label =
      (typeof row.label === 'string' && row.label.trim()) ||
      (typeof row.filename === 'string' && row.filename.trim()) ||
      '';
    if (!label) continue;
    const next: RecipeReferenceFile = { label };
    if (typeof row.filename === 'string' && row.filename.trim()) {
      next.filename = row.filename.trim();
    }
    if (typeof row.dataset_id === 'string' && row.dataset_id.trim()) {
      next.dataset_id = row.dataset_id.trim();
    }
    if (typeof row.note === 'string' && row.note.trim()) {
      next.note = row.note.trim();
    }
    out.push(next);
  }
  return out;
}

/** User-facing step lines for the recipe editor. Skips import; never shows codes. */
export function recipeStepLabels(ops: unknown): string[] {
  if (!Array.isArray(ops)) return [];
  const labels: string[] = [];
  for (const item of ops) {
    if (!item || typeof item !== 'object') continue;
    const step = item as Record<string, unknown>;
    const op = String(step.op || '').trim();
    if (!op || op === 'import') continue;

    const titled =
      (typeof step.title === 'string' && step.title.trim()) ||
      (typeof step.label === 'string' && step.label.trim()) ||
      '';
    if (titled) {
      labels.push(titled);
      continue;
    }

    if (op === 'analysis') {
      const analysisType = String(step.analysis_type || '').trim();
      labels.push(analysisType ? analysisDisplayName(analysisType) : 'Analysis');
      continue;
    }

    if (op === 'weight') {
      const method = String(step.method || '').trim();
      labels.push(method === 'rake' ? PREP_STEP_LABELS.rake : PREP_STEP_LABELS.weight);
      continue;
    }

    labels.push(PREP_STEP_LABELS[op] || op.replace(/_/g, ' '));
  }
  return labels;
}

/** Plain text for a lead or report when a recipe carries standing instructions. */
export function standingInstructionsBlock(
  recipe: Pick<SavedRecipe, 'when_to_use' | 'instructions' | 'reference_files'> | null
): string {
  if (!recipe) return '';
  const parts: string[] = [];
  const when = (recipe.when_to_use || '').trim();
  if (when) parts.push(`When to use: ${when}`);
  const instructions = (recipe.instructions || '').trim();
  if (instructions) parts.push(instructions);
  const refs = normalizeRecipeReferenceFiles(recipe.reference_files);
  if (refs.length) {
    parts.push(`Reference files: ${refs.map(ref => ref.label).join(', ')}.`);
  }
  return parts.join('\n\n');
}
