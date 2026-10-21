'use client';

import { DragEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/atoms/alert';
import { Button } from '@/components/atoms/button';
import { Checkbox } from '@/components/atoms/checkbox';
import { Input } from '@/components/atoms/input';
import { Label } from '@/components/atoms/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/molecules/dialog';
import { apiClient } from '@/lib/api-client';
import { openAnalysisResultTab } from '@/lib/open-analysis-result-tab';
import {
  PIVOT_AGGS,
  fieldsFromPivotConfig,
  fieldsInZone,
  moveField,
  pivotBody,
  removeField,
  reorderField,
  setFieldAgg,
  significanceSupported,
  swapRowsAndColumns,
  type PivotAgg,
  type PivotField,
  type PivotZone,
} from '@/lib/pivot-zones';
import { getDatasetIdFromTab, WORKSPACE_DATASET_REQUIRED } from '@/lib/workspace-dataset';
import { LINEAGE_HIDDEN_COLUMNS } from '@/lib/adopt-derived-dataset';
import { useAnalysisSetupStore } from '@/stores/analysis-setup-store';
import { useTabsStore } from '@/stores/tabs-store';

const ZONES: { id: PivotZone; label: string }[] = [
  { id: 'rows', label: 'Rows' },
  { id: 'columns', label: 'Columns' },
  { id: 'values', label: 'Values' },
  { id: 'filters', label: 'Filters' },
];

type Matrix = {
  columns?: { path?: string[]; kind?: string }[];
  rows?: {
    path?: string[];
    kind?: string;
    cells?: { value?: number | null; letters?: string }[];
  }[];
  agg?: string;
  significance_supported?: boolean;
};

function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function PivotTableDialog({ children }: { children: ReactNode }) {
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = useMemo(() => tabs.find(tab => tab.id === activeTabId), [tabs, activeTabId]);
  const datasetId = getDatasetIdFromTab(activeTab);
  const columns = useMemo(() => {
    const initial = activeTab?.data?.initialColumns;
    if (!initial) return [];
    return initial.map(column => column.id).filter(id => !LINEAGE_HIDDEN_COLUMNS.has(id));
  }, [activeTab?.data?.initialColumns]);
  const initialBody = useAnalysisSetupStore(state => state.setupInitialBody);
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<PivotField[]>([]);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [topN, setTopN] = useState('24');
  const [significance, setSignificance] = useState(false);
  const [showSubtotals, setShowSubtotals] = useState(true);
  const [showGrandTotal, setShowGrandTotal] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [csv, setCsv] = useState('');
  const [xlsx, setXlsx] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [windowStart, setWindowStart] = useState(0);

  useEffect(() => {
    if (!open || !initialBody) return;
    setFields(fieldsFromPivotConfig(initialBody));
    const result = initialBody.__result;
    if (result && typeof result === 'object') {
      const payload = result as {
        result?: { matrix?: Matrix; csv?: string; xlsx_base64?: string; notes?: string[] };
      };
      const raw = payload.result || (result as { matrix?: Matrix; csv?: string; notes?: string[] });
      if (raw.matrix) setMatrix(raw.matrix);
      if (typeof raw.csv === 'string') setCsv(raw.csv);
      if (typeof (raw as { xlsx_base64?: string }).xlsx_base64 === 'string') {
        setXlsx((raw as { xlsx_base64: string }).xlsx_base64);
      }
      setNotes(Array.isArray(raw.notes) ? raw.notes : []);
    }
  }, [open, initialBody]);

  const used = new Set(fields.map(field => field.column));
  const available = columns.filter(column => !used.has(column));
  const valueAgg = fieldsInZone(fields, 'values')[0]?.agg || 'count';
  const sigOk = significanceSupported(valueAgg);

  const onDrop = (zone: PivotZone, index: number) => (event: DragEvent) => {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/plain');
    const column = event.dataTransfer.getData('application/x-tensr-column');
    if (column) {
      const created: PivotField = {
        id: `${zone}:${column}:${Date.now()}`,
        column,
        zone,
        agg: zone === 'values' ? 'sum' : undefined,
      };
      setFields(current => moveField([...current, created], created.id, zone, index));
      return;
    }
    if (id) setFields(current => moveField(current, id, zone, index));
  };

  const run = async () => {
    if (!datasetId) throw new Error(WORKSPACE_DATASET_REQUIRED);
    const filters = fieldsInZone(fields, 'filters').map(field => ({
      column: field.column,
      value: filterValues[field.id] || '',
    }));
    const body = pivotBody(fields, {
      topN: topN.trim() === '' ? null : Number(topN),
      significance: significance && sigOk,
      showSubtotals,
      showGrandTotal,
      filters,
    });
    const envelope = await apiClient.datasets.analyze.run(datasetId, 'pivot_table', body);
    const raw = (envelope.result || {}) as {
      matrix?: Matrix;
      csv?: string;
      xlsx_base64?: string;
      notes?: string[];
    };
    setMatrix(raw.matrix || null);
    setCsv(raw.csv || '');
    setXlsx(raw.xlsx_base64 || null);
    setNotes(raw.notes || []);
    setWindowStart(0);
    openAnalysisResultTab({
      op: 'pivot_table',
      envelope,
      parameters: body,
      sourceDatasetId: datasetId,
      sourceTabName: activeTab?.name,
      activate: false,
    });
  };

  const visibleRows = matrix?.rows || [];
  const windowed = visibleRows.slice(windowStart, windowStart + 40);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Pivot table</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Drag a column into rows, columns, values, or filters. Counts and percents use the same
          crosstab engine as Custom Tables, including the active weight, nets, and column letters.
        </p>
        <div className="grid gap-3 md:grid-cols-[180px_1fr]">
          <div>
            <p className="mb-1 text-xs font-medium">Columns</p>
            <ul className="max-h-64 space-y-1 overflow-auto rounded border p-2">
              {available.map(column => (
                <li
                  key={column}
                  draggable
                  onDragStart={event => {
                    event.dataTransfer.setData('application/x-tensr-column', column);
                    event.dataTransfer.setData('text/plain', column);
                  }}
                  className="cursor-grab rounded bg-muted px-2 py-1 text-sm"
                >
                  {column}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {ZONES.map(zone => (
              <div
                key={zone.id}
                className="min-h-24 rounded border border-dashed p-2"
                onDragOver={event => event.preventDefault()}
                onDrop={onDrop(zone.id, fieldsInZone(fields, zone.id).length)}
              >
                <p className="text-xs font-medium">{zone.label}</p>
                <ul className="mt-1 space-y-1">
                  {fieldsInZone(fields, zone.id).map(field => (
                    <li
                      key={field.id}
                      draggable
                      onDragStart={event => event.dataTransfer.setData('text/plain', field.id)}
                      className="flex items-center gap-1 text-sm"
                    >
                      <span className="flex-1">{field.column}</span>
                      {zone.id === 'values' ? (
                        <Select
                          value={field.agg || 'sum'}
                          onValueChange={value =>
                            setFields(current => setFieldAgg(current, field.id, value as PivotAgg))
                          }
                        >
                          <SelectTrigger className="h-7 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PIVOT_AGGS.map(agg => (
                              <SelectItem key={agg.id} value={agg.id}>
                                {agg.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : null}
                      {zone.id === 'filters' ? (
                        <Input
                          className="h-7 w-24 text-xs"
                          placeholder="equals"
                          value={filterValues[field.id] || ''}
                          onChange={event =>
                            setFilterValues(current => ({
                              ...current,
                              [field.id]: event.target.value,
                            }))
                          }
                        />
                      ) : null}
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        aria-label="Move up"
                        title="Move up"
                        onClick={() => setFields(current => reorderField(current, field.id, -1))}
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        aria-label="Move down"
                        title="Move down"
                        onClick={() => setFields(current => reorderField(current, field.id, 1))}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        aria-label="Remove"
                        title="Remove"
                        onClick={() => setFields(current => removeField(current, field.id))}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Button
            type="button"
            variant="outline"
            onClick={() => setFields(current => swapRowsAndColumns(current))}
          >
            Swap rows and columns
          </Button>
          <Label className="flex items-center gap-2">
            Top N
            <Input
              className="h-7 w-16"
              value={topN}
              onChange={event => setTopN(event.target.value)}
            />
          </Label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={significance}
              onCheckedChange={value => setSignificance(value === true)}
              disabled={!sigOk}
            />
            Column letters
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={showSubtotals}
              onCheckedChange={value => setShowSubtotals(value === true)}
            />
            Subtotals
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={showGrandTotal}
              onCheckedChange={value => setShowGrandTotal(value === true)}
            />
            Grand total
          </label>
        </div>
        {!sigOk ? (
          <p className="text-xs text-muted-foreground">
            Column letters are available for count and percent pivots, where the crosstab engine
            already tests columns.
          </p>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {notes.length ? <p className="text-xs text-muted-foreground">{notes.join(' ')}</p> : null}
        {matrix ? (
          <div
            className="max-h-80 overflow-auto"
            onScroll={event => {
              const next = Math.floor(event.currentTarget.scrollTop / 28);
              setWindowStart(Math.max(0, Math.min(next, Math.max(visibleRows.length - 40, 0))));
            }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="p-1 text-left"> </th>
                  {(matrix.columns || []).map(column => (
                    <th key={(column.path || []).join('/')} className="p-1 text-right font-medium">
                      {(column.path || []).join(' / ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {windowed.map((row, index) => (
                  <tr
                    key={`${windowStart + index}-${(row.path || []).join('/')}`}
                    className={
                      row.kind === 'grand_total' || row.kind === 'subtotal'
                        ? 'font-medium'
                        : undefined
                    }
                  >
                    <td className="p-1">{(row.path || []).join(' / ')}</td>
                    {(row.cells || []).map((cell, cellIndex) => (
                      <td key={cellIndex} className="p-1 text-right tabular-nums">
                        {cell.value == null
                          ? ''
                          : Number(cell.value).toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })}
                        {cell.letters ? ` ${cell.letters}` : ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleRows.length > 40 ? (
              <p className="text-xs text-muted-foreground">
                Showing 40 of {visibleRows.length} rows. Scroll to move the window. Export includes
                every row.
              </p>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={!csv}
            onClick={() => downloadBlob('pivot.csv', new Blob([csv], { type: 'text/csv' }))}
          >
            Export CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!xlsx}
            onClick={() => {
              if (!xlsx) return;
              const binary = atob(xlsx);
              const bytes = new Uint8Array(binary.length);
              for (let index = 0; index < binary.length; index += 1)
                bytes[index] = binary.charCodeAt(index);
              downloadBlob(
                'pivot.xlsx',
                new Blob([bytes], {
                  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                })
              );
            }}
          >
            Export XLSX
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              void run()
                .catch(err => setError(err instanceof Error ? err.message : 'Pivot failed'))
                .finally(() => setBusy(false));
            }}
          >
            Update pivot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
