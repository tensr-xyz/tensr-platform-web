'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  applyResponseQualityRemovals,
  fetchResponseQualityReport,
  type ResponseQualityReport,
} from '@/lib/dataset-data-ops';
import { getStytchBearerForTensrApi } from '@/utils/auth';
import {
  countByDecision,
  filterQualityRows,
  qualityScoreOutOf100,
  qualityWhy,
  removalCsv,
  type QualityDecision,
  type QualityFilter,
  type QualityRow,
} from '@/components/flow/response-quality';

type CheckCard = { key: string; count: number; label: string };

function checkCards(summary: ResponseQualityReport['summary'] | undefined): CheckCard[] {
  const s = summary || {};
  return [
    {
      key: 'speeder',
      count: Number(s.speeder_rows || 0),
      label: 'Speeders · under ⅓ of median time',
    },
    {
      key: 'straightline',
      count: Number(s.straightline_rows || 0),
      label: 'Straight-liners in grids',
    },
    {
      key: 'bot',
      count: Number(s.bot_rows || 0),
      label: 'Likely AI-written or copied open ends',
    },
    {
      key: 'duplicate',
      count: Number(s.duplicate_rows || 0),
      label: 'Duplicates / near-duplicates',
    },
    {
      key: 'contradiction',
      count: 0,
      label: 'Contradictions (e.g. never used, rated it)',
    },
  ];
}

function toRows(report: ResponseQualityReport): QualityRow[] {
  return (report.rows || []).map(row => ({
    row_index: row.row_index,
    respondent_id: String(row.respondent_id),
    flags: row.flags || [],
    reasons: row.reasons || [],
    score: typeof row.score === 'number' ? row.score : 0,
    decision: row.decision,
  }));
}

/** Sources · Response quality (Paper artboard 10a). Keep / remove stays explicit. */
export function ResponseQualityPanel({
  datasetId,
  projectName = '',
  fileLabel = '',
  completes,
  onClose,
  onUploadNewer,
  onApplied,
}: {
  datasetId: string;
  projectName?: string;
  fileLabel?: string;
  completes?: number;
  onClose: () => void;
  onUploadNewer?: () => void;
  onApplied?: (datasetId: string) => void;
}) {
  const [report, setReport] = useState<ResponseQualityReport | null>(null);
  const [rows, setRows] = useState<QualityRow[]>([]);
  const [filter, setFilter] = useState<QualityFilter>('review');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const bearer = getStytchBearerForTensrApi();
    if (!bearer) {
      setError('Sign in again to check response quality.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchResponseQualityReport(datasetId, bearer)
      .then(payload => {
        if (cancelled) return;
        setReport(payload);
        setRows(toRows(payload));
        const counts = countByDecision(toRows(payload));
        if (counts.review > 0) setFilter('review');
        else if (counts.remove > 0) setFilter('remove');
        else setFilter('keep');
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Response quality did not load.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [datasetId]);

  const counts = useMemo(() => countByDecision(rows), [rows]);
  const shown = useMemo(() => filterQualityRows(rows, filter), [rows, filter]);
  const cards = checkCards(report?.summary);
  const crumb = [projectName, 'Sources', 'fieldwork open'].filter(Boolean).join(' · ');
  const metaBits = [
    fileLabel ? fileLabel : '',
    typeof completes === 'number' ? `${completes.toLocaleString('en-GB')} completes` : '',
  ].filter(Boolean);

  const setDecision = (rowIndex: number, decision: QualityDecision) => {
    setRows(current =>
      current.map(row => (row.row_index === rowIndex ? { ...row, decision } : row))
    );
  };

  const exportList = () => {
    const body = removalCsv(rows);
    const blob = new Blob([body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'removal-list.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const applyRemovals = () => {
    const removeIds = rows.filter(row => row.decision === 'remove').map(row => row.respondent_id);
    if (!removeIds.length) {
      setError('Mark at least one respondent as Remove before applying.');
      return;
    }
    const bearer = getStytchBearerForTensrApi();
    if (!bearer) {
      setError('Sign in again to apply removals.');
      return;
    }
    setBusy(true);
    setError(null);
    void applyResponseQualityRemovals(datasetId, { respondent_ids: removeIds }, bearer)
      .then(saved => {
        onApplied?.(saved.dataset_id);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Removals were not applied.'))
      .finally(() => setBusy(false));
  };

  return (
    <section className="rq-panel" aria-label="Response quality">
      <header className="rq-head">
        <div>
          <p className="rq-crumb">{crumb || 'Sources · fieldwork open'}</p>
          <h1 className="rq-title">Response quality</h1>
        </div>
        <div className="rq-actions">
          {metaBits.length ? <span className="rq-meta">{metaBits.join(' · ')}</span> : null}
          <Button type="button" className="flow-btn" onClick={onUploadNewer}>
            Upload newer data
          </Button>
          <Button
            type="button"
            className="sources-ink"
            onClick={exportList}
            disabled={!rows.length}
          >
            Export removal list
          </Button>
          <Button type="button" className="flow-btn" onClick={onClose}>
            Close
          </Button>
        </div>
      </header>

      {loading ? <p className="flow-muted rq-status">Checking respondents…</p> : null}
      {error ? (
        <p className="flow-banner warn" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && report ? (
        <>
          <div className="rq-checks">
            {cards.map(card => (
              <div key={card.key} className="rq-check">
                <strong>{card.count.toLocaleString('en-GB')}</strong>
                <span>{card.label}</span>
              </div>
            ))}
          </div>

          <div className="rq-list">
            <div className="rq-tabs" role="tablist" aria-label="Decision filter">
              {(
                [
                  ['review', `To review · ${counts.review}`],
                  ['remove', `Remove · ${counts.remove}`],
                  ['keep', `Keep · ${counts.keep}`],
                ] as const
              ).map(([id, label]) => (
                <Button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={filter === id}
                  className="rq-tab"
                  data-active={filter === id ? 'true' : 'false'}
                  onClick={() => setFilter(id)}
                >
                  {label}
                </Button>
              ))}
            </div>

            <div className="rq-table-head" aria-hidden="true">
              <span>Respondent</span>
              <span>Score</span>
              <span>Why</span>
              <span>Decision</span>
            </div>

            <div className="rq-rows">
              {shown.length ? (
                shown.map(row => {
                  const score = qualityScoreOutOf100(row.score);
                  const warn = score < 50;
                  return (
                    <div key={row.row_index} className="rq-row">
                      <span className="rq-id">{row.respondent_id}</span>
                      <span className="rq-score" data-warn={warn ? 'true' : 'false'}>
                        {score} / 100
                      </span>
                      <span className="rq-why">{qualityWhy(row.reasons) || '—'}</span>
                      <span className="rq-decide">
                        <Button
                          type="button"
                          className="rq-choice"
                          data-active={row.decision === 'keep' ? 'true' : 'false'}
                          data-tone="keep"
                          onClick={() => setDecision(row.row_index, 'keep')}
                        >
                          Keep
                        </Button>
                        <Button
                          type="button"
                          className="rq-choice"
                          data-active={row.decision === 'remove' ? 'true' : 'false'}
                          data-tone="remove"
                          onClick={() => setDecision(row.row_index, 'remove')}
                        >
                          Remove
                        </Button>
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="flow-muted rq-empty">No respondents in this list.</p>
              )}
            </div>

            <p className="rq-note">
              Nothing is deleted. Removed respondents are excluded from analysis and listed with
              reasons in the export for your panel provider.
            </p>
            {counts.remove > 0 ? (
              <div className="rq-apply">
                <Button
                  type="button"
                  className="sources-ink"
                  disabled={busy}
                  onClick={applyRemovals}
                >
                  {busy
                    ? 'Applying…'
                    : `Apply ${counts.remove.toLocaleString('en-GB')} removal${
                        counts.remove === 1 ? '' : 's'
                      }`}
                </Button>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
