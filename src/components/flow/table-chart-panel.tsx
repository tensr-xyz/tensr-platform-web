'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChoiceSelect } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/rest';
import { flowJson } from '@/lib/flow-api';
import { pickerColumns } from '@/lib/flow-columns';
import { ExportDialog } from '@/components/flow/export-dialog';
import { fitLabel, linearFit } from '@/components/flow/table-chart';
import { runDocument } from '@/components/flow/run-document';

type ChartColumn = { name: string; label: string };
type ChartKind = 'scatter' | 'bar' | 'line' | 'boxplot';
type ChartFilter = { id: string; operator: string; value: string };
type ScatterPoint = { x: number; y: number; weight?: number };
type ChartBody = {
  kind?: string;
  title?: string;
  x_label?: string;
  y_label?: string;
  weighting?: string;
  points?: ScatterPoint[];
  categories?: string[];
  series?: { values?: number[] }[];
  groups?: { label: string; min: number; q1: number; median: number; q3: number; max: number }[];
};
type ChartPage = { n_rows?: number; n_rows_filtered?: number; chart?: ChartBody };

const KINDS: { value: ChartKind; label: string }[] = [
  { value: 'scatter', label: 'Scatter' },
  { value: 'bar', label: 'Bar' },
  { value: 'line', label: 'Line' },
  { value: 'boxplot', label: 'Box' },
];

const OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'contains', label: 'contains' },
  { value: 'greaterThan', label: 'greater than' },
  { value: 'lessThan', label: 'less than' },
  { value: 'isNotMissing', label: 'answered' },
];

function extent(values: number[]): { min: number; max: number } {
  const finite = values.filter(value => Number.isFinite(value));
  if (!finite.length) return { min: 0, max: 1 };
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  return min === max ? { min: min - 1, max: max + 1 } : { min, max };
}

function scale(value: number, from: { min: number; max: number }, start: number, end: number) {
  return start + ((value - from.min) / (from.max - from.min)) * (end - start);
}

export function TableChart({
  datasetId,
  projectId,
  columns,
  onShowTable,
}: {
  datasetId?: string;
  projectId?: string;
  columns: ChartColumn[];
  onShowTable: () => void;
}) {
  const [kind, setKind] = useState<ChartKind>('scatter');
  const [x, setX] = useState('');
  const [y, setY] = useState('');
  const [weight, setWeight] = useState('');
  const [filters, setFilters] = useState<ChartFilter[]>([]);
  const [draftColumn, setDraftColumn] = useState('');
  const [draftOperator, setDraftOperator] = useState('equals');
  const [draftValue, setDraftValue] = useState('');
  const [fitOn, setFitOn] = useState(false);
  const [jitter, setJitter] = useState(false);
  const [scaleFactor, setScaleFactor] = useState<1 | 3>(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [page, setPage] = useState<ChartPage | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!columns.length) return;
    setX(current => current || columns[0]?.name || '');
    setY(current => current || columns[1]?.name || columns[0]?.name || '');
  }, [columns]);

  useEffect(() => {
    if (!datasetId || !x || !y) return;
    let live = true;
    setPhase('loading');
    setError('');
    setSelected(null);
    void flowJson<ChartPage>(`/datasets/${datasetId}/chart-data`, {
      method: 'POST',
      body: JSON.stringify({
        kind,
        x,
        y,
        weight_column: weight || null,
        filters: filters.map(filter => ({
          id: filter.id,
          operator: filter.operator,
          value: filter.value,
        })),
      }),
    })
      .then(body => {
        if (!live) return;
        setPage(body);
        setPhase('ready');
      })
      .catch(err => {
        if (!live) return;
        setPage(null);
        setError(err instanceof Error ? err.message : 'The chart did not load');
        setPhase('error');
      });
    return () => {
      live = false;
    };
  }, [datasetId, kind, x, y, weight, filters]);

  const chart = page?.chart;
  const points = chart?.points || [];
  const fit = kind === 'scatter' && fitOn ? linearFit(points) : null;
  const options = pickerColumns(columns).map(column => ({
    value: column.name,
    label: column.label || column.name,
  }));
  const xExtent = useMemo(() => extent(points.map(point => point.x)), [points]);
  const yExtent = useMemo(() => extent(points.map(point => point.y)), [points]);

  const exportPng = () => {
    const node = document.querySelector('.table-chart-svg');
    if (!(node instanceof SVGSVGElement)) return;
    const xml = new XMLSerializer().serializeToString(node);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 640 * scaleFactor;
      canvas.height = 360 * scaleFactor;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = 'chart.png';
      link.click();
    };
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  };

  const reset = () => {
    setKind('scatter');
    setX(columns[0]?.name || '');
    setY(columns[1]?.name || columns[0]?.name || '');
    setWeight('');
    setFilters([]);
    setFitOn(false);
    setJitter(false);
  };

  return (
    <>
      <section className="table-chart-plot">
        <div className="tables-title">
          <div className="tables-title-actions">
            <Button className="flow-btn" type="button" onClick={onShowTable}>
              Table
            </Button>
            <Button className="sources-ink" type="button" aria-pressed>
              Chart
            </Button>
          </div>
        </div>
        {phase === 'loading' ? (
          <Skeleton className="table-chart-skeleton" />
        ) : (
          <>
            <p className="flow-muted">{chart?.title || 'Chart'}</p>
            {error ? <p className="flow-error">{error}</p> : null}
            {kind === 'scatter' && points.length ? (
              <svg
                className="table-chart-svg"
                viewBox="0 0 640 360"
                width="640"
                height="360"
                role="img"
              >
                <line x1="48" y1="320" x2="620" y2="320" stroke="#E7E6E1" />
                <line x1="48" y1="20" x2="48" y2="320" stroke="#E7E6E1" />
                {points.map((point, index) => {
                  const span = xExtent.max - xExtent.min;
                  const offset = jitter ? ((index % 7) - 3) * span * 0.012 : 0;
                  const cx = scale(point.x + offset, xExtent, 56, 610);
                  const cy = scale(point.y, yExtent, 310, 28);
                  return (
                    <circle
                      key={`${point.x}-${point.y}-${index}`}
                      cx={cx}
                      cy={cy}
                      r={selected === index ? 5 : 3.5}
                      fill={selected === index ? '#1B1C1A' : '#1E6B58'}
                      onClick={() => setSelected(index)}
                    />
                  );
                })}
                {fit ? (
                  <line
                    x1={scale(xExtent.min, xExtent, 56, 610)}
                    y1={scale(fit.intercept + fit.slope * xExtent.min, yExtent, 310, 28)}
                    x2={scale(xExtent.max, xExtent, 56, 610)}
                    y2={scale(fit.intercept + fit.slope * xExtent.max, yExtent, 310, 28)}
                    stroke="#1B1C1A"
                    strokeDasharray="4 4"
                  />
                ) : null}
              </svg>
            ) : null}
            {kind !== 'scatter' && chart?.categories?.length ? (
              <svg
                className="table-chart-svg"
                viewBox="0 0 640 360"
                width="640"
                height="360"
                role="img"
              >
                {(chart.series?.[0]?.values || []).map((value, index) => {
                  const values = chart.series?.[0]?.values || [];
                  const range = extent(values);
                  const slot = 560 / values.length;
                  const height = scale(value, range, 0, 280);
                  return kind === 'bar' ? (
                    <rect
                      key={chart.categories?.[index]}
                      x={56 + index * slot}
                      y={310 - height}
                      width={Math.max(slot - 8, 4)}
                      height={height}
                      fill="#1E6B58"
                    />
                  ) : null;
                })}
                {kind === 'line' && (chart.series?.[0]?.values || []).length > 1 ? (
                  <polyline
                    fill="none"
                    stroke="#1E6B58"
                    strokeWidth="2"
                    points={(chart.series?.[0]?.values || [])
                      .map((value, index, values) => {
                        const range = extent(values);
                        const slot = 560 / values.length;
                        return `${56 + index * slot + slot / 2},${scale(value, range, 310, 28)}`;
                      })
                      .join(' ')}
                  />
                ) : null}
              </svg>
            ) : null}
            {kind === 'boxplot' && chart?.groups?.length ? (
              <svg
                className="table-chart-svg"
                viewBox="0 0 640 360"
                width="640"
                height="360"
                role="img"
              >
                {chart.groups.map((group, index) => {
                  const range = extent(chart.groups!.flatMap(item => [item.min, item.max]));
                  const slot = 560 / chart.groups!.length;
                  const xPos = 56 + index * slot + slot / 2;
                  return (
                    <g key={group.label}>
                      <line
                        x1={xPos}
                        x2={xPos}
                        y1={scale(group.min, range, 310, 28)}
                        y2={scale(group.max, range, 310, 28)}
                        stroke="#6A6B66"
                      />
                      <rect
                        x={xPos - 14}
                        y={scale(group.q3, range, 310, 28)}
                        width="28"
                        height={Math.max(
                          scale(group.q1, range, 310, 28) - scale(group.q3, range, 310, 28),
                          1
                        )}
                        fill="#E8F1ED"
                        stroke="#1E6B58"
                      />
                      <line
                        x1={xPos - 14}
                        x2={xPos + 14}
                        y1={scale(group.median, range, 310, 28)}
                        y2={scale(group.median, range, 310, 28)}
                        stroke="#1B1C1A"
                      />
                      <text x={xPos} y="340" textAnchor="middle" fontSize="11" fill="#6A6B66">
                        {group.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            ) : null}
            {selected != null && points[selected] ? (
              <p>
                {chart?.x_label} {points[selected].x}, {chart?.y_label} {points[selected].y}
              </p>
            ) : null}
            {fit ? <p className="flow-muted">{fitLabel(fit)}</p> : null}
            <p className="flow-muted table-chart-foot">
              {[
                page?.n_rows_filtered != null && page?.n_rows != null
                  ? `${page.n_rows_filtered.toLocaleString('en-GB')} of ${page.n_rows.toLocaleString('en-GB')} rows`
                  : '',
                chart?.weighting === 'weighted' ? 'Weighted' : 'Unweighted',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </>
        )}
      </section>
      <aside className="table-chart-settings">
        <div className="tables-rail-head">
          <span>Chart settings</span>
          <Button className="flow-btn" type="button" onClick={reset}>
            Reset
          </Button>
        </div>
        <span className="flow-muted">Chart type</span>
        <div className="anova-pills">
          {KINDS.map(option => (
            <Button
              key={option.value}
              className={kind === option.value ? 'sources-ink' : 'flow-btn'}
              type="button"
              aria-pressed={kind === option.value}
              onClick={() => setKind(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <ChoiceSelect aria-label="X axis" value={x} onValueChange={setX} options={options} />
        <ChoiceSelect aria-label="Y axis" value={y} onValueChange={setY} options={options} />
        <ChoiceSelect
          aria-label="Weight"
          value={weight}
          onValueChange={setWeight}
          options={[{ value: '', label: 'Unweighted' }, ...options]}
        />
        {kind === 'scatter' ? (
          <>
            <Button
              className={fitOn ? 'sources-ink' : 'flow-btn'}
              type="button"
              aria-pressed={fitOn}
              onClick={() => setFitOn(current => !current)}
            >
              Fit line
            </Button>
            <Button
              className={jitter ? 'sources-ink' : 'flow-btn'}
              type="button"
              aria-pressed={jitter}
              onClick={() => setJitter(current => !current)}
            >
              Jitter repeated values
            </Button>
          </>
        ) : null}
        <span className="flow-muted">Filters</span>
        <ChoiceSelect
          aria-label="Filter column"
          value={draftColumn}
          onValueChange={setDraftColumn}
          options={[{ value: '', label: 'Column' }, ...options]}
        />
        <ChoiceSelect
          aria-label="Filter operator"
          value={draftOperator}
          onValueChange={setDraftOperator}
          options={OPERATORS}
        />
        {draftOperator !== 'isNotMissing' ? (
          <Input
            aria-label="Filter value"
            value={draftValue}
            onChange={event => setDraftValue(event.target.value)}
          />
        ) : null}
        <Button
          className="flow-btn"
          type="button"
          onClick={() => {
            if (!draftColumn) return;
            setFilters(current => [
              ...current,
              { id: draftColumn, operator: draftOperator, value: draftValue },
            ]);
            setDraftValue('');
          }}
        >
          Add filter
        </Button>
        {filters.map((filter, index) => (
          <Button
            key={`${filter.id}-${index}`}
            className="flow-btn"
            type="button"
            onClick={() => setFilters(current => current.filter((_, item) => item !== index))}
          >
            {filter.id} {filter.operator} {filter.value} ×
          </Button>
        ))}
        <div className="anova-pills">
          <Button
            className={scaleFactor === 1 ? 'sources-ink' : 'flow-btn'}
            type="button"
            onClick={() => setScaleFactor(1)}
          >
            1x
          </Button>
          <Button
            className={scaleFactor === 3 ? 'sources-ink' : 'flow-btn'}
            type="button"
            onClick={() => setScaleFactor(3)}
          >
            3x
          </Button>
        </div>
        <Button className="sources-ink" type="button" onClick={() => setExportOpen(true)}>
          Export
        </Button>
        {projectId ? (
          <Link className="flow-btn" href={`/flow/p/${projectId}/report`}>
            Add to report
          </Link>
        ) : null}
        <p className="flow-muted">
          {640 * scaleFactor} × {360 * scaleFactor} px · white background
        </p>
      </aside>
      {exportOpen ? (
        <ExportDialog
          kind="chart"
          title={`${y || 'y'} vs ${x || 'x'}`}
          svg={
            typeof document === 'undefined'
              ? undefined
              : document.querySelector('.table-chart-svg')?.outerHTML
          }
          document={runDocument({
            title: `${y || 'y'} vs ${x || 'x'}`,
            op: kind,
            report: {
              summary: fit ? fitLabel(fit) : '',
              tables: [
                {
                  title: 'Points',
                  columns: ['x', 'y'],
                  rows: points.slice(0, 500).map(point => [String(point.x), String(point.y)]),
                },
              ],
            },
          })}
          runIds={[]}
          onClose={() => setExportOpen(false)}
        />
      ) : null}
    </>
  );
}
