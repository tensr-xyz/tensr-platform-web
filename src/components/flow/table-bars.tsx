'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

const COLORS = ['#1e6b58', '#c4a574', '#3d6b8c', '#8c4a3d', '#6b8f71', '#8a6a9a'];

/** Grouped bars: one cluster per banner column, one colour per stub row. */
export function TableBars({
  series,
  onAddToReport,
}: {
  series: { label: string; values: { name: string; value: number }[] }[];
  onAddToReport?: () => void;
}) {
  const groups = series[0]?.values.map(item => item.name) ?? [];
  const names = series.map(row => row.label);
  const peak = Math.max(1, ...series.flatMap(row => row.values.map(item => item.value)));
  const [added, setAdded] = useState(false);
  const groupWidth = 108;
  const gap = 8;
  const barWidth = Math.max(
    10,
    Math.min(22, (groupWidth - gap * 2) / Math.max(names.length, 1) - 4)
  );
  const plotHeight = 180;
  const width = Math.max(280, groups.length * groupWidth + 24);
  const height = plotHeight + 36;
  return (
    <div className="table-chart">
      <div className="table-chart-head">
        <div className="table-chart-legend">
          {names.map((name, index) => (
            <span key={name}>
              <i style={{ background: COLORS[index % COLORS.length] }} />
              {name}
            </span>
          ))}
        </div>
        {onAddToReport ? (
          <Button
            className="flow-btn"
            type="button"
            onClick={() => {
              onAddToReport();
              setAdded(true);
            }}
          >
            {added ? 'In report' : 'Add to report'}
          </Button>
        ) : null}
      </div>
      <svg
        className="table-chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Grouped bar chart"
      >
        {groups.map((group, groupIndex) => {
          const origin = 12 + groupIndex * groupWidth;
          const cluster = names.length * barWidth + Math.max(0, names.length - 1) * 4;
          const start = origin + (groupWidth - cluster) / 2;
          return (
            <g key={group}>
              {series.map((row, seriesIndex) => {
                const value = row.values.find(item => item.name === group)?.value ?? 0;
                const barHeight = Math.max(value > 0 ? 2 : 0, (value / peak) * (plotHeight - 18));
                const x = start + seriesIndex * (barWidth + 4);
                const y = plotHeight - barHeight;
                const shown = Number.isInteger(value) ? String(value) : value.toFixed(0);
                return (
                  <g key={`${group}-${row.label}`}>
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx={2}
                      fill={COLORS[seriesIndex % COLORS.length]}
                    />
                    <text
                      x={x + barWidth / 2}
                      y={Math.max(12, y - 4)}
                      textAnchor="middle"
                      className="table-chart-value"
                    >
                      {shown}
                    </text>
                  </g>
                );
              })}
              <text
                x={origin + groupWidth / 2}
                y={height - 8}
                textAnchor="middle"
                className="table-chart-label"
              >
                {group}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
