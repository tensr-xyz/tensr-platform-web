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
import { getSessionJwt, getSessionToken } from '@/utils/auth';
import { resolveWorkspaceDatasetId } from '@/lib/workspace-dataset';
import { useProjectStore } from '@/stores/project-store';

interface ExportDialogProps {
  children: ReactNode;
}

const EXPORT_FORMATS = [
  { id: 'csv', label: 'CSV (.csv)', extension: 'csv' },
  { id: 'json', label: 'JSON (.json)', extension: 'json' },
  { id: 'sav', label: 'SPSS (.sav)', extension: 'sav' },
] as const;

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function rowsToCsv(headers: string[], rows: unknown[][]): string {
  const escape = (cell: unknown) => {
    const s = cell === null || cell === undefined ? '' : String(cell);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
}

export const ExportDialog = ({ children }: ExportDialogProps) => {
  const { tabs, activeTabId } = useTabsStore();
  const fileSystem = useProjectStore(s => s.fileSystem);
  const currentProject = useProjectStore(s => s.currentProject);
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'json' | 'sav'>('csv');
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

      if (datasetId) {
        const token = getSessionJwt() || getSessionToken();
        if (!token) throw new Error('Sign in to export this dataset');

        const schemaRes = await fetch(tensrApiUrl(`/datasets/${datasetId}/schema`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!schemaRes.ok) {
          throw new Error(`Could not load dataset schema (${schemaRes.status})`);
        }
        const schema = (await schemaRes.json()) as { n_rows?: number; schema?: { name: string }[] };
        const headers = (schema.schema ?? []).map(c => c.name);
        const rowCount = schema.n_rows ?? 5000;
        const previewRes = await fetch(
          tensrApiUrl(`/datasets/${datasetId}/preview?limit=${Math.min(rowCount, 10000)}`),
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!previewRes.ok) {
          throw new Error(`Could not load dataset rows (${previewRes.status})`);
        }
        const preview = (await previewRes.json()) as { headers?: string[]; rows?: unknown[][] };
        const hdrs = preview.headers ?? headers;
        const rows = preview.rows ?? [];

        if (format.id === 'sav') {
          const savRes = await fetch(tensrApiUrl(`/datasets/${datasetId}/export?format=sav`), {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!savRes.ok) throw new Error(`SPSS export failed (${savRes.status})`);
          const blob = await savRes.blob();
          downloadBlob(filename, blob);
        } else if (format.id === 'csv') {
          downloadBlob(
            filename,
            new Blob([rowsToCsv(hdrs, rows)], { type: 'text/csv;charset=utf-8' })
          );
        } else {
          const objects = rows.map(row => {
            const obj: Record<string, unknown> = {};
            hdrs.forEach((h, i) => {
              obj[h] = (row as unknown[])[i] ?? null;
            });
            return obj;
          });
          downloadBlob(
            filename,
            new Blob([JSON.stringify(objects, null, 2)], { type: 'application/json' })
          );
        }
        return;
      }

      const cols = activeTab.data?.initialColumns?.map(c => c.id) ?? [];
      const data = activeTab.data?.initialData ?? [];
      if (!cols.length || !data.length) {
        setError('No data available to export in the active tab');
        return;
      }

      if (format.id === 'csv') {
        const rows = data.map(row => cols.map(c => row[c]));
        downloadBlob(
          filename,
          new Blob([rowsToCsv(cols, rows)], { type: 'text/csv;charset=utf-8' })
        );
      } else {
        downloadBlob(
          filename,
          new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        );
      }
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
            onValueChange={v => setSelectedFormat(v as 'csv' | 'json')}
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
