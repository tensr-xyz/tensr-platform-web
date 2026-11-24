'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/rest';
import { flowJson } from '@/lib/flow-api';
import {
  tabSpecBuildLabel,
  tabSpecFileLine,
  tabSpecIsMatched,
  tabSpecPreviewRows,
  tabSpecReviewLabel,
  tabSpecStatusLabel,
  tabSpecSummaryLine,
  type TabSpecBuildResult,
  type TabSpecReport,
} from '@/lib/tab-spec-panel';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      const comma = value.indexOf(',');
      resolve(comma >= 0 ? value.slice(comma + 1) : value);
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

/** Paper 10h · Tables → Build from a spec. Upload a tab plan and save matched tables. */
export function TabSpecDialog({
  datasetId,
  open,
  onOpenChange,
  onBuilt,
}: {
  datasetId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBuilt?: (result: TabSpecBuildResult) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [report, setReport] = useState<TabSpecReport | null>(null);
  const [reviewOnly, setReviewOnly] = useState(false);

  const matched = report?.n_matched ?? 0;
  const needs = report?.n_needs_you ?? 0;
  const rows = tabSpecPreviewRows(report, { reviewOnly, limit: reviewOnly ? 40 : 8 });

  async function onFile(file: File | undefined) {
    if (!file || !datasetId) return;
    setBusy(true);
    setError('');
    setReviewOnly(false);
    setReport(null);
    setFileName(file.name);
    try {
      const content_base64 = await fileToBase64(file);
      const next = await flowJson<TabSpecReport>(`/datasets/${datasetId}/tab-spec/parse`, {
        method: 'POST',
        body: JSON.stringify({ filename: file.name, content_base64 }),
      });
      setReport(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that tab plan');
    } finally {
      setBusy(false);
    }
  }

  async function buildMatched() {
    if (!datasetId || !report || matched <= 0) return;
    setBuilding(true);
    setError('');
    try {
      const result = await flowJson<TabSpecBuildResult>(`/datasets/${datasetId}/tab-spec/build`, {
        method: 'POST',
        body: JSON.stringify({ report }),
      });
      onBuilt?.(result);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build those tables');
    } finally {
      setBuilding(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next) {
          setReport(null);
          setError('');
          setFileName('');
          setReviewOnly(false);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="tab-spec-dialog flow-modal" aria-describedby="tab-spec-summary">
        <div className="flow-modal-head">
          <DialogTitle className="tab-spec-eyebrow">Tables → Build from a spec</DialogTitle>
          <div className="tab-spec-title">Build tables from your spec</div>
        </div>

        <Input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xlsm,.xls,.csv,.tsv,.docx"
          className="hidden"
          disabled={busy || building}
          onChange={e => void onFile(e.target.files?.[0])}
        />

        <div className="flow-modal-body">
          {!report && !busy ? (
            <div className="tab-spec-file">
              <span>{fileName || 'Choose an Excel or Word tab plan'}</span>
              <Button
                type="button"
                className="tab-spec-choose"
                disabled={!datasetId || busy}
                onClick={() => fileRef.current?.click()}
              >
                Choose file
              </Button>
            </div>
          ) : null}

          {busy ? (
            <div className="tab-spec-list" aria-busy="true">
              <Skeleton className="tab-spec-skeleton" />
              <Skeleton className="tab-spec-skeleton" />
              <Skeleton className="tab-spec-skeleton short" />
            </div>
          ) : null}

          {!busy && error ? <p className="flow-error">{error}</p> : null}

          {!busy && report ? (
            <>
              <div className="tab-spec-file">
                <span>{report.filename || fileName || 'Tab plan'}</span>
                <span className="tab-spec-file-meta">{tabSpecFileLine(report)}</span>
              </div>

              <div className="tab-spec-section-label">What Tensr read</div>
              <div className="tab-spec-list" role="table" aria-label="Tables from the spec">
                <div className="tab-spec-row head" role="row">
                  <span role="columnheader">#</span>
                  <span role="columnheader">Table</span>
                  <span role="columnheader">Banner</span>
                  <span role="columnheader">Status</span>
                </div>
                {rows.map(row => {
                  const matchedRow = tabSpecIsMatched(row);
                  return (
                    <div key={row.index} className="tab-spec-row" role="row">
                      <span role="cell">{row.index}</span>
                      <span role="cell">{row.title}</span>
                      <span role="cell">{row.banner_label || '—'}</span>
                      <span
                        role="cell"
                        className={matchedRow ? 'tab-spec-status ok' : 'tab-spec-status warn'}
                      >
                        {tabSpecStatusLabel(row)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {reviewOnly
                ? rows.map(row =>
                    row.refusal?.reason ? (
                      <p key={`reason-${row.index}`} className="tab-spec-reason">
                        {row.title}: {row.refusal.reason}
                        {row.refusal.hand_work ? ` ${row.refusal.hand_work}` : ''}
                      </p>
                    ) : null
                  )
                : null}

              <p id="tab-spec-summary" className="tab-spec-summary">
                {tabSpecSummaryLine(report)}
              </p>
            </>
          ) : null}
        </div>

        {!busy && report ? (
          <div className="tab-spec-actions flow-modal-foot">
            <Button
              type="button"
              className="tab-spec-secondary"
              disabled={needs <= 0 || building}
              onClick={() => setReviewOnly(current => !current)}
            >
              {reviewOnly ? 'Show all' : tabSpecReviewLabel(needs)}
            </Button>
            <Button
              type="button"
              className="tab-spec-primary"
              disabled={matched <= 0 || building}
              onClick={() => void buildMatched()}
            >
              {building ? 'Building…' : tabSpecBuildLabel(matched)}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
