'use client';

import { ReactNode, useState } from 'react';
import { useTabsStore } from '@/stores/tabs-store';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/molecules/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { Button } from '@/components/atoms/button';
import { Alert, AlertDescription } from '@/components/atoms/alert';
import { tensrApiUrl } from '@/lib/tensr-api-url';
import { getStytchBearerForTensrApi } from '@/utils/auth';
import { resolveWorkspaceDatasetId } from '@/lib/workspace-dataset';
import { useProjectStore } from '@/stores/project-store';

interface ExportDialogProps {
  children: ReactNode;
}

const EXPORT_FORMATS = [
  { id: 'csv', label: 'CSV (.csv)', extension: 'csv' },
  { id: 'json', label: 'JSON (.json)', extension: 'json' },
  { id: 'sav', label: 'SPSS (.sav)', extension: 'sav' },
  { id: 'dta', label: 'Stata (.dta)', extension: 'dta' },
] as const;

type ExportFormatId = (typeof EXPORT_FORMATS)[number]['id'];

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const ExportDialog = ({ children }: ExportDialogProps) => {
  const { tabs, activeTabId } = useTabsStore();
  const fileSystem = useProjectStore(s => s.fileSystem);
  const currentProject = useProjectStore(s => s.currentProject);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormatId>('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');

  const activeTab = tabs.find(tab => tab.id === activeTabId);

  const handleExport = async () => {
    if (!activeTab) {
      setError('No active tab to export');
      return;
    }

    const datasetId = resolveWorkspaceDatasetId({
      tab: activeTab,
      projectId: currentProject?.id,
      fileSystem,
    });

    try {
      setIsExporting(true);
      setError('');

      const format = EXPORT_FORMATS.find(f => f.id === selectedFormat);
      if (!format) {
        setError('Invalid export format selected');
        return;
      }

      const baseName =
        activeTab.name?.replace(/\.[^.]+$/, '') || datasetId?.slice(0, 8) || 'dataset';
      const filename = `${baseName}.${format.extension}`;

      if (!datasetId) {
        setError('No dataset id on the active tab — open a dataset to export.');
        return;
      }

      const token = getStytchBearerForTensrApi();
      if (!token) throw new Error('Sign in to export this dataset');

      const exportRes = await fetch(
        tensrApiUrl(`/datasets/${datasetId}/export?format=${format.id}`),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!exportRes.ok) throw new Error(`Export failed (${exportRes.status})`);
      const blob = await exportRes.blob();
      downloadBlob(filename, blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Data</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Select
            value={selectedFormat}
            onValueChange={v => setSelectedFormat(v as ExportFormatId)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select format" />
            </SelectTrigger>
            <SelectContent>
              {EXPORT_FORMATS.map(f => (
                <SelectItem key={f.id} value={f.id}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
        <DialogFooter>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? 'Exporting…' : 'Download'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExportDialog;
