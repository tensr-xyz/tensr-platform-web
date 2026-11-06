'use client';

import { Button } from '@/components/ui/button';

/** Bars from the same cells the table shows. One group of bars per row. */
export function TableBars({
  series,
  onShowTable,
  onAddToReport,
}: {
  series: { label: string; values: { name: string; value: number }[] }[];
  onShowTable: () => void;
  onAddToReport?: () => void;
}) {
  const peak = Math.max(1, ...series.flatMap(row => row.values.map(item => item.value)));
  const grouped = series.some(row => row.values.length > 1);
  return (
    <section className="tables-main">
      <div className="tables-tools">
        <Button className="flow-btn" type="button" onClick={onShowTable}>
          Table
        </Button>
        {onAddToReport ? (
          <Button className="flow-btn" type="button" onClick={onAddToReport}>
            Add chart to report
          </Button>
        ) : null}
      </div>
      <div className="table-bars">
        {series.map(row => (
          <div key={row.label} className="table-bars-row">
            <span>{row.label}</span>
            <div className={grouped ? 'table-bars-stack' : 'table-bars-track'}>
              {row.values.map(item => (
                <i
                  key={`${row.label}-${item.name}`}
                  title={`${item.name}: ${item.value}`}
                  style={{ width: `${Math.max(2, (item.value / peak) * 100)}%` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
