'use client';

import { useEffect, useRef, useState } from 'react';
import type { AnalysisReportChart, ChartAxisScale } from '@/lib/analysis-report-types';
import {
  type ChartDensity,
  type ChartLayout,
  computeLayout,
  formatDateTick,
  formatNumberTick,
  inferDateResolution,
  niceTicks,
  parseAxisDate,
  planCategoryLabels,
  scaleLinear,
  truncateLabel,
  valuesLookLikeDatetime,
  withExtraPadB,
} from '@/utils/chart-axis';

const SERIES_FILL = ['#71717a', '#a1a1aa', '#6366f1', '#78716c', '#8b5cf6'];

export type ReportChartProps = {
  chart: AnalysisReportChart;
  /** inline = chat/card; comfortable = fullscreen (and preferred export source). */
  density?: ChartDensity;
  className?: string;
  /** `default` keeps the current palette. `apa` is greyscale, sans-serif, with a figure caption. */
  preset?: 'default' | 'apa';
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
  return (
    <text
      x={layout.padL}
      y={layout.titleSize + 2}
      fill="#3f3f46"
      style={{ fontSize: layout.titleSize, fontWeight: 500 }}
    >
      {title}
    </text>
  );
}

function ChartBody({
  chart,
  layout: baseLayout,
}: {
  chart: AnalysisReportChart;
  layout: ChartLayout;
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
    const xTicks = niceTicks(xMin, xMax, layout.maxTicksX).map(v => ({
      value: v,
      x: padL + ((v - xMin) / (xMax - xMin || 1)) * plotW,
    }));
    const yTicks = niceTicks(0, maxC, layout.maxTicksY).map(v => ({
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
          xFormatter={v => formatAxisValue(v, xScale, xSamples, xDates)}
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
    const xTicks = niceTicks(x0, x1, layout.maxTicksX).map(v => ({ value: v, x: sx(v) }));
    const yTicks = niceTicks(y0, y1, layout.maxTicksY).map(v => ({ value: v, y: sy(v) }));
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
    const padX = (x1 - x0) * 0.06 || 0.5;
    const padY = (y1 - y0) * 0.06 || 0.5;
    x0 -= padX;
    x1 += padX;
    y0 -= padY;
    y1 += padY;
    const xScale = resolveNumericScale(chart.x_scale, xs);
    const yScale = resolveNumericScale(chart.y_scale, ys);
    const xDates = xs.map(parseAxisDate).filter((d): d is Date => d != null);
    const yDates = ys.map(parseAxisDate).filter((d): d is Date => d != null);
    const layout = baseLayout;
    const { padL, padT, plotW, plotH } = layout;
    const sx = scaleLinear(x0, x1, padL, padL + plotW);
    const sy = scaleLinear(y0, y1, padT + plotH, padT);
    const line = chart.kind === 'scatter' ? null : chart.line;
    const xTicks = niceTicks(x0, x1, layout.maxTicksX).map(v => ({ value: v, x: sx(v) }));
    const yTicks = niceTicks(y0, y1, layout.maxTicksY).map(v => ({ value: v, y: sy(v) }));

    return (
      <svg
        data-chart-kind={chart.kind}
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
              r={layout.density === 'comfortable' ? 3 : 2.2}
              className="fill-zinc-600/80"
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
          xFormatter={v => formatAxisValue(v, xScale, xs, xDates)}
          yFormatter={v => formatAxisValue(v, yScale, ys, yDates)}
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
    const yTicks = niceTicks(d0, d1, layout.maxTicksY).map(v => ({ value: v, y: sy(v) }));
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

  if (
    chart.kind === 'bar_grouped' ||
    chart.kind === 'line' ||
    chart.kind === 'bar' ||
    chart.kind === 'area'
  ) {
    const { categories, series } = chart;
    const ySamples = series.flatMap(s =>
      s.values.flatMap((value, index) => {
        const error = s.errors?.[index];
        return error ? [value - error, value, value + error] : [value];
      })
    );
    const dataMin = ySamples.length ? Math.min(...ySamples) : 0;
    const dataMax = ySamples.length ? Math.max(...ySamples) : 1;
    const minV = Math.min(0, dataMin);
    const maxV = Math.max(dataMax, minV === 0 ? 1 : 0);
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
    const barW = inner / Math.max(1, ns);
    const gap = groupW * 0.06;
    const isArea = chart.kind === 'area';
    const isLine = chart.kind === 'line' || isArea;
    const yTicks = niceTicks(minV, maxV, layout.maxTicksY).map(v => ({ value: v, y: sy(v) }));
    const xs = categories.map((_, i) => padL + i * groupW + groupW / 2);

    return (
      <svg
        data-chart-kind={chart.kind}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
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
              const color = SERIES_FILL[si % SERIES_FILL.length];
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
                    return (
                      <g key={`${ser.name}-${gi}`}>
                        {error ? (
                          <line
                            x1={xs[gi]}
                            x2={xs[gi]}
                            y1={sy(v - error)}
                            y2={sy(v + error)}
                            stroke={color}
                            strokeWidth={1.2}
                          />
                        ) : null}
                        <circle
                          cx={xs[gi]}
                          cy={sy(v)}
                          r={layout.density === 'comfortable' ? 3.2 : 2.5}
                          fill={SERIES_FILL[si % SERIES_FILL.length]}
                        />
                      </g>
                    );
                  })}
                </g>
              );
            })
          : categories.flatMap((_, gi) =>
              series.map((ser, si) => {
                const v = ser.values[gi] ?? 0;
                const x = padL + gi * groupW + gap + si * barW;
                const yVal = sy(v);
                const y = Math.min(yZero, yVal);
                const error = ser.errors?.[gi];
                const xMid = x + barW / 2;
                return (
                  <g key={`${gi}-${si}`}>
                    {error ? (
                      <line
                        x1={xMid}
                        x2={xMid}
                        y1={sy(v - error)}
                        y2={sy(v + error)}
                        stroke="#27272a"
                        strokeWidth={1.2}
                      />
                    ) : null}
                    <rect
                      x={x}
                      y={y}
                      width={Math.max(1, barW - 1)}
                      height={Math.max(0, Math.abs(yZero - yVal))}
                      fill={SERIES_FILL[si % SERIES_FILL.length]}
                      rx={1}
                    />
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
              <rect width={8} height={8} fill={SERIES_FILL[si % SERIES_FILL.length]} rx={1} />
              <text x={12} y={7} fill="#52525b" style={{ fontSize: layout.fontSize }}>
                {truncateLabel(ser.name, legendMax)}
              </text>
            </g>
          ))}
        </g>
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

  if (chart.kind === 'pie') {
    const layout = baseLayout;
    const total = chart.values.reduce((sum, value) => sum + Math.max(0, value), 0);
    const cx = layout.padL + layout.plotW / 2;
    const cy = layout.padT + layout.plotH / 2;
    const r = Math.max(8, Math.min(layout.plotW, layout.plotH) / 2 - 8);
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
      const d =
        sweep <= 0
          ? ''
          : sweep >= Math.PI * 2 - 0.0001
            ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
            : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
      return { d, label, fill: SERIES_FILL[i % SERIES_FILL.length] };
    });
    return (
      <svg
        data-chart-kind="pie"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="h-auto w-full max-w-full"
        aria-hidden
      >
        <ChartTitle layout={layout} title={chart.title} />
        {slices.map((slice, i) =>
          slice.d ? <path key={`${slice.label}-${i}`} d={slice.d} fill={slice.fill} /> : null
        )}
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
            stroke={SERIES_FILL[index % SERIES_FILL.length]}
            strokeWidth={2}
            points={item.points.map(point => `${sx(point.x)},${sy(point.y)}`).join(' ')}
          />
        ))}
        <AxisFrame
          layout={layout}
          xTicks={niceTicks(x0, x1 || 1, layout.maxTicksX).map(value => ({ value, x: sx(value) }))}
          yTicks={niceTicks(0, y1 || 1, layout.maxTicksY).map(value => ({ value, y: sy(value) }))}
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
                fill={SERIES_FILL[index % SERIES_FILL.length]}
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
          yTicks={niceTicks(y0, y1 || 1, layout.maxTicksY).map(value => ({ value, y: sy(value) }))}
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
  figureNumber = 1,
  note = 'Axes are labelled in the units of the plotted variables.',
}: ReportChartProps) {
  const wrapRef = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth(w);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const layout = computeLayout(density, width);

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
      <ChartBody chart={chart} layout={layout} />
      {apa ? <figcaption className="text-xs">Note. {note}</figcaption> : null}
    </figure>
  );
}
