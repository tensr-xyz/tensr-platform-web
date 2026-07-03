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
import { fetchDataQualityReport, type DataQualityReport } from '@/lib/dataset-data-ops';
import { getDatasetIdFromTab, WORKSPACE_DATASET_REQUIRED } from '@/lib/workspace-dataset';
import { useTabsStore } from '@/stores/tabs-store';

export function DataQualityReportDialog({ children }: { children: ReactNode }) {
  const token = getAccessToken();
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);
  const datasetId = getDatasetIdFromTab(activeTab);
  const [report, setReport] = useState<DataQualityReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
