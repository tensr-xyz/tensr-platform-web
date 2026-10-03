'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
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
import { Label } from '@/components/atoms/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { useTabsStore } from '@/stores/tabs-store';
import { openAnalysisResultTab } from '@/lib/open-analysis-result-tab';
import {
  buildChartFromDataset,
  loadFilteredChartRows,
  PALETTE_MENU_TO_KIND,
} from '@/lib/agent-chart-from-dataset';
import { apiClient } from '@/lib/api-client';
import { ApiRequestError } from '@/lib/api-error';

type Props = { children: ReactNode; chartMenuName?: string };

export function ChartBuilderDialog({ children, chartMenuName = 'Bar Chart' }: Props) {
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);
  const columns = useMemo(
    () =>
      activeTab?.data?.initialColumns?.map(c => ({
        id: c.id,
        header: c.header ?? c.id,
        type: c.type,
      })) ?? [],
    [activeTab?.data?.initialColumns]
  );
  const [xCol, setXCol] = useState('');
  const [yCol, setYCol] = useState('');
  const [weightCol, setWeightCol] = useState('__none__');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const datasetId = activeTab?.data?.datasetId ?? activeTab?.data?.filePath;

  useEffect(() => {
    if (!datasetId) return;
    let cancelled = false;
    void apiClient.datasets
      .getMetadata(datasetId)
      .then(meta => {
        if (cancelled) return;
        const active = meta.active_weight_column;
        if (active && columns.some(column => column.id === active)) {
          setWeightCol(active);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [columns, datasetId]);

  const kind = PALETTE_MENU_TO_KIND[chartMenuName];

  const run = async () => {
    if (!kind) {
      setError('That chart is not available.');
      return;
    }
    if (!columns.length) {
      setError('Open a dataset first');
      return;
    }
    const x = xCol || columns[0]?.id;
    const y = yCol || columns[1]?.id || columns[0]?.id;
    if (!x || !y) {
      setError('Select an X axis column');
      return;
    }
    if (!datasetId) {
      setError('Dataset id not available');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const xHeader = columns.find(column => column.id === x)?.header ?? x;
      const yHeader = columns.find(column => column.id === y)?.header ?? y;
      const filters = (activeTab?.data?.columnFilters ?? []).map(filter => ({
        id: filter.id,
        operator: filter.value.operator,
        value: filter.value.value,
      }));
      let built;
      let rowsDataset = 0;
      try {
        const remote = await apiClient.datasets.chartData(datasetId, {
          kind,
          x,
          y,
          x_label: xHeader,
          y_label: yHeader,
          filters,
          row_uids: activeTab?.data?.rowUidFilter,
          weight_column: weightCol === '__none__' ? null : weightCol,
        });
        built = remote.chart;
        rowsDataset = remote.n_rows_filtered;
      } catch (err) {
        if (!(err instanceof ApiRequestError) || err.status !== 404) throw err;
        const rows = await loadFilteredChartRows(
          datasetId,
          activeTab?.data?.columnFilters ?? [],
          activeTab?.data?.rowUidFilter
        );
        const weightColumn = weightCol === '__none__' ? null : weightCol;
        const prompt = `${kind} chart of ${y} by ${x}`;
        built = buildChartFromDataset(
          prompt,
          columns.map(c => ({ id: c.id, header: c.header })),
          rows,
          weightColumn,
          { kind, xId: x, yId: y }
        );
        rowsDataset = rows.length;
      }
      if (!built || built.kind !== kind) {
        setError('Could not build chart from selected columns');
        return;
      }
      openAnalysisResultTab({
        op: 'chart_builder',
        envelope: {
          result: { chart_type: kind, x, y },
          report: {
            meta: {
              analysis_key: 'chart_builder',
              title: chartMenuName,
              subtitle: `${y} vs ${x}`,
              generated_at: new Date().toISOString(),
              rows_dataset: rowsDataset,
            },
            summary: `Standalone ${chartMenuName.toLowerCase()} from dataset columns.`,
            metrics: [],
            chart: built,
            charts: [built],
            blocks: [
              { type: 'interpretation', content: `Standalone ${chartMenuName.toLowerCase()}.` },
              { type: 'chart', chart: built },
            ],
            tables: [],
            trust: { notes: [], warnings: [] },
          },
        },
        parameters: { x_column: x, y_column: y, chart_type: kind },
        sourceDatasetId: datasetId,
        sourceTabName: activeTab?.name,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the dataset for this chart.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{chartMenuName}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Map columns and render in the results panel.
        </p>
        <div className="grid gap-3">
          <div>
            <Label>X axis</Label>
            <Select value={xCol || columns[0]?.id} onValueChange={setXCol}>
              <SelectTrigger>
                <SelectValue placeholder="Column" />
              </SelectTrigger>
              <SelectContent>
                {columns.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.header}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Y axis</Label>
            <Select value={yCol || columns[1]?.id || columns[0]?.id} onValueChange={setYCol}>
              <SelectTrigger>
                <SelectValue placeholder="Column" />
              </SelectTrigger>
              <SelectContent>
                {columns.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.header}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Weight</Label>
            <Select value={weightCol} onValueChange={setWeightCol}>
              <SelectTrigger aria-label="Weight">
                <SelectValue placeholder="No weight" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No weight</SelectItem>
                {columns.map(c => (
                  <SelectItem key={`w-${c.id}`} value={c.id}>
                    {c.header}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
        <DialogFooter>
          <Button onClick={run} disabled={busy}>
            {busy ? 'Creating chart' : 'Create chart'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
