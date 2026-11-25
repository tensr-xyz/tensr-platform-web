'use client';

import { useEffect, useRef, useState } from 'react';
import type { AnalysisReportChart, ChartAxisScale } from '@/lib/analysis-report-types';
import { chartFootnoteLines, errorBarFootnoteLines } from '@/lib/chart-error-bars';
import {
  type ChartDensity,
  type ChartLayout,
  computeLayout,
  formatDateTick,
  formatNumberTick,
  inferDateResolution,
  ticksInDomain,
  parseAxisDate,
  planCategoryLabels,
  scaleLinear,
  truncateLabel,
  valuesLookLikeDatetime,
  withExtraPadB,
} from '@/utils/chart-axis';
import { resolveSeriesColors, type ChartStylePreset } from '@/lib/chart-theme';

export type ReportChartProps = {
  chart: AnalysisReportChart;
  /** inline = chat/card; comfortable = fullscreen (and preferred export source). */
  density?: ChartDensity;
  className?: string;
  /** `default` keeps the current palette. `apa` is greyscale, sans-serif, with a figure caption. */
  preset?: ChartStylePreset;
  /** Team / template chart palette. Ignored when `preset` is `apa`. */
  seriesColors?: string[];
  figureNumber?: number;
  note?: string;
};

function resolveNumericScale(
  hint: ChartAxisScale | undefined,
  values: unknown[]
): 'linear' | 'datetime' {
  if (hint === 'datetime') return 'datetime';
  if (hint === 'linear' || hint === 'category') return 'linear';
  return valuesLookLikeDatetime(values) ? 'datetime' : 'linear';
}

function stepAfterPath(
  pts: { x: number; y: number }[],
  sx: (v: number) => number,
  sy: (v: number) => number
): string {
  if (!pts.length) return '';
  const first = pts[0]!;
  const parts = [`M ${sx(first.x)} ${sy(first.y)}`];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]!;
    parts.push(`H ${sx(p.x)}`, `V ${sy(p.y)}`);
  }
  return parts.join(' ');
}

function formatAxisValue(
  value: number,
  scale: 'linear' | 'datetime',
  sampleValues: number[],
  dates: Date[]
): string {
  if (scale === 'datetime') {
    const d = parseAxisDate(value) ?? new Date(value);
    if (Number.isNaN(d.getTime())) return formatNumberTick(value, sampleValues);
    return formatDateTick(d, inferDateResolution(dates.length ? dates : [d]));
  }
  return formatNumberTick(value, sampleValues);
}

/** Prefer a stored value label over a bare code. Exact codes only — no rounding. */
function labelledTick(value: number, labels?: Record<string, string>): string | null {
  if (!labels) return null;
  const keys = [
    String(value),
    Number.isInteger(value) ? String(value) : value.toPrecision(12).replace(/\.?0+$/, ''),
  ];
  if (Math.abs(value - Math.round(value)) < 1e-9) {
    keys.push(String(Math.round(value)));
  }
  for (const key of keys) {
    const found = labels[key];
    if (found) return found;
  }
  for (const [key, label] of Object.entries(labels)) {
    const numeric = Number(key);
    if (Number.isFinite(numeric) && Math.abs(numeric - value) < 1e-6) return label;
  }
  return null;
}

/** One tick per labelled code so histogram axes do not repeat value labels. */
function labelledCodeTicks(
  labels: Record<string, string>,
  xMin: number,
  xMax: number,
  padL: number,
  plotW: number
): { value: number; x: number; label: string }[] {
  const span = xMax - xMin || 1;
  const ticks: { value: number; x: number; label: string }[] = [];
  for (const [key, label] of Object.entries(labels)) {
    const value = Number(key);
    if (!Number.isFinite(value) || value < xMin - 1e-9 || value > xMax + 1e-9) continue;
    if (!String(label || '').trim()) continue;
    ticks.push({
      value,
      x: padL + ((value - xMin) / span) * plotW,
      label: String(label),
    });
  }
  ticks.sort((a, b) => a.value - b.value);
  return ticks;
}

function AxisFrame({
  layout,
  xTicks,
  yTicks,
  xFormatter,
  yFormatter,
  xAxisLabel,
  yAxisLabel,
  categoryLabels,
}: {
  layout: ChartLayout;
  xTicks?: { value: number; x: number }[];
  yTicks?: { value: number; y: number }[];
  xFormatter?: (v: number) => string;
  yFormatter?: (v: number) => string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  categoryLabels?: {
    labels: string[];
    xs: number[];
    plan: ReturnType<typeof planCategoryLabels>;
  };
}) {
  const { padL, padT, plotW, plotH, fontSize, height } = layout;
  const axisY = padT + plotH;
  return (
    <g className="chart-axes">
      <line
        x1={padL}
        y1={axisY}
        x2={padL + plotW}
        y2={axisY}
        className="stroke-zinc-200"
        strokeWidth={1}
      />
      <line x1={padL} y1={padT} x2={padL} y2={axisY} className="stroke-zinc-200" strokeWidth={1} />

      {yTicks?.map(t => (
        <g key={`y-${t.value}`}>
          <line
            x1={padL - 4}
            y1={t.y}
            x2={padL}
            y2={t.y}
            className="stroke-zinc-300"
            strokeWidth={1}
          />
          <text
            x={padL - 8}
            y={t.y + fontSize * 0.35}
            textAnchor="end"
            fill="#71717a"
            style={{ fontSize }}
          >
            {yFormatter?.(t.value) ?? String(t.value)}
          </text>
        </g>
      ))}

      {xTicks?.map(t => (
        <g key={`x-${t.value}`}>
          <line
            x1={t.x}
            y1={axisY}
            x2={t.x}
            y2={axisY + 4}
            className="stroke-zinc-300"
            strokeWidth={1}
          />
          <text
            x={t.x}
            y={axisY + fontSize + 6}
            textAnchor="middle"
            fill="#71717a"
            style={{ fontSize }}
          >
            {xFormatter?.(t.value) ?? String(t.value)}
          </text>
        </g>
      ))}

      {categoryLabels?.labels.map((label, i) => {
        if (i % categoryLabels.plan.showEvery !== 0) return null;
        const x = categoryLabels.xs[i]!;
        const text = truncateLabel(label, categoryLabels.plan.maxChars);
        if (categoryLabels.plan.rotate) {
          return (
            <text
              key={`c-${i}-${label}`}
              x={x}
              y={axisY + 10}
              textAnchor="end"
              fill="#71717a"
              style={{ fontSize }}
              transform={`rotate(-45 ${x} ${axisY + 10})`}
            >
              {text}
            </text>
          );
        }
        return (
          <text
            key={`c-${i}-${label}`}
            x={x}
            y={axisY + fontSize + 6}
            textAnchor="middle"
            fill="#71717a"
            style={{ fontSize }}
          >
            {text}
          </text>
        );
      })}

      {xAxisLabel ? (
        <text
          x={padL + plotW / 2}
          y={height - 4}
          textAnchor="middle"
          fill="#a1a1aa"
          style={{ fontSize: fontSize }}
        >
          {truncateLabel(xAxisLabel, layout.density === 'comfortable' ? 48 : 32)}
        </text>
      ) : null}

      {yAxisLabel ? (
        <text
          x={12}
          y={padT + plotH / 2}
          textAnchor="middle"
          fill="#a1a1aa"
          style={{ fontSize }}
          transform={`rotate(-90 12 ${padT + plotH / 2})`}
        >
          {truncateLabel(yAxisLabel, layout.density === 'comfortable' ? 40 : 28)}
        </text>
      ) : null}
    </g>
  );
}

function ChartTitle({ layout, title }: { layout: ChartLayout; title: string }) {
  const maxChars = Math.max(
    24,
    Math.floor((layout.width - layout.padL - layout.padR) / (layout.titleSize * 0.55))
  );
  const shown = truncateLabel(title, maxChars);
  return (
    <text
      x={layout.padL}
      y={layout.titleSize + 2}
      fill="#3f3f46"
      style={{ fontSize: layout.titleSize, fontWeight: 500 }}
    >
      {shown !== title ? <title>{title}</title> : null}
      {shown}
    </text>
  );
}

function ChartBody({
  chart,
  layout: baseLayout,
  seriesFill,
}: {
  chart: AnalysisReportChart;
  layout: ChartLayout;
  seriesFill: string[];
}) {
  if (chart.kind === 'histogram') {
    const maxC = Math.max(1, ...chart.bins.map(b => b.count));
    const xMin = chart.bins.length ? Math.min(...chart.bins.map(b => b.start)) : 0;
    const xMax = chart.bins.length ? Math.max(...chart.bins.map(b => b.end)) : 1;
    const xScale = resolveNumericScale(
      chart.x_scale,
      chart.bins.flatMap(b => [b.start, b.end])
    );
    const xDates = chart.bins.flatMap(b => {
      const a = parseAxisDate(b.start);
      const c = parseAxisDate(b.end);
      return [a, c].filter((d): d is Date => d != null);
    });
    const layout = baseLayout;
    const { padL, padT, plotW, plotH } = layout;
    const n = chart.bins.length || 1;
    const gap = Math.max(1, plotW / n > 20 ? 2 : 1);
    const barW = Math.max(1, (plotW - gap * (n - 1)) / n);
    const yS = scaleLinear(0, maxC, padT + plotH, padT);
    const labelled =
      chart.x_tick_labels && Object.keys(chart.x_tick_labels).length > 0
        ? labelledCodeTicks(chart.x_tick_labels, xMin, xMax, padL, plotW)
        : null;
    const xTicks =
      labelled && labelled.length > 0
        ? labelled.map(t => ({ value: t.value, x: t.x }))
        : ticksInDomain(xMin, xMax, layout.maxTicksX).map(v => ({
            value: v,
            x: padL + ((v - xMin) / (xMax - xMin || 1)) * plotW,
          }));
    const labelByValue =
      labelled && labelled.length > 0 ? new Map(labelled.map(t => [t.value, t.label])) : null;
    const yTicks = ticksInDomain(0, maxC, layout.maxTicksY).map(v => ({
      value: v,
      y: yS(v),
    }));
    const xSamples = chart.bins.flatMap(b => [b.start, b.end]);
    const ySamples = chart.bins.map(b => b.count);

    return (
      <svg
        data-chart-kind={chart.kind}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="h-auto w-full max-w-full text-zinc-500"
        aria-hidden
      >
        <ChartTitle layout={layout} title={chart.title} />
        {chart.bins.map((b, i) => {
          const x = padL + i * (barW + gap);
          return (
            <rect
              key={i}
              x={x}
              y={yS(b.count)}
              width={barW}
              height={Math.max(0, padT + plotH - yS(b.count))}
              className="fill-zinc-300"
              rx={1}
            />
          );
        })}
        <AxisFrame
          layout={layout}
          xTicks={xTicks}
          yTicks={yTicks}
          xFormatter={v =>
            labelByValue?.get(v) ??
            labelledTick(v, chart.x_tick_labels) ??
            formatAxisValue(v, xScale, xSamples, xDates)
          }
          yFormatter={v => formatNumberTick(v, ySamples)}
          xAxisLabel={chart.x_label}
          yAxisLabel="Count"
        />
      </svg>
    );
  }

  if (chart.kind === 'step_line') {
    const pts = chart.points;
    const xs = pts.map(p => p.x);
    const ys = pts.map(p => p.y);
    let x0 = Math.min(...xs, 0);
    let x1 = Math.max(...xs);
    let y0 = Math.min(...ys, 0);
    let y1 = Math.max(...ys, 1);
    const padX = (x1 - x0) * 0.04 || 0.5;
    const padY = (y1 - y0) * 0.08 || 0.05;
    x0 -= padX;
    x1 += padX;
    y0 = Math.min(y0 - padY, 0);
    y1 += padY;
    const xScale = resolveNumericScale(chart.x_scale, xs);
    const yScale = resolveNumericScale(chart.y_scale, ys);
    const xDates = xs.map(parseAxisDate).filter((d): d is Date => d != null);
    const layout = baseLayout;
    const { padL, padT, plotW, plotH } = layout;
    const sx = scaleLinear(x0, x1, padL, padL + plotW);
    const sy = scaleLinear(y0, y1, padT + plotH, padT);
    const xTicks = ticksInDomain(x0, x1, layout.maxTicksX).map(v => ({ value: v, x: sx(v) }));
    const yTicks = ticksInDomain(y0, y1, layout.maxTicksY).map(v => ({ value: v, y: sy(v) }));
    const tickH = layout.density === 'comfortable' ? 8 : 6;
    const censored = chart.censored ?? [];

    return (
      <svg
        data-chart-kind={chart.kind}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="h-auto w-full max-w-full"
        aria-hidden
      >
        <ChartTitle layout={layout} title={chart.title} />
        <path
          d={stepAfterPath(pts, sx, sy)}
          className="stroke-violet-600"
          fill="none"
          strokeWidth={2}
          strokeLinejoin="miter"
        />
        {censored.map((p, i) => (
          <line
            key={`censor-${i}`}
            x1={sx(p.x)}
            y1={sy(p.y) - tickH}
            x2={sx(p.x)}
            y2={sy(p.y) + tickH}
            className="stroke-zinc-500"
            strokeWidth={1.5}
          />
        ))}
        <AxisFrame
          layout={layout}
          xTicks={xTicks}
          yTicks={yTicks}
          xFormatter={v => formatAxisValue(v, xScale, xs, xDates)}
          yFormatter={v => formatNumberTick(v, ys)}
          xAxisLabel={chart.x_label}
          yAxisLabel={chart.y_label}
        />
      </svg>
    );
  }

  if (
    chart.kind === 'scatter' ||
    chart.kind === 'scatter_line' ||
    chart.kind === 'roc' ||
    chart.kind === 'qq' ||
    chart.kind === 'pp'
  ) {
    const pts = chart.points;
    if (!pts.length) {
      return (
        <svg
          data-chart-kind={chart.kind}
          viewBox={`0 0 ${baseLayout.width} ${baseLayout.height}`}
          className="h-auto w-full max-w-full"
          aria-hidden
        >
          <ChartTitle layout={baseLayout} title={chart.title} />
        </svg>
      );
    }
    const xs = pts.map(p => p.x);
    const ys = pts.map(p => p.y);
    let x0 = Math.min(...xs);
    let x1 = Math.max(...xs);
    let y0 = Math.min(...ys);
    let y1 = Math.max(...ys);
    if (chart.kind === 'roc' || chart.kind === 'pp') {
      x0 = 0;
      x1 = 1;
      y0 = 0;
      y1 = 1;
    } else {
      const padX = (x1 - x0) * 0.06 || 0.5;
      const padY = (y1 - y0) * 0.06 || 0.5;
      x0 -= padX;
      x1 += padX;
      y0 -= padY;
      y1 += padY;
    }
    const xScale = resolveNumericScale(chart.x_scale, xs);
    const yScale = resolveNumericScale(chart.y_scale, ys);
    const xDates = xs.map(parseAxisDate).filter((d): d is Date => d != null);
    const yDates = ys.map(parseAxisDate).filter((d): d is Date => d != null);
    const layout = baseLayout;
    const { padL, padT, plotW, plotH } = layout;
    const sx = scaleLinear(x0, x1, padL, padL + plotW);
    const sy = scaleLinear(y0, y1, padT + plotH, padT);
    const line = chart.kind === 'scatter' ? null : chart.line;
    const xTicks = ticksInDomain(x0, x1, layout.maxTicksX).map(v => ({ value: v, x: sx(v) }));
    const yTicks = ticksInDomain(y0, y1, layout.maxTicksY).map(v => ({ value: v, y: sy(v) }));
    const baseRadius = layout.density === 'comfortable' ? 3 : 2.2;
    const sizedByWeight = chart.kind === 'scatter' && chart.point_size === 'weight';
    const maxWeight = sizedByWeight
      ? Math.max(0, ...pts.map(p => ('weight' in p && typeof p.weight === 'number' ? p.weight : 0)))
      : 0;
    const maxRadius = layout.density === 'comfortable' ? 9 : 7;
    const pointRadius = (weight: number | undefined) =>
      sizedByWeight && maxWeight > 0 && typeof weight === 'number'
        ? Math.max(1.5, maxRadius * Math.sqrt(weight / maxWeight))
        : baseRadius;

    return (
      <svg
        data-chart-kind={chart.kind}
        data-point-size={sizedByWeight ? 'weight' : undefined}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="h-auto w-full max-w-full"
        aria-hidden
      >
        <ChartTitle layout={layout} title={chart.title} />
        {line && (
          <line
            x1={sx(line.x0)}
            y1={sy(line.y0)}
            x2={sx(line.x1)}
            y2={sy(line.y1)}
            className="stroke-violet-600"
            strokeWidth={2}
            strokeLinecap="round"
          />
        )}
        {pts.map((p, i) => (
          <g key={i}>
            <circle
              cx={sx(p.x)}
              cy={sy(p.y)}
              r={pointRadius('weight' in p ? p.weight : undefined)}
              className={sizedByWeight ? 'fill-zinc-600/45 stroke-zinc-700/60' : 'fill-zinc-600/80'}
              strokeWidth={sizedByWeight ? 0.5 : undefined}
            />
            {'label' in p && p.label ? (
              <text
                x={sx(p.x) + 6}
                y={sy(p.y) - 4}
                fill="#3f3f46"
                style={{ fontSize: layout.density === 'comfortable' ? 11 : 10 }}
              >
                {p.label}
              </text>
            ) : null}
          </g>
        ))}
        <AxisFrame
          layout={layout}
          xTicks={xTicks}
          yTicks={yTicks}
          xFormatter={v =>
            (chart.kind === 'scatter' ? labelledTick(v, chart.x_tick_labels) : null) ??
            formatAxisValue(v, xScale, xs, xDates)
          }
          yFormatter={v =>
            (chart.kind === 'scatter' ? labelledTick(v, chart.y_tick_labels) : null) ??
            formatAxisValue(v, yScale, ys, yDates)
          }
          xAxisLabel={chart.x_label}
          yAxisLabel={chart.y_label}
        />
      </svg>
    );
  }

  if (chart.kind === 'boxplot') {
    const gs = chart.groups;
    if (!gs.length) {
      return (
        <svg
          data-chart-kind={chart.kind}
          viewBox={`0 0 ${baseLayout.width} ${baseLayout.height}`}
          className="h-auto w-full max-w-full"
          aria-hidden
        >
          <ChartTitle layout={baseLayout} title={chart.title} />
        </svg>
      );
    }
    const yMin = Math.min(...gs.map(g => g.min));
    const yMax = Math.max(...gs.map(g => g.max));
    const pad = (yMax - yMin) * 0.08 || 0.5;
    const d0 = yMin - pad;
    const d1 = yMax + pad;
    const labels = gs.map(g => g.label);
    const slot = baseLayout.plotW / Math.max(1, gs.length);
    const plan = planCategoryLabels(
      labels,
      slot,
      baseLayout.fontSize,
      baseLayout.density,
      baseLayout.padB
    );
    const layout = withExtraPadB(baseLayout, plan.padB);
    const { padL, padT, plotW, plotH } = layout;
    const sy = scaleLinear(d0, d1, padT + plotH, padT);
    const n = gs.length;
    const boxW = Math.min(
      layout.density === 'comfortable' ? 36 : 28,
      (plotW / Math.max(1, n)) * 0.55
    );
    const yTicks = ticksInDomain(d0, d1, layout.maxTicksY).map(v => ({ value: v, y: sy(v) }));
    const xs = gs.map((_, i) => padL + i * (plotW / n) + plotW / n / 2);
    const ySamples = gs.flatMap(g => [g.min, g.q1, g.median, g.q3, g.max]);

    return (
      <svg
        data-chart-kind={chart.kind}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="h-auto w-full max-w-full"
        aria-hidden
      >
        <ChartTitle layout={layout} title={chart.title} />
        {gs.map((g, i) => {
          const cx = xs[i]!;
          const xL = cx - boxW / 2;
          return (
            <g key={g.label}>
              <line
                x1={cx}
                y1={sy(g.min)}
                x2={cx}
                y2={sy(g.max)}
                className="stroke-zinc-400"
                strokeWidth={1.5}
              />
              <line
                x1={cx - boxW / 4}
                y1={sy(g.min)}
                x2={cx + boxW / 4}
                y2={sy(g.min)}
                className="stroke-zinc-500"
                strokeWidth={1.5}
              />
              <line
                x1={cx - boxW / 4}
                y1={sy(g.max)}
                x2={cx + boxW / 4}
                y2={sy(g.max)}
                className="stroke-zinc-500"
                strokeWidth={1.5}
              />
              <rect
                x={xL}
                y={sy(g.q3)}
                width={boxW}
                height={Math.max(1, sy(g.q1) - sy(g.q3))}
                className="fill-zinc-200 stroke-zinc-400"
                strokeWidth={1}
              />
              <line
                x1={xL}
                y1={sy(g.median)}
                x2={xL + boxW}
                y2={sy(g.median)}
                className="stroke-zinc-800"
                strokeWidth={1.5}
              />
            </g>
          );
        })}
        <AxisFrame
          layout={layout}
          yTicks={yTicks}
          yFormatter={v => formatNumberTick(v, ySamples)}
          yAxisLabel={chart.y_label}
          categoryLabels={{ labels, xs, plan }}
        />
      </svg>
    );
  }

  if (chart.kind === 'bar_horizontal') {
    const { categories, series } = chart;
    const hasLetters = series.some(s => s.letters?.some(letter => String(letter || '').trim()));
    // Grouped horizontal: each series is a parallel bar; use max absolute for scale.
    const ySamples = series.flatMap(s =>
      s.values.flatMap((value, index) => {
        const error = s.errors?.[index];
        return error ? [value - error, value, value + error] : [value];
      })
    );
    const dataMin = ySamples.length ? Math.min(...ySamples) : 0;
    const dataMax = ySamples.length ? Math.max(...ySamples) : 1;
    const minV = Math.min(0, dataMin);
    const maxRaw = Math.max(dataMax, minV === 0 ? 1 : 0);
    const maxV = hasLetters ? maxRaw + Math.max(0.5, (maxRaw - minV) * 0.08) : maxRaw;
    const legendMax = baseLayout.density === 'comfortable' ? 28 : 16;
    const labelChars = baseLayout.density === 'comfortable' ? 28 : 18;
    const labelPad = Math.min(
      180,
      Math.max(
        72,
        Math.round(
          Math.max(...categories.map(c => Math.min(c.length, labelChars))) *
            baseLayout.fontSize *
            0.55 +
            16
        )
      )
    );
    const legendGutter = Math.min(
      160,
      Math.max(72, Math.round(legendMax * baseLayout.fontSize * 0.6 + 20))
    );
    const layout = {
      ...baseLayout,
      padL: Math.max(baseLayout.padL, labelPad),
      padR: Math.max(baseLayout.padR, legendGutter),
      padB: Math.max(baseLayout.padB, chart.x_label ? 36 : 28),
      plotW:
        baseLayout.width -
        Math.max(baseLayout.padL, labelPad) -
        Math.max(baseLayout.padR, legendGutter),
      plotH:
        baseLayout.height - baseLayout.padT - Math.max(baseLayout.padB, chart.x_label ? 36 : 28),
    };
    const { padL, padT, plotW, plotH } = layout;
    const sx = scaleLinear(minV, maxV, padL, padL + plotW);
    const xZero = sx(0);
    const ng = categories.length;
    const ns = series.length;
    const groupH = plotH / Math.max(1, ng);
    const inner = groupH * 0.82;
    const barH = inner / Math.max(1, ns);
    const gap = groupH * 0.09;
    const xTicks = ticksInDomain(minV, maxV, layout.maxTicksX).map(v => ({
      value: v,
      x: sx(v),
    }));
    const footnoteLines = chartFootnoteLines(chart);
    const footnoteLineH = layout.fontSize + 4;
    const footnoteH = footnoteLines.length ? footnoteLines.length * footnoteLineH + 6 : 0;
    const letterSize = Math.max(9, layout.fontSize - 1);

    return (
      <svg
        data-chart-kind="bar_horizontal"
        data-error-bars={errorBarFootnoteLines(chart).length ? 'on' : undefined}
        data-significance={hasLetters ? 'on' : undefined}
        viewBox={`0 0 ${layout.width} ${layout.height + footnoteH}`}
        className="h-auto w-full max-w-full"
        aria-hidden
      >
        <ChartTitle layout={layout} title={chart.title} />
        {categories.flatMap((cat, gi) =>
          series.map((ser, si) => {
            const v = ser.values[gi] ?? 0;
            const y = padT + gi * groupH + gap + si * barH;
            const xVal = sx(v);
            const x = Math.min(xZero, xVal);
            const letter = String(ser.letters?.[gi] || '').trim();
            const yMid = y + barH / 2;
            return (
              <g key={`${gi}-${si}`}>
                <rect
                  x={x}
                  y={y}
                  width={Math.max(0, Math.abs(xVal - xZero))}
                  height={Math.max(1, barH - 1)}
                  fill={seriesFill[si % seriesFill.length]}
                  rx={1}
                />
                {letter ? (
                  <text
                    data-chart-letter
                    x={Math.max(xVal, xZero) + 6}
                    y={yMid + letterSize * 0.35}
                    textAnchor="start"
                    fill="#27272a"
                    style={{ fontSize: letterSize, fontWeight: 600 }}
                  >
                    {letter}
                  </text>
                ) : null}
                {si === 0 ? (
                  <text
                    x={padL - 8}
                    y={padT + gi * groupH + groupH / 2 + layout.fontSize * 0.35}
                    textAnchor="end"
                    fill="#71717a"
                    style={{ fontSize: layout.fontSize }}
                  >
                    {truncateLabel(cat, labelChars)}
                  </text>
                ) : null}
              </g>
            );
          })
        )}
        <AxisFrame
          layout={layout}
          xTicks={xTicks}
          xFormatter={v => formatNumberTick(v, ySamples)}
          xAxisLabel={chart.x_label}
          yAxisLabel={chart.y_label}
        />
        <g transform={`translate(${padL + plotW + 10} ${padT + 4})`}>
          {series.map((ser, si) => (
            <g key={ser.name} transform={`translate(0 ${si * (layout.fontSize + 4)})`}>
              <rect width={8} height={8} fill={seriesFill[si % seriesFill.length]} rx={1} />
              <text x={12} y={7} fill="#52525b" style={{ fontSize: layout.fontSize }}>
                {truncateLabel(ser.name, legendMax)}
              </text>
            </g>
          ))}
        </g>
        {footnoteLines.map((line, index) => (
          <text
            key={line}
            data-chart-footnote
            x={layout.padL}
            y={layout.height + 2 + (index + 1) * footnoteLineH}
            fill="#71717a"
            style={{ fontSize: layout.fontSize }}
          >
            {line}
          </text>
        ))}
      </svg>
    );
  }

  if (
    chart.kind === 'bar_grouped' ||
    chart.kind === 'bar_stacked' ||
    chart.kind === 'bar_stacked_100' ||
    chart.kind === 'line' ||
    chart.kind === 'bar' ||
    chart.kind === 'area'
  ) {
    const { categories, series } = chart;
    const isStacked = chart.kind === 'bar_stacked' || chart.kind === 'bar_stacked_100';
    const isPercentStack = chart.kind === 'bar_stacked_100';
    const stackTotals = categories.map((_, gi) =>
      series.reduce((sum, ser) => sum + Math.max(0, ser.values[gi] ?? 0), 0)
    );
    const stackedValues = series.map(ser =>
      ser.values.map((value, gi) => {
        const raw = Math.max(0, value ?? 0);
        if (!isPercentStack) return raw;
        const total = stackTotals[gi] || 0;
        return total > 0 ? (raw / total) * 100 : 0;
      })
    );
    const ySamples = isStacked
      ? isPercentStack
        ? [0, 100]
        : stackTotals
      : series.flatMap(s =>
          s.values.flatMap((value, index) => {
            const error = s.errors?.[index];
            return error ? [value - error, value, value + error] : [value];
          })
        );
    const hasLetters = series.some(s => s.letters?.some(letter => String(letter || '').trim()));
    const dataMin = ySamples.length ? Math.min(...ySamples) : 0;
    const dataMax = ySamples.length ? Math.max(...ySamples) : 1;
    const minV = Math.min(0, dataMin);
    const maxRaw = isPercentStack ? 100 : Math.max(dataMax, minV === 0 ? 1 : 0);
    // Leave room above the tallest bar/point for column letters.
    const maxV = hasLetters ? maxRaw + Math.max(0.5, (maxRaw - minV) * 0.1) : maxRaw;
    const catsAreDates =
      chart.x_scale === 'datetime' ||
      (chart.x_scale !== 'category' && valuesLookLikeDatetime(categories));
    const catDates = categories.map(parseAxisDate).filter((d): d is Date => d != null);
    const dateRes = inferDateResolution(catDates);
    const legendMax = baseLayout.density === 'comfortable' ? 28 : 16;
    // Reserve right gutter so legend text isn't clipped by the viewBox edge.
    const legendGutter = Math.min(
      160,
      Math.max(72, Math.round(legendMax * baseLayout.fontSize * 0.6 + 20))
    );
    const layoutForCats = {
      ...baseLayout,
      padR: Math.max(baseLayout.padR, legendGutter),
      plotW: baseLayout.width - baseLayout.padL - Math.max(baseLayout.padR, legendGutter),
    };

    const slot = layoutForCats.plotW / Math.max(1, categories.length);
    const displayLabels = categories.map(c => {
      if (!catsAreDates) return c;
      const d = parseAxisDate(c);
      return d ? formatDateTick(d, dateRes) : c;
    });
    const plan = planCategoryLabels(
      displayLabels,
      slot,
      layoutForCats.fontSize,
      layoutForCats.density,
      layoutForCats.padB
    );
    const layout = withExtraPadB(layoutForCats, plan.padB + (chart.x_label ? 12 : 0));
    const { padL, padT, plotW, plotH } = layout;
    const sy = scaleLinear(minV, maxV, padT + plotH, padT);
    const yZero = sy(0);
    const ng = categories.length;
    const ns = series.length;
    const groupW = plotW / Math.max(1, ng);
    const inner = groupW * 0.88;
    const barW = isStacked ? inner : inner / Math.max(1, ns);
    const gap = groupW * 0.06;
    const isArea = chart.kind === 'area';
    const isLine = chart.kind === 'line' || isArea;
    const yTicks = ticksInDomain(minV, maxV, layout.maxTicksY).map(v => ({ value: v, y: sy(v) }));
    const xs = categories.map((_, i) => padL + i * groupW + groupW / 2);
    const footnoteLines = chartFootnoteLines(chart);
    const footnoteLineH = layout.fontSize + 4;
    const footnoteH = footnoteLines.length ? footnoteLines.length * footnoteLineH + 6 : 0;
    const capHalf = Math.max(2, Math.min(6, barW * 0.2));
    const letterSize = Math.max(9, layout.fontSize - 1);

    return (
      <svg
        data-chart-kind={chart.kind}
        data-error-bars={errorBarFootnoteLines(chart).length ? 'on' : undefined}
        data-significance={hasLetters ? 'on' : undefined}
        viewBox={`0 0 ${layout.width} ${layout.height + footnoteH}`}
        className="h-auto w-full max-w-full"
        aria-hidden
      >
        <ChartTitle layout={layout} title={chart.title} />
        {isLine
          ? series.map((ser, si) => {
              const pts = categories
                .map((_, gi) => {
                  const v = ser.values[gi] ?? 0;
                  return `${xs[gi]},${sy(v)}`;
                })
                .join(' ');
              const color = seriesFill[si % seriesFill.length];
              return (
                <g key={ser.name}>
                  {isArea && categories.length ? (
                    <polygon
                      points={`${xs[0]},${yZero} ${pts} ${xs[xs.length - 1]},${yZero}`}
                      fill={color}
                      fillOpacity={0.28}
                    />
                  ) : null}
                  <polyline points={pts} fill="none" stroke={color} strokeWidth={2} />
                  {categories.map((_, gi) => {
                    const v = ser.values[gi] ?? 0;
                    const error = ser.errors?.[gi];
                    const letter = String(ser.letters?.[gi] || '').trim();
                    return (
                      <g key={`${ser.name}-${gi}`}>
                        {error ? (
                          <g stroke={color} strokeWidth={1.2}>
                            <line x1={xs[gi]} x2={xs[gi]} y1={sy(v - error)} y2={sy(v + error)} />
                            <line
                              x1={xs[gi] - 4}
                              x2={xs[gi] + 4}
                              y1={sy(v - error)}
                              y2={sy(v - error)}
                            />
                            <line
                              x1={xs[gi] - 4}
                              x2={xs[gi] + 4}
                              y1={sy(v + error)}
                              y2={sy(v + error)}
                            />
                          </g>
                        ) : null}
                        <circle
                          cx={xs[gi]}
                          cy={sy(v)}
                          r={layout.density === 'comfortable' ? 3.2 : 2.5}
                          fill={seriesFill[si % seriesFill.length]}
                        />
                        {letter ? (
                          <text
                            data-chart-letter
                            x={xs[gi]}
                            y={sy(v) - 6}
                            textAnchor="middle"
                            fill="#27272a"
                            style={{ fontSize: letterSize, fontWeight: 600 }}
                          >
                            {letter}
                          </text>
                        ) : null}
                      </g>
                    );
                  })}
                </g>
              );
            })
          : isStacked
            ? categories.flatMap((_, gi) => {
                let cursor = 0;
                const x = padL + gi * groupW + gap;
                const xMid = x + barW / 2;
                return series.map((ser, si) => {
                  const v = stackedValues[si]?.[gi] ?? 0;
                  const yBottom = sy(cursor);
                  cursor += v;
                  const yTop = sy(cursor);
                  const letter = String(ser.letters?.[gi] || '').trim();
                  const segH = Math.abs(yBottom - yTop);
                  return (
                    <g key={`${gi}-${si}`}>
                      <rect
                        x={x}
                        y={Math.min(yTop, yBottom)}
                        width={Math.max(1, barW - 1)}
                        height={Math.max(0, segH)}
                        fill={seriesFill[si % seriesFill.length]}
                        rx={si === ns - 1 || si === 0 ? 1 : 0}
                      />
                      {letter && segH >= letterSize + 2 ? (
                        <text
                          data-chart-letter
                          x={xMid}
                          y={(yTop + yBottom) / 2 + letterSize * 0.35}
                          textAnchor="middle"
                          fill="#27272a"
                          style={{ fontSize: letterSize, fontWeight: 600 }}
                        >
                          {letter}
                        </text>
                      ) : letter ? (
                        <text
                          data-chart-letter
                          x={xMid}
                          y={Math.min(yTop, yBottom) - 4}
                          textAnchor="middle"
                          fill="#27272a"
                          style={{ fontSize: letterSize, fontWeight: 600 }}
                        >
                          {letter}
                        </text>
                      ) : null}
                    </g>
                  );
                });
              })
            : categories.flatMap((_, gi) =>
                series.map((ser, si) => {
                  const v = ser.values[gi] ?? 0;
                  const x = padL + gi * groupW + gap + si * barW;
                  const yVal = sy(v);
                  const y = Math.min(yZero, yVal);
                  const error = ser.errors?.[gi];
                  const xMid = x + barW / 2;
                  const letter = String(ser.letters?.[gi] || '').trim();
                  const letterY = Math.min(yVal, yZero) - 4;
                  return (
                    <g key={`${gi}-${si}`}>
                      <rect
                        x={x}
                        y={y}
                        width={Math.max(1, barW - 1)}
                        height={Math.max(0, Math.abs(yZero - yVal))}
                        fill={seriesFill[si % seriesFill.length]}
                        rx={1}
                      />
                      {error ? (
                        <g stroke="#27272a" strokeWidth={1.2}>
                          <line x1={xMid} x2={xMid} y1={sy(v - error)} y2={sy(v + error)} />
                          <line
                            x1={xMid - capHalf}
                            x2={xMid + capHalf}
                            y1={sy(v - error)}
                            y2={sy(v - error)}
                          />
                          <line
                            x1={xMid - capHalf}
                            x2={xMid + capHalf}
                            y1={sy(v + error)}
                            y2={sy(v + error)}
                          />
                        </g>
                      ) : null}
                      {letter ? (
                        <text
                          data-chart-letter
                          x={xMid}
                          y={letterY}
                          textAnchor="middle"
                          fill="#27272a"
                          style={{ fontSize: letterSize, fontWeight: 600 }}
                        >
                          {letter}
                        </text>
                      ) : null}
                    </g>
                  );
                })
              )}
        {minV < 0 ? (
          <line
            x1={padL}
            x2={padL + plotW}
            y1={yZero}
            y2={yZero}
            stroke="#a1a1aa"
            strokeWidth={1}
          />
        ) : null}
        <AxisFrame
          layout={layout}
          yTicks={yTicks}
          yFormatter={v => formatNumberTick(v, ySamples)}
          xAxisLabel={chart.x_label}
          yAxisLabel={chart.y_label}
          categoryLabels={{ labels: displayLabels, xs, plan }}
        />
        <g transform={`translate(${padL + plotW + 10} ${padT + 4})`}>
          {series.map((ser, si) => (
            <g key={ser.name} transform={`translate(0 ${si * (layout.fontSize + 4)})`}>
              <rect width={8} height={8} fill={seriesFill[si % seriesFill.length]} rx={1} />
              <text x={12} y={7} fill="#52525b" style={{ fontSize: layout.fontSize }}>
                {truncateLabel(ser.name, legendMax)}
              </text>
            </g>
          ))}
        </g>
        {footnoteLines.map((line, index) => (
          <text
            key={line}
            data-chart-footnote
            x={padL}
            y={layout.height + 2 + (index + 1) * footnoteLineH}
            fill="#71717a"
            style={{ fontSize: layout.fontSize }}
          >
            {line}
          </text>
        ))}
      </svg>
    );
  }

  if (chart.kind === 'sankey') {
    const layout = baseLayout;
    const SK_W = layout.width;
    const SK_H = Math.max(layout.height, layout.density === 'comfortable' ? 320 : 240);
    const SK_PL = layout.density === 'comfortable' ? 72 : 56;
    const SK_PR = SK_PL;
    const SK_PT = layout.titleSize + (layout.density === 'comfortable' ? 28 : 20);
    const SK_PB = 16;
    const nodeW = layout.density === 'comfortable' ? 10 : 8;
    const gap = 8;
    const plotH = Math.max(40, SK_H - SK_PT - SK_PB);
    const leftX = SK_PL;
    const rightX = SK_W - SK_PR - nodeW;
    const nodes = chart.nodes || [];
    const links = (chart.links || []).filter(link => link.value > 0);
    const leftIds = nodes.filter(node => node.id.startsWith('s:')).map(node => node.id);
    const rightIds = nodes.filter(node => node.id.startsWith('t:')).map(node => node.id);
    const nameById = new Map(nodes.map(node => [node.id, node.name]));
    const outFlow = new Map<string, number>();
    const inFlow = new Map<string, number>();
    for (const link of links) {
      outFlow.set(link.source, (outFlow.get(link.source) ?? 0) + link.value);
      inFlow.set(link.target, (inFlow.get(link.target) ?? 0) + link.value);
    }
    const leftTotal = leftIds.reduce((sum, id) => sum + (outFlow.get(id) ?? 0), 0) || 1;
    const rightTotal = rightIds.reduce((sum, id) => sum + (inFlow.get(id) ?? 0), 0) || 1;
    const leftGaps = Math.max(0, leftIds.length - 1) * gap;
    const rightGaps = Math.max(0, rightIds.length - 1) * gap;
    const leftScale = (plotH - leftGaps) / leftTotal;
    const rightScale = (plotH - rightGaps) / rightTotal;
    type Band = { y0: number; y1: number };
    const leftBand = new Map<string, Band>();
    const rightBand = new Map<string, Band>();
    let leftCursor = SK_PT;
    for (const id of leftIds) {
      const height = (outFlow.get(id) ?? 0) * leftScale;
      leftBand.set(id, { y0: leftCursor, y1: leftCursor + height });
      leftCursor += height + gap;
    }
    let rightCursor = SK_PT;
    for (const id of rightIds) {
      const height = (inFlow.get(id) ?? 0) * rightScale;
      rightBand.set(id, { y0: rightCursor, y1: rightCursor + height });
      rightCursor += height + gap;
    }
    const leftOffset = new Map<string, number>();
    const rightOffset = new Map<string, number>();
    const linkPaths = links.flatMap((link, index) => {
      const source = leftBand.get(link.source);
      const target = rightBand.get(link.target);
      if (!source || !target) return [];
      const sourceH = Math.max(1, link.value * leftScale);
      const targetH = Math.max(1, link.value * rightScale);
      const sy0 = source.y0 + (leftOffset.get(link.source) ?? 0);
      const ty0 = target.y0 + (rightOffset.get(link.target) ?? 0);
      leftOffset.set(link.source, (leftOffset.get(link.source) ?? 0) + sourceH);
      rightOffset.set(link.target, (rightOffset.get(link.target) ?? 0) + targetH);
      const x0 = leftX + nodeW;
      const x1 = rightX;
      const mid = (x0 + x1) / 2;
      const d = [
        `M ${x0} ${sy0}`,
        `C ${mid} ${sy0}, ${mid} ${ty0}, ${x1} ${ty0}`,
        `L ${x1} ${ty0 + targetH}`,
        `C ${mid} ${ty0 + targetH}, ${mid} ${sy0 + sourceH}, ${x0} ${sy0 + sourceH}`,
        'Z',
      ].join(' ');
      return [
        {
          d,
          color: seriesFill[index % seriesFill.length],
          key: `${link.source}-${link.target}-${index}`,
        },
      ];
    });
    const labelChars = layout.density === 'comfortable' ? 16 : 12;
    const formatFlow = (value: number) =>
      Number.isInteger(value) ? String(value) : value.toFixed(1);

    return (
      <svg
        data-chart-kind="sankey"
        viewBox={`0 0 ${SK_W} ${SK_H}`}
        className="h-auto w-full max-w-full"
        aria-hidden
      >
        <ChartTitle layout={{ ...layout, width: SK_W, height: SK_H }} title={chart.title} />
        {linkPaths.map(link => (
          <path key={link.key} d={link.d} fill={link.color} fillOpacity={0.45} stroke="none" />
        ))}
        {leftIds.map((id, index) => {
          const band = leftBand.get(id);
          if (!band) return null;
          return (
            <g key={id}>
              <rect
                x={leftX}
                y={band.y0}
                width={nodeW}
                height={Math.max(1, band.y1 - band.y0)}
                fill={seriesFill[index % seriesFill.length]}
                rx={1}
              />
              <text
                x={leftX - 6}
                y={(band.y0 + band.y1) / 2 + layout.fontSize * 0.35}
                textAnchor="end"
                fill="#3f3f46"
                style={{ fontSize: layout.fontSize }}
              >
                {truncateLabel(nameById.get(id) || id, labelChars)}
              </text>
            </g>
          );
        })}
        {rightIds.map((id, index) => {
          const band = rightBand.get(id);
          if (!band) return null;
          const value = inFlow.get(id) ?? 0;
          return (
            <g key={id}>
              <rect
                x={rightX}
                y={band.y0}
                width={nodeW}
                height={Math.max(1, band.y1 - band.y0)}
                fill={seriesFill[index % seriesFill.length]}
                rx={1}
              />
              <text
                x={rightX + nodeW + 6}
                y={(band.y0 + band.y1) / 2 + layout.fontSize * 0.35}
                textAnchor="start"
                fill="#3f3f46"
                style={{ fontSize: layout.fontSize }}
              >
                {`${truncateLabel(nameById.get(id) || id, labelChars)} (${formatFlow(value)})`}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  if (chart.kind === 'path_diagram') {
    const layout = baseLayout;
    const PD_W = layout.width;
    const PD_H = Math.max(layout.height, layout.density === 'comfortable' ? 320 : 240);
    const PD_PL = layout.density === 'comfortable' ? 36 : 24;
    const PD_PR = PD_PL;
    const PD_PT = layout.density === 'comfortable' ? 36 : 28;
    const PD_PB = 16;
    const plotWpd = PD_W - PD_PL - PD_PR;
    const plotHpd = PD_H - PD_PT - PD_PB;
    const nodePos = new Map<string, { cx: number; cy: number }>();
    for (const n of chart.nodes) {
      nodePos.set(n.id, {
        cx: PD_PL + n.x * plotWpd,
        cy: PD_PT + n.y * plotHpd,
      });
    }
    const nodeR = layout.density === 'comfortable' ? 22 : 18;
    const latentR = layout.density === 'comfortable' ? 26 : 22;
    const labelChars = layout.density === 'comfortable' ? 18 : 10;

    return (
      <svg
        data-chart-kind={chart.kind}
        viewBox={`0 0 ${PD_W} ${PD_H}`}
        className="h-auto w-full max-w-full"
        aria-hidden
      >
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" className="fill-zinc-400" />
          </marker>
        </defs>
        <text
          x={PD_PL}
          y={layout.titleSize + 2}
          fill="#3f3f46"
          style={{ fontSize: layout.titleSize, fontWeight: 500 }}
        >
          {chart.title}
        </text>
        {chart.edges.map((e, i) => {
          const from = nodePos.get(e.from);
          const to = nodePos.get(e.to);
          if (!from || !to) return null;
          const mx = (from.cx + to.cx) / 2;
          const my = (from.cy + to.cy) / 2 - 8;
          return (
            <g key={`${e.from}-${e.to}-${i}`}>
              <line
                x1={from.cx}
                y1={from.cy}
                x2={to.cx}
                y2={to.cy}
                className="stroke-zinc-400"
                strokeWidth={1.5}
                markerEnd="url(#arrow)"
              />
              {e.label ? (
                <text
                  x={mx}
                  y={my}
                  textAnchor="middle"
                  fill="#52525b"
                  style={{ fontSize: layout.fontSize }}
                >
                  {e.label}
                </text>
              ) : null}
            </g>
          );
        })}
        {chart.nodes.map(n => {
          const p = nodePos.get(n.id)!;
          const isLatent = n.kind === 'latent';
          const r = isLatent ? latentR : nodeR;
          return (
            <g key={n.id}>
              {isLatent ? (
                <ellipse
                  cx={p.cx}
                  cy={p.cy}
                  rx={r + 4}
                  ry={r - 4}
                  className="fill-violet-50 stroke-violet-400"
                  strokeWidth={1.5}
                />
              ) : (
                <rect
                  x={p.cx - r}
                  y={p.cy - r + 4}
                  width={r * 2}
                  height={r * 1.4}
                  rx={2}
                  className="fill-zinc-100 stroke-zinc-400"
                  strokeWidth={1.5}
                />
              )}
              <text
                x={p.cx}
                y={p.cy + 4}
                textAnchor="middle"
                fill="#3f3f46"
                style={{ fontSize: layout.fontSize }}
              >
                {truncateLabel(n.label, labelChars)}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  if (chart.kind === 'pie' || chart.kind === 'donut') {
    const layout = baseLayout;
    const isDonut = chart.kind === 'donut';
    const total = chart.values.reduce((sum, value) => sum + Math.max(0, value), 0);
    const cx = layout.padL + layout.plotW / 2;
    const cy = layout.padT + layout.plotH / 2;
    const r = Math.max(8, Math.min(layout.plotW, layout.plotH) / 2 - 8);
    const innerR = isDonut ? r * 0.55 : 0;
    const hasLetters = (chart.letters || []).some(letter => String(letter || '').trim());
    const footnoteLines = chartFootnoteLines(chart);
    const footnoteLineH = layout.fontSize + 4;
    const footnoteH = footnoteLines.length ? footnoteLines.length * footnoteLineH + 6 : 0;
    let angle = -Math.PI / 2;
    const slices = chart.categories.map((label, i) => {
      const value = Math.max(0, chart.values[i] ?? 0);
      const sweep = total > 0 ? (value / total) * Math.PI * 2 : 0;
      const start = angle;
      angle += sweep;
      const large = sweep > Math.PI ? 1 : 0;
      const x1 = cx + r * Math.cos(start);
      const y1 = cy + r * Math.sin(start);
      const x2 = cx + r * Math.cos(start + sweep);
      const y2 = cy + r * Math.sin(start + sweep);
      const ix1 = cx + innerR * Math.cos(start + sweep);
      const iy1 = cy + innerR * Math.sin(start + sweep);
      const ix2 = cx + innerR * Math.cos(start);
      const iy2 = cy + innerR * Math.sin(start);
      const mid = start + sweep / 2;
      const letter = String(chart.letters?.[i] || '').trim();
      const labelR = isDonut ? (r + innerR) / 2 : r + 14;
      const d =
        sweep <= 0
          ? ''
          : isDonut
            ? sweep >= Math.PI * 2 - 0.0001
              ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} ` +
                `L ${cx - 0.01} ${cy - innerR} A ${innerR} ${innerR} 0 1 0 ${cx} ${cy - innerR} Z`
              : `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} ` +
                `L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${large} 0 ${ix2} ${iy2} Z`
            : sweep >= Math.PI * 2 - 0.0001
              ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
              : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
      return {
        d,
        label,
        fill: seriesFill[i % seriesFill.length],
        letter,
        lx: cx + labelR * Math.cos(mid),
        ly: cy + labelR * Math.sin(mid),
      };
    });
    return (
      <svg
        data-chart-kind={chart.kind}
        data-significance={hasLetters ? 'on' : undefined}
        viewBox={`0 0 ${layout.width} ${layout.height + footnoteH}`}
        className="h-auto w-full max-w-full"
        aria-hidden
      >
        <ChartTitle layout={layout} title={chart.title} />
        {slices.map((slice, i) =>
          slice.d ? <path key={`${slice.label}-${i}`} d={slice.d} fill={slice.fill} /> : null
        )}
        {slices.map((slice, i) =>
          slice.letter ? (
            <text
              key={`letter-${slice.label}-${i}`}
              data-chart-letter
              x={slice.lx}
              y={slice.ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#27272a"
              style={{ fontSize: Math.max(9, layout.fontSize - 1), fontWeight: 600 }}
            >
              {slice.letter}
            </text>
          ) : null
        )}
        {footnoteLines.map((line, index) => (
          <text
            key={line}
            data-chart-footnote
            x={layout.padL}
            y={layout.height + 2 + (index + 1) * footnoteLineH}
            fill="#71717a"
            style={{ fontSize: layout.fontSize }}
          >
            {line}
          </text>
        ))}
      </svg>
    );
  }

  if (chart.kind === 'density') {
    const series = chart.series || [];
    const xs = series.flatMap(item => item.points.map(point => point.x));
    const ys = series.flatMap(item => item.points.map(point => point.y));
    const x0 = xs.length ? Math.min(...xs) : 0;
    const x1 = xs.length ? Math.max(...xs) : 1;
    const y1 = ys.length ? Math.max(...ys) : 1;
    const layout = baseLayout;
    const sx = scaleLinear(x0, x1 || 1, layout.padL, layout.padL + layout.plotW);
    const sy = scaleLinear(0, y1 || 1, layout.padT + layout.plotH, layout.padT);
    return (
      <svg
        data-chart-kind="density"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="h-auto w-full max-w-full"
        aria-hidden
      >
        <ChartTitle layout={layout} title={chart.title} />
        {series.map((item, index) => (
          <polyline
            key={item.name}
            fill="none"
            stroke={seriesFill[index % seriesFill.length]}
            strokeWidth={2}
            points={item.points.map(point => `${sx(point.x)},${sy(point.y)}`).join(' ')}
          />
        ))}
        <AxisFrame
          layout={layout}
          xTicks={ticksInDomain(x0, x1 || 1, layout.maxTicksX).map(value => ({
            value,
            x: sx(value),
          }))}
          yTicks={ticksInDomain(0, y1 || 1, layout.maxTicksY).map(value => ({
            value,
            y: sy(value),
          }))}
          xFormatter={value => formatNumberTick(value, xs.length ? xs : [0, 1])}
          yFormatter={value => formatNumberTick(value, ys.length ? ys : [0, 1])}
          xAxisLabel={chart.x_label}
          yAxisLabel={chart.y_label}
        />
      </svg>
    );
  }

  if (chart.kind === 'violin') {
    const groups = chart.groups || [];
    const ys = groups.flatMap(group => [
      group.min,
      group.max,
      ...group.density.map(point => point.y),
    ]);
    const y0 = ys.length ? Math.min(...ys) : 0;
    const y1 = ys.length ? Math.max(...ys) : 1;
    const labels = groups.map(group => group.label);
    const slot = baseLayout.plotW / Math.max(1, groups.length);
    const xs = groups.map((_, index) => baseLayout.padL + index * slot + slot / 2);
    const plan = planCategoryLabels(
      labels,
      slot,
      baseLayout.fontSize,
      baseLayout.density,
      baseLayout.padB
    );
    const layout = withExtraPadB(baseLayout, plan.padB);
    const sy = scaleLinear(y0, y1 || 1, layout.padT + layout.plotH, layout.padT);
    return (
      <svg
        data-chart-kind="violin"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="h-auto w-full max-w-full"
        aria-hidden
      >
        <ChartTitle layout={layout} title={chart.title} />
        {groups.map((group, index) => {
          const cx = layout.padL + index * slot + slot / 2;
          const maxWidth = group.density.reduce((max, point) => Math.max(max, point.width), 0) || 1;
          const half = slot * 0.35;
          const right = group.density.map(
            point => `${cx + (point.width / maxWidth) * half},${sy(point.y)}`
          );
          const left = [...group.density]
            .reverse()
            .map(point => `${cx - (point.width / maxWidth) * half},${sy(point.y)}`);
          return (
            <g key={group.label}>
              <polygon
                points={[...right, ...left].join(' ')}
                fill={seriesFill[index % seriesFill.length]}
                fillOpacity={0.35}
              />
              <line
                x1={cx - 8}
                x2={cx + 8}
                y1={sy(group.median)}
                y2={sy(group.median)}
                stroke="#18181b"
                strokeWidth={1.5}
              />
            </g>
          );
        })}
        <AxisFrame
          layout={layout}
          yTicks={ticksInDomain(y0, y1 || 1, layout.maxTicksY).map(value => ({
            value,
            y: sy(value),
          }))}
          yFormatter={value => formatNumberTick(value, ys.length ? ys : [0, 1])}
          yAxisLabel={chart.y_label}
          categoryLabels={{ labels, xs, plan }}
        />
      </svg>
    );
  }

  return (
    <svg
      data-chart-kind={chart.kind}
      viewBox={`0 0 ${baseLayout.width} ${baseLayout.height}`}
      className="h-auto w-full max-w-full"
      aria-hidden
    >
      <ChartTitle layout={baseLayout} title={chart.title} />
    </svg>
  );
}

export function ReportChart({
  chart,
  density = 'inline',
  className,
  preset = 'default',
  seriesColors,
  figureNumber = 1,
  note = 'Axes are labelled in the units of the plotted variables.',
}: ReportChartProps) {
  const wrapRef = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0);
      if (w > 0) setWidth(prev => (prev === w ? prev : w));
    });
    ro.observe(el);
    const initial = Math.round(el.clientWidth);
    if (initial > 0) setWidth(initial);
    return () => ro.disconnect();
  }, []);

  const layout = computeLayout(density, width);
  const seriesFill = resolveSeriesColors(preset, null, seriesColors);

  const apa = preset === 'apa';

  return (
    <figure
      ref={wrapRef}
      className={className ?? 'w-full'}
      data-chart-preset={preset}
      style={
        apa ? { fontFamily: 'Arial, Helvetica, sans-serif', filter: 'grayscale(1)' } : undefined
      }
    >
      {apa ? (
        <>
          <p className="text-sm font-bold">Figure {figureNumber}</p>
          {chart.title ? <p className="text-sm italic">{chart.title}</p> : null}
        </>
      ) : null}
      <ChartBody chart={chart} layout={layout} seriesFill={seriesFill} />
      {apa ? <figcaption className="text-xs">Note. {note}</figcaption> : null}
    </figure>
  );
}
