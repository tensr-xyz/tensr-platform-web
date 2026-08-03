'use client';

import type { ReactNode } from 'react';
import { ReportChart } from '@/components/molecules/report-chart';
import type { AnalysisReportChart } from '@/lib/analysis-report-types';

const scatter: AnalysisReportChart = {
  kind: 'scatter',
  title: 'Utilisation vs Headcount',
  x_label: 'Headcount',
  y_label: 'Utilisation rate',
  points: [
    { x: 12, y: 0.42 },
    { x: 18, y: 0.55 },
    { x: 24, y: 0.61 },
    { x: 30, y: 0.48 },
    { x: 36, y: 0.72 },
    { x: 42, y: 0.66 },
    { x: 48, y: 0.81 },
  ],
};

const histogram: AnalysisReportChart = {
  kind: 'histogram',
  title: 'Histogram of Age',
  x_label: 'Age',
  bins: [
    { start: 18, end: 25, count: 4 },
    { start: 25, end: 32, count: 9 },
    { start: 32, end: 39, count: 14 },
    { start: 39, end: 46, count: 7 },
    { start: 46, end: 53, count: 3 },
  ],
};

const longBar: AnalysisReportChart = {
  kind: 'bar_grouped',
  title: 'Mean score by venue entrance',
  x_label: 'Entrance',
  y_label: 'Mean score',
  categories: [
    'Queen Elizabeth Olympic Park East Gate',
    'Victoria Park West Pavilion Entrance',
    'Hackney Wick Canal Towpath Access',
    'Mile End Park Southern Footbridge',
  ],
  series: [{ name: 'Mean score', values: [72, 65, 81, 58] }],
};

const datetimeLine: AnalysisReportChart = {
  kind: 'line',
  title: 'Monthly footfall',
  x_label: 'Month',
  y_label: 'Visitors',
  x_scale: 'datetime',
  categories: ['2024-01-01', '2024-02-01', '2024-03-01', '2024-04-01', '2024-05-01', '2024-06-01'],
  series: [{ name: 'Visitors', values: [1200, 1350, 1580, 1720, 2100, 1980] }],
};

const beforeScatter = `<svg viewBox="0 0 420 200" xmlns="http://www.w3.org/2000/svg" style="width:100%;background:#fff;border:1px solid #e4e4e7">
  <text x="52" y="12" fill="#3f3f46" font-size="11" font-family="sans-serif">Utilisation vs Headcount (BEFORE)</text>
  <circle cx="70" cy="140" r="2.2" fill="#52525b"/>
  <circle cx="120" cy="110" r="2.2" fill="#52525b"/>
  <circle cx="170" cy="95" r="2.2" fill="#52525b"/>
  <circle cx="220" cy="125" r="2.2" fill="#52525b"/>
  <circle cx="270" cy="70" r="2.2" fill="#52525b"/>
  <circle cx="320" cy="85" r="2.2" fill="#52525b"/>
  <circle cx="370" cy="50" r="2.2" fill="#52525b"/>
  <line x1="52" y1="158" x2="406" y2="158" stroke="#e4e4e7"/>
  <line x1="52" y1="18" x2="52" y2="158" stroke="#e4e4e7"/>
  <text x="229" y="178" text-anchor="middle" fill="#71717a" font-size="9" font-family="sans-serif">Headcount</text>
  <text x="12" y="88" text-anchor="middle" fill="#71717a" font-size="9" font-family="sans-serif" transform="rotate(-90 12 88)">Utilisation…</text>
  <text x="60" y="195" fill="#a1a1aa" font-size="9" font-family="sans-serif">No numeric tick labels</text>
</svg>`;

const beforeBar = `<svg viewBox="0 0 420 200" xmlns="http://www.w3.org/2000/svg" style="width:100%;background:#fff;border:1px solid #e4e4e7">
  <text x="52" y="12" fill="#3f3f46" font-size="11" font-family="sans-serif">Mean score by venue (BEFORE)</text>
  <rect x="70" y="60" width="40" height="98" fill="#71717a"/>
  <rect x="160" y="75" width="40" height="83" fill="#71717a"/>
  <rect x="250" y="40" width="40" height="118" fill="#71717a"/>
  <rect x="340" y="90" width="40" height="68" fill="#71717a"/>
  <line x1="52" y1="158" x2="406" y2="158" stroke="#e4e4e7"/>
  <line x1="52" y1="18" x2="52" y2="158" stroke="#e4e4e7"/>
  <text x="90" y="186" text-anchor="middle" fill="#71717a" font-size="8" font-family="sans-serif">Queen E…</text>
  <text x="180" y="186" text-anchor="middle" fill="#71717a" font-size="8" font-family="sans-serif">Victoria…</text>
  <text x="270" y="186" text-anchor="middle" fill="#71717a" font-size="8" font-family="sans-serif">Hackney…</text>
  <text x="360" y="186" text-anchor="middle" fill="#71717a" font-size="8" font-family="sans-serif">Mile En…</text>
</svg>`;

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-zinc-800">{title}</h2>
      {children}
    </section>
  );
}

export default function ChartAxisDemoPage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-900">
      <div className="mx-auto max-w-5xl space-y-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">ReportChart axis formatting</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600">
            Before fixtures mirror the prior axis-less / hard-truncated layout. After panels use the
            live <code>ReportChart</code> with inline and comfortable density.
          </p>
        </header>

        <Panel title="1. Scatter — before (axis lines only)">
          <div dangerouslySetInnerHTML={{ __html: beforeScatter }} />
        </Panel>
        <Panel title="1. Scatter — after (inline)">
          <ReportChart chart={scatter} density="inline" />
        </Panel>
        <Panel title="1. Scatter — after (comfortable / fullscreen·export)">
          <ReportChart chart={scatter} density="comfortable" />
        </Panel>

        <Panel title="2. Histogram — after (inline) with numeric ticks">
          <ReportChart chart={histogram} density="inline" />
        </Panel>
        <Panel title="2. Histogram — after (comfortable)">
          <ReportChart chart={histogram} density="comfortable" />
        </Panel>

        <Panel title="3. Bar with long labels — before (8-char cap)">
          <div dangerouslySetInnerHTML={{ __html: beforeBar }} />
        </Panel>
        <Panel title="3. Bar with long labels — after (inline, rotate)">
          <ReportChart chart={longBar} density="inline" />
        </Panel>
        <Panel title="3. Bar with long labels — after (comfortable)">
          <ReportChart chart={longBar} density="comfortable" />
        </Panel>

        <Panel title="4. Datetime axis — after (line, month resolution)">
          <ReportChart chart={datetimeLine} density="comfortable" />
        </Panel>
      </div>
    </main>
  );
}
