'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { RecipeReferenceFile, SavedRecipe } from '@/lib/api-client';
import { flowJson } from '@/lib/flow-api';
import { normalizeRecipeReferenceFiles, recipeStepLabels } from '@/lib/recipe-instructions';

export type EditableRecipe = {
  recipe_id?: string;
  version?: number;
  name?: string;
  ops?: unknown[];
  description?: string;
  when_to_use?: string;
  instructions?: string;
  reference_files?: RecipeReferenceFile[];
  applies_as_house_style?: boolean;
};

/** Paper 10e · recipe editor with standing instructions and reference files. */
export function RecipeEditorDialog({
  recipe,
  open,
  onOpenChange,
  onSaved,
  onRun,
  runBusy = false,
  canRun = false,
}: {
  recipe: EditableRecipe | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (saved: SavedRecipe) => void;
  onRun?: () => void;
  runBusy?: boolean;
  canRun?: boolean;
}) {
  const [name, setName] = useState('');
  const [whenToUse, setWhenToUse] = useState('');
  const [instructions, setInstructions] = useState('');
  const [refs, setRefs] = useState<RecipeReferenceFile[]>([]);
  const [houseStyle, setHouseStyle] = useState(false);
  const [newRefLabel, setNewRefLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !recipe) return;
    setName(recipe.name || '');
    setWhenToUse(recipe.when_to_use || '');
    setInstructions(recipe.instructions || '');
    setRefs(normalizeRecipeReferenceFiles(recipe.reference_files));
    setHouseStyle(Boolean(recipe.applies_as_house_style));
    setNewRefLabel('');
    setError('');
    setBusy(false);
  }, [open, recipe]);

  const steps = recipeStepLabels(recipe?.ops);
  const recipeId = recipe?.recipe_id?.trim() || '';
  const version = recipe?.version || 1;

  async function save() {
    if (!recipeId || busy) return;
    setBusy(true);
    setError('');
    try {
      const saved = await flowJson<SavedRecipe>(
        `/datasets/recipes/${recipeId}/versions/${version}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: name.trim() || recipe?.name || 'Recipe',
            when_to_use: whenToUse,
            instructions,
            reference_files: refs,
            applies_as_house_style: houseStyle,
          }),
        }
      );
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The recipe did not save.');
    } finally {
      setBusy(false);
    }
  }

  function addReference() {
    const label = newRefLabel.trim();
    if (!label) return;
    setRefs(current => [...current, { label, filename: label }]);
    setNewRefLabel('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="recipe-editor-dialog" aria-describedby="recipe-editor-note">
        <DialogTitle className="recipe-editor-eyebrow">Recipes → Edit recipe</DialogTitle>
        <Input
          className="recipe-editor-title"
          value={name}
          onChange={event => setName(event.target.value)}
          aria-label="Recipe name"
          placeholder="Recipe name"
        />

        <div className="recipe-editor-block">
          <div className="recipe-editor-label">Steps</div>
          {steps.length === 0 ? (
            <p id="recipe-editor-note" className="recipe-editor-empty">
              This recipe has no steps yet. Save a run first, then add instructions here.
            </p>
          ) : (
            <ul className="recipe-editor-steps">
              {steps.map((step, index) => (
                <li key={`${index}-${step}`} className="recipe-editor-step">
                  {index + 1} · {step}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="recipe-editor-block">
          <label className="recipe-editor-label" htmlFor="recipe-when-to-use">
            When to use
          </label>
          <Input
            id="recipe-when-to-use"
            className="recipe-editor-input"
            value={whenToUse}
            onChange={event => setWhenToUse(event.target.value)}
            placeholder="Brand trackers, awareness packs, every wave update…"
          />
        </div>

        <div className="recipe-editor-block">
          <label className="recipe-editor-label" htmlFor="recipe-instructions">
            Instructions for Tensr (applied every run)
          </label>
          <Textarea
            id="recipe-instructions"
            className="recipe-editor-instructions"
            value={instructions}
            onChange={event => setInstructions(event.target.value)}
            rows={4}
            placeholder="House writing style, how to analyse, what to hide or emphasise…"
          />
        </div>

        <div className="recipe-editor-block">
          <div className="recipe-editor-label">Reference files</div>
          <ul className="recipe-editor-refs">
            {refs.map((ref, index) => (
              <li key={`${ref.label}-${index}`} className="recipe-editor-ref">
                <span>{ref.label}</span>
                <Button
                  type="button"
                  className="recipe-editor-ref-remove"
                  onClick={() => setRefs(current => current.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
          <div className="recipe-editor-ref-add">
            <Input
              className="recipe-editor-input"
              value={newRefLabel}
              onChange={event => setNewRefLabel(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addReference();
                }
              }}
              placeholder="Brand style guide.pdf"
              aria-label="Reference file label"
            />
            <Button
              type="button"
              className="recipe-editor-add-file"
              onClick={addReference}
              disabled={!newRefLabel.trim()}
            >
              + Add file
            </Button>
          </div>
        </div>

        <label className="recipe-editor-house">
          <Checkbox
            checked={houseStyle}
            onCheckedChange={value => setHouseStyle(value === true)}
            aria-label="Apply as house style for every lead and report"
          />
          <span>Apply as house style for every lead and report</span>
        </label>

        {error ? <p className="flow-error">{error}</p> : null}

        <div className="recipe-editor-foot">
          {canRun && onRun ? (
            <Button type="button" className="flow-btn" disabled={busy || runBusy} onClick={onRun}>
              {runBusy ? 'Running…' : 'Run on this file'}
            </Button>
          ) : (
            <span />
          )}
          <Button
            type="button"
            className="flow-btn primary"
            disabled={busy || !recipeId}
            onClick={() => void save()}
          >
            {busy ? 'Saving…' : 'Save recipe'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
