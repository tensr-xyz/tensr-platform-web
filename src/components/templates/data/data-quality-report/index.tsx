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
import { Loader2 as Loader } from 'lucide-react';
import { getAccessToken } from '@/utils/auth';
import {
  fetchDataQualityReport,
  fixDatasetDataTypes,
  type DataQualityReport,
} from '@/lib/dataset-data-ops';
import { showDerivedResult } from '@/lib/show-derived-result';
import { useRouter } from 'next/navigation';
import { getDatasetIdFromTab, WORKSPACE_DATASET_REQUIRED } from '@/lib/workspace-dataset';
import { useTabsStore } from '@/stores/tabs-store';

export function plainTypeHint(
  suggestion: string | null | undefined,
  cast: string | null | undefined
): string | null {
  if (cast === 'id') {
    return 'This looks like an identifier. Mark it as an id so analyses do not treat it as a measurement.';
  }
  if (cast === 'date') {
    return 'This looks like a date. Mark it as a date so it is not treated as text.';
  }
  if (cast === 'likert') {
    return 'This looks like a scale. Mark it as a scale so it is not treated as a free number.';
  }
  if (!suggestion) return null;
  if (suggestion.includes('target_type') || suggestion.includes('fix-data-types')) {
    return 'This column looks like it has the wrong type. Mark the type that fits.';
  }
  return suggestion;
}

function castButtonLabel(cast: string): string {
  if (cast === 'id') return 'Mark as id';
  if (cast === 'date') return 'Mark as a date';
  if (cast === 'likert') return 'Mark as a scale';
  return 'Mark this type';
}

export function DataQualityReportDialog({ children }: { children: ReactNode }) {
  const token = getAccessToken();
  const router = useRouter();
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);
  const datasetId = getDatasetIdFromTab(activeTab);
  const [report, setReport] = useState<DataQualityReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const markType = async (name: string, targetType: string) => {
    if (!datasetId) {
      setError(WORKSPACE_DATASET_REQUIRED);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await fixDatasetDataTypes(
        datasetId,
        { casts: [{ name, target_type: targetType }] },
        token
      );
      const shown = showDerivedResult('fix_types', saved, { casts: [{ name, target_type: targetType }] });
      if (!shown && saved.dataset_id) {
        router.push(
          `/workspace/dataset/${saved.dataset_id}?name=${encodeURIComponent(saved.original_filename || 'typed')}`
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not mark that type');
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    if (!datasetId) {
      setError(WORKSPACE_DATASET_REQUIRED);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetchDataQualityReport(datasetId, token);
      setReport(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Report failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild onClick={() => void run()}>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Data Quality Report</DialogTitle>
        </DialogHeader>
        {busy ? (
          <div className="flex justify-center py-8">
            <Loader className="h-6 w-6 animate-spin" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : report ? (
          <div className="max-h-96 space-y-3 overflow-y-auto text-sm">
            <p>
              <strong>Score:</strong> {report.overall_score}/100 — {report.summary}
            </p>
            {report.script_findings?.length ? (
              <ul className="list-disc pl-4 text-xs">
                {report.script_findings.map((finding, i) => (
                  <li key={i}>{finding.message}</li>
                ))}
              </ul>
            ) : null}
            {report.columns.map(col => (
              <div key={col.name} className="rounded-md border p-2">
                <p className="font-medium">{col.name}</p>
                <p className="text-muted-foreground text-xs">
                  {col.inferred_type} · {col.pct_complete}% complete · {col.unique_count} unique
                </p>
                {col.issues.length ? (
                  <ul className="mt-1 list-disc pl-4 text-xs text-amber-700">
                    {col.issues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-emerald-700">No issues flagged</p>
                )}
                {plainTypeHint(col.type_suggestion, col.suggested_cast) ? (
                  <div className="mt-1 flex items-start justify-between gap-2">
                    <p className="text-xs text-sky-700">
                      {plainTypeHint(col.type_suggestion, col.suggested_cast)}
                    </p>
                    {col.suggested_cast ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void markType(col.name, col.suggested_cast || '')}
                      >
                        {castButtonLabel(col.suggested_cast)}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Open to scan the active dataset.</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => void run()} disabled={busy}>
            Refresh
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DataQualityReportDialog;
