'use client';

import React from 'react';
import type { AnalysisReportChart } from '@/lib/analysis-report-types';
import { ReportChart } from '@/components/molecules/report-chart';

type Props = {
  chart: AnalysisReportChart;
  caption?: string;
};

export function AgentInlineChart({ chart, caption }: Props) {
  return (
    <div className="my-3 overflow-hidden rounded-lg border border-border bg-card/80 p-3">
      {caption ? (
        <p className="mb-2 text-[11px] font-medium text-muted-foreground">{caption}</p>
      ) : null}
      <ReportChart chart={chart} />
    </div>
  );
}
