'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnalysisSetupModal } from '@/components/templates/analysis/analysis-setup-modal';
import type { AnalysisKey } from '@/lib/analysis-definitions';
import type { DatasetPreview, SchemaColumn } from '@/lib/analysis-report-types';
import { openAnalysisResultTab } from '@/lib/open-analysis-result-tab';
import { runDatasetAnalysis } from '@/lib/workspace-analysis';
import { getMenuItemComponent } from '@/configs/analysis-config/menu-registry';
import { recordTabSnapshot } from '@/lib/tab-history';
import { resolveWorkspaceDatasetId, WORKSPACE_DATASET_REQUIRED } from '@/lib/workspace-dataset';
import { apiClient } from '@/lib/api-client';
import { useTabsStore, type Tab } from '@/stores/tabs-store';
import { useProjectStore } from '@/stores/project-store';
import { useAnalysisSetupStore } from '@/stores/analysis-setup-store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/molecules/dialog';
import { Button } from '@/components/atoms/button';

function buildPreviewFromTab(tab: Tab | undefined): DatasetPreview | null {
  const cols = tab?.data?.initialColumns;
  const rows = tab?.data?.initialData;
  if (!cols?.length || !rows?.length) return null;
  const headers = cols.map(c => c.id);
  const previewRows = rows.slice(0, 500).map(row =>
    headers.map(h => {
      const v = row[h];
      if (v === undefined || v === null) return null;
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
      return String(v);
    })
  );
  return { headers, rows: previewRows };
}

function columnsFromTab(tab: Tab | undefined): SchemaColumn[] {
  if (!tab?.data?.initialColumns?.length) return [];
  return tab.data.initialColumns.map(col => ({
    name: col.id,
    type: col.type === 'number' || col.type === 'numeric' ? 'numeric' : 'categorical',
    missing_count: 0,
  }));
}

/**
 * Hidden host that mounts a menu-registered dialog component and auto-clicks
 * its trigger so any caller (palette / chat) can open it by name.
 */
function MenuDialogLauncher({
  name,
  nonce,
  activeTabId,
}: {
  name: string;
  nonce: number;
  activeTabId?: string;
}) {
  const Component = useMemo(() => getMenuItemComponent(name), [name]);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeTabId) {
      recordTabSnapshot(activeTabId, name);
    }
    const id = window.requestAnimationFrame(() => triggerRef.current?.click());
    return () => window.cancelAnimationFrame(id);
  }, [nonce, name, activeTabId]);

  return (
    <div key={nonce} className="sr-only" aria-hidden>
      <Component>
        <button ref={triggerRef} type="button" tabIndex={-1} className="sr-only" />
      </Component>
    </div>
  );
}

/** Renders the workspace setup / dialog / unavailable surfaces (driven by analysis-setup-store). */
export function AnalysisSetupHost() {
  const setupOp = useAnalysisSetupStore(s => s.setupOp);
  const setupInitialBody = useAnalysisSetupStore(s => s.setupInitialBody);
  const dialogName = useAnalysisSetupStore(s => s.dialogName);
  const dialogNonce = useAnalysisSetupStore(s => s.dialogNonce);
  const unavailableName = useAnalysisSetupStore(s => s.unavailableName);
  const closeSetup = useAnalysisSetupStore(s => s.closeSetup);
  const closeUnavailable = useAnalysisSetupStore(s => s.closeUnavailable);
  const returnToCommandPalette = useAnalysisSetupStore(s => s.returnToCommandPalette);

  const [busy, setBusy] = useState(false);
  const [schema, setSchema] = useState<SchemaColumn[]>([]);
  // Only subscribe to the active tab's id so unrelated tabs being edited don't rerender the host.
  const activeTabId = useTabsStore(s => s.activeTabId);
  // Materialise the actual tab object lazily and only when one of the surfaces is open.
  const activeTab = useTabsStore(s => s.tabs.find(t => t.id === activeTabId));
  const fileSystem = useProjectStore(s => s.fileSystem);
  const currentProject = useProjectStore(s => s.currentProject);
  const activeTabFingerprint = activeTab
    ? `${activeTab.id}:${activeTab.data?.initialColumns?.length ?? 0}`
    : '';
  const preview = useMemo(() => buildPreviewFromTab(activeTab), [activeTab]);
  const tabSchema = useMemo(() => columnsFromTab(activeTab), [activeTabFingerprint]);
  const effectiveSchema = schema.length ? schema : tabSchema;
  const datasetId = useMemo(
    () =>
      resolveWorkspaceDatasetId({
        tab: activeTab,
        projectId: currentProject?.id,
        fileSystem,
      }),
    [activeTab, currentProject?.id, fileSystem]
  );

  const setupOpen = setupOp !== null;
  const unavailableOpen = unavailableName !== null;

  useEffect(() => {
    if (!setupOpen && !unavailableOpen) return;
    const currentTab = useTabsStore.getState().tabs.find(t => t.id === activeTabId);
    const fallback = columnsFromTab(currentTab);
    setSchema(fallback);
    if (!datasetId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.datasets.getSchema(datasetId);
        if (cancelled) return;
        const apiSchema = (res.schema as SchemaColumn[]) || [];
        setSchema(apiSchema.length ? apiSchema : fallback);
      } catch {
        if (!cancelled) setSchema(fallback);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setupOpen, unavailableOpen, datasetId, activeTabFingerprint, activeTabId]);

  const onRun = useCallback(
    async (op: AnalysisKey, body: Record<string, unknown>) => {
      if (!datasetId) throw new Error(WORKSPACE_DATASET_REQUIRED);
      setBusy(true);
      try {
        const envelope = await runDatasetAnalysis(datasetId, op, body);
        openAnalysisResultTab({
          op,
          envelope: envelope as import('@/lib/analysis-report-types').AnalyzeResponse,
          parameters: body,
          sourceDatasetId: datasetId,
          sourceTabName: activeTab?.name,
        });
        closeSetup();
      } finally {
        setBusy(false);
      }
    },
    [datasetId, activeTab?.name, closeSetup]
  );

  return (
    <>
      {setupOp ? (
        <AnalysisSetupModal
          open={setupOpen}
          onOpenChange={open => {
            if (!open) closeSetup();
          }}
          initialOp={setupOp}
          initialBody={setupInitialBody}
          schema={effectiveSchema}
          preview={preview}
          datasetId={datasetId}
          busy={busy}
          onRun={onRun}
          onBackToPalette={returnToCommandPalette}
        />
      ) : null}
      {dialogName ? (
        <MenuDialogLauncher name={dialogName} nonce={dialogNonce} activeTabId={activeTab?.id} />
      ) : null}
      {unavailableName ? (
        <Dialog
          open={unavailableOpen}
          onOpenChange={open => {
            if (!open) closeUnavailable();
          }}
        >
          <DialogContent className="z-[200] sm:max-w-md" overlayClassName="z-[200]">
            <DialogHeader>
              <DialogTitle>{unavailableName}</DialogTitle>
              <DialogDescription>
                This capability is on the launch roadmap. It needs more than a stats endpoint — for
                example dedicated charts, model builders, or pipeline UX — so we are shipping it
                after the core Analyze and Data tools are solid.
              </DialogDescription>
            </DialogHeader>
            <Button variant="outline" onClick={() => closeUnavailable()}>
              Close
            </Button>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

/** @deprecated Use AnalysisSetupHost — kept as alias for layout imports. */
export const AnalysisSetupProvider = AnalysisSetupHost;
