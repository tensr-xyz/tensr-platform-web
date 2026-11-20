import type { RecipeReferenceFile, SavedRecipe } from '@/lib/api-client';

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
