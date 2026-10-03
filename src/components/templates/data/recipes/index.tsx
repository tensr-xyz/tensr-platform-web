'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Download, Play, Save } from 'lucide-react';

import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/molecules/dialog';
import { formatApiErrorMessage } from '@/lib/api-error';
import { apiClient, type SavedRecipe } from '@/lib/api-client';
import { getDatasetIdFromTab } from '@/lib/workspace-dataset';
import { useProjectStore } from '@/stores/project-store';
import { useTabsStore } from '@/stores/tabs-store';

function useRecipeScope() {
  const projectId = useProjectStore(s => s.currentProject?.id) || '';
  const datasetId = useTabsStore(s => {
    const tab = s.tabs.find(item => item.id === s.activeTabId);
    return getDatasetIdFromTab(tab) || '';
  });
  return { projectId: projectId || datasetId, datasetId };
}

export function SaveAsRecipeButton() {
  const { projectId, datasetId } = useRecipeScope();
  const [name, setName] = useState('Saved analysis');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = useCallback(async () => {
    if (!datasetId || !projectId) {
      setMessage('Open a dataset first.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const meta = await apiClient.datasets.getMetadata(datasetId);
      const ops = meta.operation_list?.ops;
      if (!Array.isArray(ops) || ops.length === 0) {
        setMessage('This dataset has no analysis history to save.');
        return;
      }
      const saved = await apiClient.datasets.saveRecipe({
        project_id: projectId,
        name: name.trim() || 'Saved analysis',
        ops,
        created_from: 'history',
      });
      setMessage(`Saved “${saved.name}” as v${saved.version}.`);
    } catch (err) {
      setMessage(formatApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [datasetId, name, projectId]);

  return (
    <div className="flex flex-col gap-2 border-b border-border px-3 py-2">
      <div className="flex items-center gap-2">
        <Input
          aria-label="Recipe name"
          value={name}
          onChange={e => setName(e.target.value)}
          className="h-8 text-xs"
        />
        <Button type="button" size="sm" onClick={() => void save()} disabled={busy}>
          <Save className="mr-1 size-3.5" />
          Save as recipe
        </Button>
      </div>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}

export function RecipeList() {
  const { datasetId } = useRecipeScope();
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await apiClient.datasets.listRecipes();
      setRecipes(res.recipes || []);
    } catch (err) {
      setMessage(formatApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(
    async (recipe: SavedRecipe) => {
      if (!datasetId) {
        setMessage('Open a dataset first.');
        return;
      }
      setBusy(true);
      setMessage(null);
      try {
        const saved = await apiClient.datasets.runRecipe(recipe.recipe_id, recipe.version, {
          dataset_id: datasetId,
        });
        setMessage(`Ran on this dataset. New dataset ${saved.dataset_id}.`);
      } catch (err) {
        setMessage(formatApiErrorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [datasetId]
  );

  const exportScript = useCallback(async (recipe: SavedRecipe) => {
    setBusy(true);
    setMessage(null);
    try {
      const script = await apiClient.datasets.exportRecipeScript(recipe.recipe_id, recipe.version);
      const blob = new Blob([script], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${recipe.name || 'recipe'}.R`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMessage(formatApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className="flex flex-col gap-2 px-3 py-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">Recipes</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void refresh()}
          disabled={busy}
        >
          Refresh
        </Button>
      </div>
      {recipes.length === 0 ? (
        <p className="text-xs text-muted-foreground">No saved recipes yet.</p>
      ) : (
        <ul className="space-y-2">
          {recipes.map(recipe => (
            <li
              key={`${recipe.recipe_id}-${recipe.version}`}
              className="rounded border border-border p-2"
            >
              <p className="text-xs font-medium">
                {recipe.name} <span className="text-muted-foreground">v{recipe.version}</span>
              </p>
              <div className="mt-1 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void run(recipe)}
                >
                  <Play className="mr-1 size-3.5" />
                  Run on this dataset
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void exportScript(recipe)}
                >
                  <Download className="mr-1 size-3.5" />
                  Export R script
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {message ? (
        <p className="text-xs text-destructive" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function SaveAsRecipeDialog({ children }: { children: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save as recipe</DialogTitle>
          <DialogDescription>
            Save this dataset’s analysis history so it can run on another file.
          </DialogDescription>
        </DialogHeader>
        <SaveAsRecipeButton />
      </DialogContent>
    </Dialog>
  );
}

export function RecipesDialog({ children }: { children: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recipes</DialogTitle>
          <DialogDescription>
            Run a saved recipe on the open dataset, or export its R script.
          </DialogDescription>
        </DialogHeader>
        <RecipeList />
      </DialogContent>
    </Dialog>
  );
}
