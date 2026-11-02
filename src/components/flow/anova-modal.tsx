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
import { flowJson } from '@/lib/flow-api';
import { dependentColumns, isInternalColumn, type FlowColumn } from '@/lib/flow-columns';
import {
  anovaError,
  countedPairs,
  formatStat,
  pairText,
  pPhrase,
  type AnovaPair,
} from '@/components/flow/anova-result';

type PostHoc = 'none' | 'tukey' | 'games_howell' | 'bonferroni';

type GroupRow = { group?: string; n?: number; mean?: number; std?: number | null };

type AnovaTable = {
  ss_between?: number;
  ss_within?: number;
  df_between?: number;
  df_within?: number;
  ms_between?: number;
  ms_within?: number;
};

type AnovaResult = {
  f_statistic?: number;
  p_value?: number;
  eta_squared?: number | null;
  effect_size?: number | null;
  effect_size_type?: string;
  use_welch?: boolean;
  n_used?: number;
  anova_table?: AnovaTable | null;
  group_descriptives?: GroupRow[];
  welch_degrees_of_freedom?: { df1?: number; df2?: number };
  levene_test?: { statistic?: number; p_value?: number };
  exclusion_note?: string;
  weight?: { column?: string };
  post_hoc?: { method?: string; pairwise?: AnovaPair[] };
};

type AnovaEnvelope = {
  result?: AnovaResult;
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
  const pairs = countedPairs(result?.post_hoc?.pairwise);
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
                  options={outcomes.map(name => ({ value: name, label: name }))}
                />
              </label>
              <label>
                <span className="flow-muted">Factor · groups</span>
                <ChoiceSelect
                  aria-label="Factor column"
                  value={group}
                  onValueChange={setGroup}
                  options={factors.map(name => ({ value: name, label: name }))}
                />
              </label>
              <div>
                <span className="flow-muted">Post hoc</span>
                <div className="anova-pills">
                  {POST_HOC.map(option => (
                    <Button
                      key={option.value}
                      type="button"
                      className={postHoc === option.value ? 'sources-ink' : 'flow-btn'}
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
                <span>Means plot</span>
              </label>
              {result?.levene_test ? (
                <p className="flow-muted">
                  Levene&apos;s test {pPhrase(result.levene_test.p_value)}.
                </p>
              ) : null}
              {result?.weight?.column ? (
                <p className="flow-muted">Weighted by {result.weight.column}.</p>
              ) : null}
              {result?.exclusion_note ? (
                <p className="flow-muted">{result.exclusion_note}</p>
              ) : null}
            </div>
            <div className="anova-preview">
              {error ? (
                <p className="flow-error">{error}</p>
              ) : !result ? (
                <p className="flow-muted">
                  Run the analysis to see the groups, the F test, and any pairs.
                </p>
              ) : (
                <>
                  <p className="flow-muted">
                    n = {formatStat(result.n_used, 0)}
                    {result.weight?.column ? ' weighted' : ''}
                  </p>
                  {envelope?.report?.summary ? (
                    <p className="anova-summary">{envelope.report.summary}</p>
                  ) : null}
                  <div className="anova-table">
                    <div className="anova-line anova-line-head">
                      <span>Group</span>
                      <span>n</span>
                      <span>Mean</span>
                      <span>SD</span>
                    </div>
                    {(result.group_descriptives || []).map(row => (
                      <div key={row.group} className="anova-line">
                        <span>{row.group}</span>
                        <span>{formatStat(row.n, 0)}</span>
                        <span>{formatStat(row.mean, 2)}</span>
                        <span>{formatStat(row.std, 2)}</span>
                      </div>
                    ))}
                  </div>
                  {result.anova_table ? (
                    <div className="anova-table">
                      <div className="anova-line anova-source anova-line-head">
                        <span>Source</span>
                        <span>SS</span>
                        <span>df</span>
                        <span>MS</span>
                        <span>F</span>
                        <span>p</span>
                        <span>η²</span>
                      </div>
                      <div className="anova-line anova-source">
                        <span>Between groups</span>
                        <span>{formatStat(result.anova_table.ss_between, 1)}</span>
                        <span>{formatStat(result.anova_table.df_between, 0)}</span>
                        <span>{formatStat(result.anova_table.ms_between, 1)}</span>
                        <span>{formatStat(result.f_statistic, 2)}</span>
                        <span>{pPhrase(result.p_value)}</span>
                        <span>
                          {effect ? formatStat(result.eta_squared ?? result.effect_size, 2) : ''}
                        </span>
                      </div>
                      <div className="anova-line anova-source">
                        <span>Within groups</span>
                        <span>{formatStat(result.anova_table.ss_within, 1)}</span>
                        <span>{formatStat(result.anova_table.df_within, 0)}</span>
                        <span>{formatStat(result.anova_table.ms_within, 1)}</span>
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  ) : (
                    <p>
                      {result.use_welch ? "Welch's F" : 'F'}(
                      {formatStat(result.welch_degrees_of_freedom?.df1, 1)},{' '}
                      {formatStat(result.welch_degrees_of_freedom?.df2, 1)}) ={' '}
                      {formatStat(result.f_statistic, 2)}, {pPhrase(result.p_value)}
                      {effect && result.effect_size != null
                        ? `, η² = ${formatStat(result.effect_size, 2)}`
                        : ''}
                    </p>
                  )}
                  {pairs.significant.length ? (
                    <div className="anova-pairs">
                      {pairs.significant.map(row => (
                        <span key={`${row.group1}-${row.group2}`}>{pairText(row)}</span>
                      ))}
                      {pairs.other ? (
                        <span className="flow-muted">+ {pairs.other} not significant</span>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        )}
        <div className="anova-foot">
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
          <Button className="sources-ink" type="button" disabled={busy} onClick={run}>
            {busy ? 'Running…' : 'Run'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
