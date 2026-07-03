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
import type { AnalysisReportChart } from '@/lib/analysis-report-types';
import { buildChartFromDataset } from '@/lib/agent-chart-from-dataset';

type ChartKind = 'bar' | 'line' | 'scatter' | 'histogram' | 'boxplot' | 'pie' | 'area';

const MENU_TO_KIND: Record<string, ChartKind> = {
  'Bar Chart': 'bar',
  'Line Chart': 'line',
  'Scatter Chart': 'scatter',
  Histogram: 'histogram',
  Boxplot: 'boxplot',
  'Pie Chart': 'pie',
  'Area Chart': 'area',
  Heatmap: 'scatter',
};

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
  const [error, setError] = useState<string | null>(null);

  const kind = MENU_TO_KIND[chartMenuName] ?? 'bar';

  const run = () => {
    if (!activeTab?.data?.initialData?.length) {
      setError('Open a dataset with preview rows first');
      return;
    }
    const x = xCol || columns[0]?.id;
    const y = yCol || columns[1]?.id || columns[0]?.id;
    if (!x) {
      setError('Select an X axis column');
      return;
    }
    const prompt = `${kind} chart of ${y} by ${x}`;
    const built = buildChartFromDataset(
      prompt,
      columns.map(c => ({ id: c.id, header: c.header })),
      activeTab.data.initialData
    );
    if (!built) {
      setError('Could not build chart from selected columns');
      return;
    }
    const chart = built as AnalysisReportChart;
    const datasetId = activeTab.data?.datasetId ?? activeTab.data?.filePath;
    if (!datasetId) {
      setError('Dataset id not available');
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
            rows_dataset: activeTab.data.initialData.length,
          },
          summary: `Standalone ${chartMenuName.toLowerCase()} from dataset columns.`,
          metrics: [],
          chart,
          charts: [chart],
          blocks: [
            { type: 'interpretation', content: `Standalone ${chartMenuName.toLowerCase()}.` },
            { type: 'chart', chart },
          ],
          tables: [],
          trust: { notes: [], warnings: [] },
        },
      },
      parameters: { x_column: x, y_column: y, chart_type: kind },
      sourceDatasetId: datasetId,
      sourceTabName: activeTab.name,
    });
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
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
        <DialogFooter>
          <Button onClick={run}>Create chart</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
