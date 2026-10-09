'use client';

import { ReactNode, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/molecules/dialog';
import { Alert, AlertDescription } from '@/components/atoms/alert';
import { Button } from '@/components/atoms/button';
import { getAccessToken } from '@/utils/auth';
import { exportPipelineScript } from '@/lib/dataset-data-ops';
import { getDatasetIdFromTab, WORKSPACE_DATASET_REQUIRED } from '@/lib/workspace-dataset';
import { useTabsStore } from '@/stores/tabs-store';

export function PipelineScriptDialog({ children }: { children: ReactNode }) {
  const token = getAccessToken();
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);
  const datasetId = getDatasetIdFromTab(activeTab);
  const [open, setOpen] = useState(false);
  const [script, setScript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!datasetId) {
      setError(WORKSPACE_DATASET_REQUIRED);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await exportPipelineScript(datasetId, token);
      const blocks = [`# R\n${res.r_script || ''}`];
      if (res.spss_syntax) blocks.push(`* SPSS\n${res.spss_syntax}`);
      if (res.python_script) blocks.push(`# Python\n${res.python_script}`);
      setScript(blocks.join('\n\n'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build the R script');
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    const blob = new Blob([script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tensr-pipeline.R';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        setOpen(next);
        if (next) void load();
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Export R script</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground">
            One script for this dataset&apos;s pipeline: import (including .sav via haven), joins,
            stacks, raking, and the analyses already recorded.
          </p>
          <textarea
            readOnly
            className="h-48 w-full rounded border bg-muted p-2 font-mono text-xs"
            value={busy ? 'Building…' : script}
          />
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" onClick={download} disabled={!script || busy}>
            Download .R
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
