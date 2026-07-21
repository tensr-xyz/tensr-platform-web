'use client';

import type { AnalysisReportChart } from '@/lib/analysis-report-types';

const W = 420;
const H = 200;
const PL = 52;
const PR = 14;
const PT = 18;
const PB = 42;

function scaleLinear(
  d0: number,
  d1: number,
  r0: number,
  r1: number,
  clamp = true
): (v: number) => number {
  if (d1 === d0) {
    return () => (r0 + r1) / 2;
  }
  return (v: number) => {
    let t = (v - d0) / (d1 - d0);
    if (clamp) t = Math.max(0, Math.min(1, t));
    return r0 + t * (r1 - r0);
  };
}

function shortLabel(s: string, max = 10): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

const SERIES_FILL = ['#71717a', '#a1a1aa', '#6366f1', '#78716c', '#8b5cf6'];

type Props = { chart: AnalysisReportChart };

export function ReportChart({ chart }: Props) {
  const plotW = W - PL - PR;
  const plotH = H - PT - PB;

  if (chart.kind === 'histogram') {
    const maxC = Math.max(1, ...chart.bins.map(b => b.count));
    const n = chart.bins.length || 1;
    const gap = 2;
    const barW = Math.max(1, (plotW - gap * (n - 1)) / n);
    const yS = scaleLinear(0, maxC, PT + plotH, PT);
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-full text-zinc-500" aria-hidden>
        <text x={PL} y={12} className="fill-zinc-700 text-[11px] font-medium">
          {chart.title}
        </text>
        {chart.bins.map((b, i) => {
          const h = PT + plotH - yS(b.count);
          const x = PL + i * (barW + gap);
          return (
            <rect
              key={i}
              x={x}
              y={yS(b.count)}
              width={barW}
              height={Math.max(0, h)}
              className="fill-zinc-300"
              rx={1}
            />
          );
        })}
        <text x={W / 2} y={H - 10} textAnchor="middle" className="fill-zinc-500 text-[9px]">
          {shortLabel(chart.x_label, 36)}
        </text>
        <line
          x1={PL}
          y1={PT + plotH}
          x2={PL + plotW}
          y2={PT + plotH}
          className="stroke-zinc-200"
          strokeWidth={1}
        />
        <line x1={PL} y1={PT} x2={PL} y2={PT + plotH} className="stroke-zinc-200" strokeWidth={1} />
      </svg>
    );
  }

  if (chart.kind === 'scatter' || chart.kind === 'scatter_line') {
    const pts = chart.points;
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
    const sx = scaleLinear(x0, x1, PL, PL + plotW);
    const sy = scaleLinear(y0, y1, PT + plotH, PT);
    const line = chart.kind === 'scatter_line' ? chart.line : null;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-full" aria-hidden>
        <text x={PL} y={12} className="fill-zinc-700 text-[11px] font-medium">
          {chart.title}
        </text>
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
          <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={2.2} className="fill-zinc-600/80" />
        ))}
        <line
          x1={PL}
          y1={PT + plotH}
          x2={PL + plotW}
          y2={PT + plotH}
          className="stroke-zinc-200"
          strokeWidth={1}
        />
        <line x1={PL} y1={PT} x2={PL} y2={PT + plotH} className="stroke-zinc-200" strokeWidth={1} />
        <text
          x={(PL + PL + plotW) / 2}
          y={H - 22}
          textAnchor="middle"
          className="fill-zinc-500 text-[9px]"
        >
          {shortLabel(chart.x_label, 32)}
        </text>
        <text
          x={12}
          y={PT + plotH / 2}
          textAnchor="middle"
          transform={`rotate(-90 12 ${PT + plotH / 2})`}
          className="fill-zinc-500 text-[9px]"
        >
          {shortLabel(chart.y_label, 28)}
        </text>
      </svg>
    );
  }

  if (chart.kind === 'boxplot') {
    const gs = chart.groups;
    const yMin = Math.min(...gs.map(g => g.min));
    const yMax = Math.max(...gs.map(g => g.max));
    const pad = (yMax - yMin) * 0.08 || 0.5;
    const d0 = yMin - pad;
    const d1 = yMax + pad;
    const sy = scaleLinear(d0, d1, PT + plotH, PT);
    const n = gs.length;
    const slot = plotW / n;
    const boxW = Math.min(28, slot * 0.55);
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-full" aria-hidden>
        <text x={PL} y={12} className="fill-zinc-700 text-[11px] font-medium">
          {chart.title}
        </text>
        {gs.map((g, i) => {
          const cx = PL + i * slot + slot / 2;
          const xL = cx - boxW / 2;
          const yMinPx = sy(g.min);
          const yQ1 = sy(g.q1);
          const yMed = sy(g.median);
          const yQ3 = sy(g.q3);
          const yMaxPx = sy(g.max);
          return (
            <g key={g.label}>
              <line
                x1={cx}
                y1={yMinPx}
                x2={cx}
                y2={yMaxPx}
                className="stroke-zinc-400"
                strokeWidth={1.5}
              />
              <line
                x1={cx - boxW / 4}
                y1={yMinPx}
                x2={cx + boxW / 4}
                y2={yMinPx}
                className="stroke-zinc-500"
                strokeWidth={1.5}
              />
              <line
                x1={cx - boxW / 4}
                y1={yMaxPx}
                x2={cx + boxW / 4}
                y2={yMaxPx}
                className="stroke-zinc-500"
                strokeWidth={1.5}
              />
              <rect
                x={xL}
                y={yQ3}
                width={boxW}
                height={Math.max(1, yQ1 - yQ3)}
                className="fill-zinc-200 stroke-zinc-400"
                strokeWidth={1}
              />
              <line
                x1={xL}
                y1={yMed}
                x2={xL + boxW}
                y2={yMed}
                className="stroke-zinc-800"
                strokeWidth={1.5}
              />
            </g>
          );
        })}
        <line
          x1={PL}
          y1={PT + plotH}
          x2={PL + plotW}
          y2={PT + plotH}
          className="stroke-zinc-200"
          strokeWidth={1}
        />
        <line x1={PL} y1={PT} x2={PL} y2={PT + plotH} className="stroke-zinc-200" strokeWidth={1} />
        {gs.map((g, i) => {
          const cx = PL + i * slot + slot / 2;
          return (
            <text
              key={`l-${g.label}`}
              x={cx}
              y={H - 12}
              textAnchor="middle"
              className="fill-zinc-500 text-[8px]"
            >
              {shortLabel(g.label, 8)}
            </text>
          );
        })}
        <text
          x={10}
          y={PT + plotH / 2}
          textAnchor="middle"
          transform={`rotate(-90 10 ${PT + plotH / 2})`}
          className="fill-zinc-500 text-[9px]"
        >
          {shortLabel(chart.y_label, 28)}
        </text>
      </svg>
    );
  }

  if (chart.kind === 'bar_grouped' || chart.kind === 'line') {
    const { categories, series } = chart;
    const maxV = Math.max(1, ...series.flatMap(s => s.values));
    const sy = scaleLinear(0, maxV, PT + plotH, PT);
    const ng = categories.length;
    const ns = series.length;
    const groupW = plotW / Math.max(1, ng);
    const inner = groupW * 0.88;
    const barW = inner / Math.max(1, ns);
    const gap = groupW * 0.06;
    const isLine = chart.kind === 'line';
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-full" aria-hidden>
        <text x={PL} y={12} className="fill-zinc-700 text-[11px] font-medium">
          {chart.title}
        </text>
        {isLine
          ? series.map((ser, si) => {
              const pts = categories
                .map((_, gi) => {
                  const v = ser.values[gi] ?? 0;
                  const x = PL + gi * groupW + groupW / 2;
                  const y = sy(v);
                  return `${x},${y}`;
                })
                .join(' ');
              return (
                <g key={ser.name}>
                  <polyline
                    points={pts}
                    fill="none"
                    stroke={SERIES_FILL[si % SERIES_FILL.length]}
                    strokeWidth={2}
                  />
                  {categories.map((_, gi) => {
                    const v = ser.values[gi] ?? 0;
                    const x = PL + gi * groupW + groupW / 2;
                    const y = sy(v);
                    return (
                      <circle
                        key={`${ser.name}-${gi}`}
                        cx={x}
                        cy={y}
                        r={2.5}
                        fill={SERIES_FILL[si % SERIES_FILL.length]}
                      />
                    );
                  })}
                </g>
              );
            })
          : categories.flatMap((_, gi) =>
              series.map((ser, si) => {
                const v = ser.values[gi] ?? 0;
                const x = PL + gi * groupW + gap + si * barW;
                const yTop = sy(v);
                const h = PT + plotH - yTop;
                return (
                  <rect
                    key={`${gi}-${si}`}
                    x={x}
                    y={yTop}
                    width={Math.max(1, barW - 1)}
                    height={Math.max(0, h)}
                    fill={SERIES_FILL[si % SERIES_FILL.length]}
                    rx={1}
                  />
                );
              })
            )}
        <line
          x1={PL}
          y1={PT + plotH}
          x2={PL + plotW}
          y2={PT + plotH}
          className="stroke-zinc-200"
          strokeWidth={1}
        />
        <line x1={PL} y1={PT} x2={PL} y2={PT + plotH} className="stroke-zinc-200" strokeWidth={1} />
        {categories.map((c, i) => {
          const cx = PL + i * groupW + groupW / 2;
          return (
            <text
              key={c}
              x={cx}
              y={H - 14}
              textAnchor="middle"
              className="fill-zinc-500 text-[8px]"
            >
              {shortLabel(c, 7)}
            </text>
          );
        })}
        <text
          x={(PL + PL + plotW) / 2}
          y={H - 2}
          textAnchor="middle"
          className="fill-zinc-400 text-[8px]"
        >
          {shortLabel(chart.x_label, 28)}
        </text>
        <g transform={`translate(${PL + plotW - 4} ${PT + 4})`}>
          {series.map((ser, si) => (
            <g key={ser.name} transform={`translate(0 ${si * 12})`}>
              <rect width={8} height={8} fill={SERIES_FILL[si % SERIES_FILL.length]} rx={1} />
              <text x={12} y={7} className="fill-zinc-600 text-[8px]">
                {shortLabel(ser.name, 14)}
              </text>
            </g>
          ))}
        </g>
      </svg>
    );
  }

  if (chart.kind === 'path_diagram') {
    const PD_W = 420;
    const PD_H = 240;
    const PD_PL = 24;
    const PD_PR = 24;
    const PD_PT = 28;
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
    const nodeR = 18;
    const latentR = 22;
    return (
      <svg viewBox={`0 0 ${PD_W} ${PD_H}`} className="h-auto w-full max-w-full" aria-hidden>
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" className="fill-zinc-400" />
          </marker>
        </defs>
        <text x={PD_PL} y={14} className="fill-zinc-700 text-[11px] font-medium">
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
                <text x={mx} y={my} textAnchor="middle" className="fill-zinc-600 text-[8px]">
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
              <text x={p.cx} y={p.cy + 4} textAnchor="middle" className="fill-zinc-700 text-[9px]">
                {shortLabel(n.label, 10)}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  return null;
}
