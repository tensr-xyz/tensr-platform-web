'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChoiceSelect } from '@/components/ui/select';
import { Segmented } from '@/components/ui/segmented';
import { AnalysisResult } from '@/components/flow/analysis-result';
import { flowJson } from '@/lib/flow-api';
import { dependentColumns, isInternalColumn, type FlowColumn } from '@/lib/flow-columns';
import { anovaError } from '@/components/flow/anova-result';
import { resultFootnote, resultViewFromToolResults } from '@/components/flow/result-tables';

type PostHoc = 'none' | 'tukey' | 'games_howell' | 'bonferroni';

type AnovaEnvelope = {
  result?: Record<string, unknown>;
  run_id?: string;
  report?: {
    summary?: string;
    reproducibility?: { r_script?: string; python?: string; spss_syntax?: string };
  };
};

const POST_HOC: { value: PostHoc; label: string }[] = [
  { value: 'tukey', label: 'Tukey' },
  { value: 'games_howell', label: 'Games-Howell' },
  { value: 'bonferroni', label: 'Bonferroni' },
];

export function AnovaModal({
  columns,
  datasetId,
  projectId,
  onClose,
}: {
  columns: FlowColumn[];
  datasetId?: string;
  projectId?: string;
  onClose: () => void;
}) {
  const columnLabel = (name: string) => {
    const column = columns.find(item => item.name === name);
    const label = (column?.label || '').trim();
    return label && label.toLowerCase() !== name.toLowerCase() ? label : name;
  };
  const outcomes = useMemo(
    () => dependentColumns(columns).filter(name => !isInternalColumn(name)),
    [columns]
  );
  const factors = columns
    .map(column => column.name)
    .filter(name => name && !isInternalColumn(name) && !outcomes.includes(name));
  const [dependent, setDependent] = useState(outcomes[0] || '');
  const [group, setGroup] = useState(factors[0] || '');
  const [postHoc, setPostHoc] = useState<PostHoc>('none');
  const [welch, setWelch] = useState(false);
  const [effect, setEffect] = useState(true);
  const [meansPlot, setMeansPlot] = useState(false);
  const [view, setView] = useState<'form' | 'code'>('form');
  const [envelope, setEnvelope] = useState<AnovaEnvelope | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const result = envelope?.result;
  const viewResult = useMemo(
    () => resultViewFromToolResults(envelope ? [envelope] : []),
    [envelope]
  );
  const syntax = [
    envelope?.report?.reproducibility?.r_script,
    envelope?.report?.reproducibility?.python,
    envelope?.report?.reproducibility?.spss_syntax,
  ]
    .filter(Boolean)
    .join('\n\n');

  const run = () => {
    if (!datasetId || !dependent || !group) {
      setError('Choose a dependent column and a factor.');
      return;
    }
    setBusy(true);
    setError('');
    void flowJson<AnovaEnvelope>(`/datasets/${datasetId}/analyze/anova_oneway`, {
      method: 'POST',
      body: JSON.stringify({
        value_column: dependent,
        group_column: group,
        post_hoc: postHoc,
        use_welch: welch,
        effect_size: effect ? 'eta_squared' : 'none',
        output_chart: meansPlot ? 'means_plot' : 'none',
        include_group_descriptives: true,
        homogeneity_test: 'levene',
      }),
    })
      .then(setEnvelope)
      .catch(err => {
        setEnvelope(null);
        setError(anovaError(err));
      })
      .finally(() => setBusy(false));
  };

  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="anova-dialog">
        <DialogHeader className="anova-head">
          <div>
            <p className="flow-muted">Analyse · Compare means</p>
            <DialogTitle className="anova-title">One-way ANOVA</DialogTitle>
            <DialogDescription>
              Tests whether a numeric column differs across the groups in a factor.
            </DialogDescription>
          </div>
          <Segmented
            className="anova-view"
            aria-label="ANOVA view"
            value={view}
            onValueChange={setView}
            options={[
              { value: 'form', label: 'Form' },
              { value: 'code', label: 'Code' },
            ]}
          />
        </DialogHeader>
        {view === 'code' ? (
          <pre className="anova-code">
            {syntax || 'Run the analysis to see the syntax for this request.'}
          </pre>
        ) : (
          <div className="anova-body">
            <div className="anova-form">
              <label>
                <span className="flow-muted">Dependent · scale</span>
                <ChoiceSelect
                  aria-label="Dependent column"
                  value={dependent}
                  onValueChange={setDependent}
                  options={outcomes.map(name => ({ value: name, label: columnLabel(name) }))}
                />
              </label>
              <label>
                <span className="flow-muted">Factor · groups</span>
                <ChoiceSelect
                  aria-label="Factor column"
                  value={group}
                  onValueChange={setGroup}
                  options={factors.map(name => ({ value: name, label: columnLabel(name) }))}
                />
              </label>
              <div>
                <span className="flow-muted">Post hoc</span>
                <div className="anova-pills">
                  {POST_HOC.map(option => (
                    <Button
                      key={option.value}
                      type="button"
                      className="anova-pill"
                      data-active={postHoc === option.value}
                      aria-pressed={postHoc === option.value}
                      onClick={() =>
                        setPostHoc(current => (current === option.value ? 'none' : option.value))
                      }
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
              <span className="flow-muted anova-label">Report</span>
              <label className="anova-check">
                <Checkbox checked={welch} onCheckedChange={checked => setWelch(checked === true)} />
                <span>Welch&apos;s F</span>
              </label>
              <label className="anova-check">
                <Checkbox
                  checked={effect}
                  onCheckedChange={checked => setEffect(checked === true)}
                />
                <span>Effect size (η²)</span>
              </label>
              <label className="anova-check">
                <Checkbox
                  checked={meansPlot}
                  onCheckedChange={checked => setMeansPlot(checked === true)}
                />
                <span>Means plot with 95% CI</span>
              </label>
            </div>
            <div className="anova-preview">
              {error ? (
                <p className="flow-error">{error}</p>
              ) : !result || !viewResult.tables.length ? (
                <p className="flow-muted">
                  Run the analysis to see the groups, the F test, and any pairs.
                </p>
              ) : (
                <AnalysisResult
                  lead={envelope?.report?.summary}
                  tables={viewResult.tables}
                  footnote={resultFootnote(viewResult, '', 'ANOVA')}
                  checks={viewResult.checks}
                  script={viewResult.script || syntax}
                  rCheck={viewResult.rCheck}
                  rStatement={viewResult.rStatement}
                  runId={envelope?.run_id}
                />
              )}
            </div>
          </div>
        )}
        <div className="anova-foot">
          {syntax ? (
            <span className="anova-syntax">
              <code>
                {syntax.split('\n').find(line => line.trim() && !line.trim().startsWith('#')) ||
                  syntax}
              </code>
              <Button
                className="anova-copy"
                type="button"
                onClick={() => void navigator.clipboard?.writeText(syntax)}
              >
                Copy
              </Button>
            </span>
          ) : null}
          {projectId ? (
            <Link className="flow-btn" href={`/flow/p/${projectId}/chat`}>
              Ask agent to explain
            </Link>
          ) : null}
          {projectId ? (
            <Link className="flow-btn" href={`/flow/p/${projectId}/report`}>
              Add to report
            </Link>
          ) : null}
          <span className="sheet-spacer" />
          <Button className="flow-btn" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flow-btn primary" type="button" disabled={busy} onClick={run}>
            {busy ? 'Running…' : 'Run'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
