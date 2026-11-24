'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatGroupedNumber } from '@/lib/flow-survey';

export type DuplicationFigure = {
  percent?: number;
  thousands?: number;
  diagonal?: boolean;
};

export type DuplicationRow = {
  label: string;
  cells: DuplicationFigure[];
  reach: DuplicationFigure;
  exclusive: DuplicationFigure;
};

export type DuplicationSubsetNet = {
  indexes: number[];
  labels: string[];
  net_thousands: number;
  net_percent: number;
  sum_reach_thousands: number;
  overlap_thousands: number;
};

export type DuplicationCheck = {
  ok: boolean;
  label: string;
};

export type DuplicationPanelData = {
  labels: string[];
  rows: DuplicationRow[];
  subset_nets: DuplicationSubsetNet[];
  default_indexes: number[];
  checks: DuplicationCheck[];
  net_thousands: number;
  net_percent: number;
  base_thousands: number;
  unweighted_n: number;
  /** Named audience for this run's base; preferred over the prop fallback. */
  audience_label?: string;
};

/** Projected thousands the way Paper 6n shows them (289k, 1,221k). */
export function formatProjectedK(thousands: number): string {
  if (!Number.isFinite(thousands)) return '0k';
  const places = Math.abs(thousands) >= 100 ? 0 : 1;
  const shown = formatGroupedNumber(thousands, places).replace(/\.0$/, '');
  return `${shown}k`;
}

function cellStack(figure: DuplicationFigure | undefined) {
  if (!figure || figure.diagonal) {
    return <span className="duplication-dash">—</span>;
  }
  const percent =
    typeof figure.percent === 'number' && Number.isFinite(figure.percent)
      ? `${figure.percent.toFixed(1)}%`
      : '—';
  const detail =
    typeof figure.thousands === 'number' && Number.isFinite(figure.thousands)
      ? formatProjectedK(figure.thousands)
      : '';
  return (
    <span className="flow-cell-stack duplication-cell">
      <span className="flow-cell-stack-primary">{percent}</span>
      {detail ? <span className="flow-cell-stack-muted">{detail}</span> : null}
    </span>
  );
}

function subsetKey(indexes: number[]): string {
  return [...indexes].sort((a, b) => a - b).join(',');
}

/** Paper 6n · duplication matrix, net-reach chips, and checks. */
export function DuplicationPanel({
  panel,
  rCheck,
  rStatement,
  audience,
}: {
  panel: DuplicationPanelData;
  rCheck?: string;
  rStatement?: string;
  audience?: string;
}) {
  const labels = panel.labels || [];
  const [selected, setSelected] = useState<number[]>(() => {
    const defaults = (panel.default_indexes || []).filter(
      index => Number.isInteger(index) && index >= 0 && index < labels.length
    );
    return defaults.length ? defaults : labels.map((_, index) => index).slice(0, 2);
  });
  const available = labels
    .map((label, index) => ({ label, index }))
    .filter(item => !selected.includes(item.index));
  const nets = useMemo(() => {
    const map = new Map<string, DuplicationSubsetNet>();
    for (const entry of panel.subset_nets || []) {
      map.set(subsetKey(entry.indexes || []), entry);
    }
    return map;
  }, [panel.subset_nets]);
  const active = nets.get(subsetKey(selected));
  const netPercent = active?.net_percent ?? panel.net_percent;
  const netThousands = active?.net_thousands ?? panel.net_thousands;
  const sumReach = active?.sum_reach_thousands ?? 0;
  const overlap = active?.overlap_thousands ?? 0;
  const rOk = rCheck === 'verified' || rCheck === 'verified_in_ci' || rCheck === 'match';
  const rPending = rCheck === 'pending';
  const rFail = rCheck === 'not_verified' || rCheck === 'mismatch';
  const checks: { ok: boolean; label: string }[] = [
    ...(panel.checks || []),
    rPending
      ? { ok: true, label: 'R check running' }
      : rOk
        ? {
            ok: true,
            label:
              rStatement && /max \|Δ\|/i.test(rStatement)
                ? `Reproduced in R (${rStatement.match(/max \|Δ\| = ([^;)]+)/i)?.[1] ? `max difference ${rStatement.match(/max \|Δ\| = ([^;)]+)/i)?.[1].trim()}` : 'matched'})`
                : 'Reproduced in R',
          }
        : rFail
          ? { ok: false, label: 'R mismatch · The check did not match' }
          : { ok: false, label: 'R check unavailable' },
  ];
  const baseLabel = panel.audience_label?.trim() || audience?.trim() || 'all respondents';
  const basePeople =
    typeof panel.base_thousands === 'number' && Number.isFinite(panel.base_thousands)
      ? formatProjectedK(panel.base_thousands)
      : '';
  const baseN =
    typeof panel.unweighted_n === 'number' && panel.unweighted_n > 0
      ? formatGroupedNumber(panel.unweighted_n)
      : '';

  const toggle = (index: number) => {
    setSelected(current => {
      if (current.includes(index)) {
        if (current.length <= 1) return current;
        return current.filter(item => item !== index);
      }
      return [...current, index].sort((a, b) => a - b);
    });
  };

  const addNext = () => {
    const next = available[0];
    if (!next) return;
    toggle(next.index);
  };

  return (
    <div className="duplication-panel">
      <section className="duplication-matrix" aria-label="Duplication matrix">
        <div className="duplication-matrix-scroll">
          <table className="duplication-grid">
            <thead>
              <tr>
                <th scope="col">
                  <span className="duplication-matrix-hint">
                    % of row title&apos;s readers who also read the column title
                  </span>
                </th>
                {labels.map(label => (
                  <th key={label} scope="col">
                    {label}
                  </th>
                ))}
                <th scope="col">Reach</th>
                <th scope="col">Exclusive</th>
              </tr>
            </thead>
            <tbody>
              {(panel.rows || []).map(row => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {(row.cells || []).map((cell, index) => (
                    <td key={`${row.label}-${index}`}>{cellStack(cell)}</td>
                  ))}
                  <td>{cellStack(row.reach)}</td>
                  <td>{cellStack(row.exclusive)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="duplication-lower">
        <section className="duplication-net" aria-label="Net reach of a combination">
          <div className="duplication-net-head">
            <h3>Net reach of a combination</h3>
            {available.length ? (
              <Button type="button" className="duplication-add" onClick={addNext}>
                + Add title
              </Button>
            ) : null}
          </div>
          <div className="duplication-chips">
            {selected.map(index => (
              <Button
                key={labels[index]}
                type="button"
                className="duplication-chip"
                onClick={() => toggle(index)}
                aria-label={`Remove ${labels[index]}`}
              >
                {labels[index]} <span aria-hidden="true">×</span>
              </Button>
            ))}
          </div>
          <div className="duplication-net-figure">
            <span className="duplication-net-percent">{netPercent.toFixed(1)}%</span>
            <span className="duplication-net-people">
              {formatProjectedK(netThousands)} people · unduplicated
            </span>
          </div>
          {selected.length >= 2 && active ? (
            <p className="duplication-net-math">
              Sum of reaches {formatProjectedK(sumReach)} − overlap {formatProjectedK(overlap)} ={' '}
              {formatProjectedK(netThousands)}. Same engine as TURF.
            </p>
          ) : (
            <p className="duplication-net-math">Same engine as TURF.</p>
          )}
        </section>

        <section className="duplication-checks" aria-label="Checks">
          <h3>Checks</h3>
          <ul>
            {checks.map(check => (
              <li key={check.label} data-ok={check.ok ? 'true' : 'false'}>
                {check.ok ? '✓' : '✗'} {check.label}
              </li>
            ))}
          </ul>
          <p className="duplication-base">
            Base: {baseLabel}
            {baseN ? `, n = ${baseN}` : ''}
            {basePeople ? ` (${basePeople})` : ''}. Weighted to people. An audience filter swaps the
            base and every figure.
          </p>
        </section>
      </div>
    </div>
  );
}
