'use client';

import { ReactNode, useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/molecules/dialog';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { tensrApiUrl } from '@/lib/tensr-api-url';
import { getSessionJwt } from '@/utils/auth';
import { resolveWorkspaceDatasetId } from '@/lib/workspace-dataset';
import { useTabsStore } from '@/stores/tabs-store';
import { useProjectStore } from '@/stores/project-store';
import type { ColumnMetadata } from '@/lib/analysis-report-types';

interface VariableViewProps {
  children: ReactNode;
}

export function VariableViewDialog({ children }: VariableViewProps) {
  const { tabs, activeTabId } = useTabsStore();
  const fileSystem = useProjectStore(s => s.fileSystem);
  const currentProject = useProjectStore(s => s.currentProject);
  const [open, setOpen] = useState(false);
  const [columns, setColumns] = useState<ColumnMetadata[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const activeTab = tabs.find(t => t.id === activeTabId);
  const datasetId = activeTab
    ? resolveWorkspaceDatasetId({
        tab: activeTab,
        projectId: currentProject?.id,
        fileSystem,
      })
    : null;

  const load = useCallback(async () => {
    if (!datasetId) return;
    const token = getSessionJwt();
    if (!token) return;
    const res = await fetch(tensrApiUrl(`/datasets/${datasetId}/metadata`), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setError('Could not load variable metadata');
      return;
    }
    const json = (await res.json()) as { columns?: ColumnMetadata[] };
    setColumns(json.columns || []);
    setError('');
  }, [datasetId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const updateCol = (idx: number, patch: Partial<ColumnMetadata>) => {
    setColumns(prev => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const save = async () => {
    if (!datasetId) return;
    const token = getSessionJwt();
    if (!token) return;
    setSaving(true);
    const body: Record<string, ColumnMetadata> = {};
    for (const c of columns) {
      body[c.name] = c;
    }
    const res = await fetch(tensrApiUrl(`/datasets/${datasetId}/metadata`), {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ columns: body }),
    });
    setSaving(false);
    if (!res.ok) {
      setError('Save failed');
      return;
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Variable View</DialogTitle>
        </DialogHeader>
        {!datasetId ? (
          <p className="text-sm text-muted-foreground">Open a dataset tab first.</p>
        ) : (
          <>
            <div className="flex-1 overflow-auto border rounded-md">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted/80">
                  <tr>
                    {['Name', 'Label', 'Type', 'Width', 'Measure', 'Values', 'Missing'].map(h => (
                      <th key={h} className="px-2 py-2 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {columns.map((col, i) => (
                    <tr key={col.name} className="border-t border-border/50">
                      <td className="px-2 py-1 font-mono">{col.name}</td>
                      <td className="px-2 py-1">
                        <Input
                          className="h-7 text-xs"
                          value={col.label ?? ''}
                          onChange={e => updateCol(i, { label: e.target.value || null })}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Select
                          value={col.type || 'numeric'}
                          onValueChange={v => updateCol(i, { type: v })}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="numeric">Numeric</SelectItem>
                            <SelectItem value="string">String</SelectItem>
                            <SelectItem value="date">Date</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          className="h-7 w-16 text-xs"
                          type="number"
                          value={col.width ?? 8}
                          onChange={e => updateCol(i, { width: Number(e.target.value) })}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Select
                          value={col.measure || 'none'}
                          onValueChange={v =>
                            updateCol(i, {
                              measure: v === 'none' ? null : (v as ColumnMetadata['measure']),
                            })
                          }
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            <SelectItem value="nominal">Nominal</SelectItem>
                            <SelectItem value="ordinal">Ordinal</SelectItem>
                            <SelectItem value="scale">Scale</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          className="h-7 text-xs font-mono"
                          placeholder="1=Male;2=Female"
                          defaultValue={
                            col.value_labels
                              ? Object.entries(col.value_labels)
                                  .map(([k, v]) => `${k}=${v}`)
                                  .join(';')
                              : ''
                          }
                          onBlur={e => {
                            const map: Record<string, string> = {};
                            e.target.value.split(';').forEach(pair => {
                              const [k, v] = pair.split('=');
                              if (k && v) map[k.trim()] = v.trim();
                            });
                            updateCol(i, { value_labels: Object.keys(map).length ? map : null });
                          }}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          className="h-7 text-xs font-mono"
                          placeholder="99, -9"
                          defaultValue={
                            col.missing?.user_values
                              ? Array.isArray(col.missing.user_values)
                                ? col.missing.user_values.join(', ')
                                : String(col.missing.user_values)
                              : ''
                          }
                          onBlur={e => {
                            const vals = e.target.value
                              .split(',')
                              .map(s => s.trim())
                              .filter(Boolean);
                            updateCol(i, {
                              missing: vals.length ? { user_values: vals } : null,
                            });
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? 'Saving…' : 'OK'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
