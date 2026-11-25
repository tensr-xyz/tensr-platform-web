'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ReportChart } from '@/components/molecules/report-chart';
import {
  BANNER_CHART_KINDS,
  type BannerChartKind,
  type BannerChartSeries,
  chartFromBannerSeries,
} from '@/lib/flow-survey';

const KIND_PATH: Record<BannerChartKind, string> = {
  bar: 'M3 12V7M7 12V3M11 12V5',
  stacked: 'M3 12V8h3v4H3zm4 0V5h3v7H7zm4 0V3h3v9h-3z',
  stacked_100: 'M3 12V2h3v10H3zm4 0V2h3v10H7zm4 0V2h3v10h-3z',
  horizontal: 'M2 3h8M2 7h11M2 11h5',
  line: 'M2 11l3-4 3 2 4-6',
  area: 'M2 12l3-5 3 2 4-6v9H2z',
  pie: 'M7 2a5 5 0 1 1 0 10A5 5 0 0 1 7 2zm0 0v5l4 2',
  donut: 'M7 2a5 5 0 1 1 0 10A5 5 0 0 1 7 2zm0 2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
};

const FILL_KINDS = new Set<BannerChartKind>(['area', 'pie', 'donut', 'stacked', 'stacked_100']);

/** Same banner cells as a chart, with a type picker (bar / stacked / line / pie / …). */
export function TableBars({
  series,
  title = '',
  significanceNote,
  onAddToReport,
}: {
  series: BannerChartSeries[];
  title?: string;
  /** Same column-letter test footnote as the table. */
  significanceNote?: string;
  onAddToReport?: () => void;
}) {
  const [kind, setKind] = useState<BannerChartKind>('bar');
  const [added, setAdded] = useState(false);
  const chart = useMemo(
    () => chartFromBannerSeries(series, kind, { title, significanceNote }),
    [series, kind, title, significanceNote]
  );

  return (
    <div className="table-chart">
      <div className="table-chart-head">
        <div className="chart-types" role="group" aria-label="Chart type">
          {BANNER_CHART_KINDS.map(option => (
            <Button
              key={option.value}
              className="chart-type"
              type="button"
              data-active={kind === option.value}
              aria-pressed={kind === option.value}
              onClick={() => setKind(option.value)}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path
                  d={KIND_PATH[option.value]}
                  fill={FILL_KINDS.has(option.value) ? 'currentColor' : 'none'}
                  fillOpacity={option.value === 'area' ? 0.25 : 1}
                  fillRule={option.value === 'donut' ? 'evenodd' : undefined}
                  stroke="currentColor"
                  strokeWidth={1.3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {option.label}
            </Button>
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
      {chart ? <ReportChart chart={chart} density="comfortable" /> : null}
    </div>
  );
}
