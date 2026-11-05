'use client';

import * as React from 'react';
import type { DatasetPreview, SchemaColumn } from '@/lib/analysis-report-types';

import {
  ANALYSIS_LABELS,
  ANALYSIS_WIZARD_META,
  type AnalysisKey,
  bannerTableDecimalPlaces,
  buildBodyFromForm,
  defaultFormFieldsFromSchema,
  defaultFormForAnalysis,
  formStateFromBody,
  type AnalysisFormState,
} from '@/lib/analysis-definitions';
import { ANALYSIS_WIZARD_TOOLTIPS } from '@/lib/analysis-wizard-tooltips';
import {
  computeWizardFieldErrors,
  computeWizardFieldNotices,
  countPreviewDistinctNonEmpty,
  getAnalysisRunBlockers,
} from '@/lib/analysis-setup-validation';
import { formatApiErrorMessage } from '@/lib/api-error';
import {
  analyzeRunBody,
  loadOutputPreferences,
  saveOutputPreferences,
  type OutputPreferences,
} from '@/lib/output-preferences';
import { AnalysisDialogShell } from '@/components/molecules/analysis-dialog';
import { Checkbox } from '@/components/atoms/checkbox';
import { Input } from '@/components/atoms/input';
import { Label } from '@/components/atoms/label';
import { renderAnalysisForm } from '@/components/templates/analysis/analysis-setup-forms';
import { SpecDrivenSetup } from '@/components/templates/analysis/spec-driven-setup';
import { apiClient } from '@/lib/api-client';
import {
  analysisSpecsLoaded,
  bodyFromSpec,
  ensureAnalysisSpecs,
  isWeightParam,
  specFor,
  specRunBlockers,
  valuesFromSpec,
} from '@/lib/analysis-spec-setup';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialOp: AnalysisKey;
  initialBody?: Record<string, unknown> | null;
  schema: SchemaColumn[];
  preview?: DatasetPreview | null;
  datasetId: string | null;
  busy: boolean;
  onRun: (op: AnalysisKey, body: Record<string, unknown>) => Promise<void>;
  onBackToPalette: () => void;
  /** The host is still fetching rows the pickers need (group counts). */
  contextLoading?: boolean;
  /** False while the column list for this dataset is still on its way. */
  schemaReady?: boolean;
};

export type SpecsStatus = 'loading' | 'ready' | 'failed';

/**
 * The form the dialog renders must be the one its values were seeded for. Before
 * the catalog settles there is no form yet; after, the spec form when the op has one.
 */
export function setupFormKind(
  status: SpecsStatus,
  hasSpec: boolean,
  contextLoading = false
): 'loading' | 'spec' | 'legacy' {
  if (status === 'loading' || contextLoading) return 'loading';
  return status === 'ready' && hasSpec ? 'spec' : 'legacy';
}

const DEFAULTS_LINE: Partial<Record<AnalysisKey, string>> = {
  descriptives: 'Mean, standard deviation, minimum, and maximum. Weight uses the active weight.',
  banner_table: 'Column percents and significance letters, with FDR across columns.',
  linear_regression: 'Enter method, intercept included, listwise deletion.',
  poisson_regression: 'Log link and an intercept. Cluster-robust standard errors stay off.',
  negative_binomial_regression:
    'Log link and an intercept. Cluster-robust standard errors stay off.',
  ordinal_regression:
    'Proportional odds and an intercept. Cluster-robust standard errors stay off.',
  gee: 'Exchangeable working correlation. No random slopes.',
};

function DefaultsSummary({ analysis }: { analysis: AnalysisKey }) {
  return (
    <p className="mb-3 rounded-md bg-muted/60 px-2.5 py-1.5 text-[11px] leading-snug text-muted-foreground">
      <span className="font-medium text-foreground">Defaults. </span>
      {DEFAULTS_LINE[analysis] ??
        'The usual settings for this analysis. Open Advanced options to change them.'}
    </p>
  );
}

export function AnalysisSetupModal({
  open,
  onOpenChange,
  initialOp,
  initialBody,
  schema,
  preview = null,
  datasetId,
  busy,
  onRun,
  onBackToPalette,
  contextLoading = false,
  schemaReady = true,
}: Props) {
  const [form, setForm] = React.useState<AnalysisFormState>(() => ({
    analysis: initialOp,
    ...defaultFormFieldsFromSchema([]),
  }));
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [outputPrefs, setOutputPrefs] = React.useState<OutputPreferences>(() =>
    loadOutputPreferences()
  );
  const [activeWeight, setActiveWeight] = React.useState<string | null>(null);
  const [specValues, setSpecValues] = React.useState<Record<string, unknown>>({});
  // The catalog is module-cached. Read it on first paint so the spec form does not swap in later.
  const [specsStatus, setSpecsStatus] = React.useState<SpecsStatus>(() =>
    analysisSpecsLoaded() ? 'ready' : 'loading'
  );
  const [runAttempted, setRunAttempted] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void ensureAnalysisSpecs()
      .then(() => {
        if (!cancelled) setSpecsStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setSpecsStatus('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const bodyKey = React.useMemo(() => JSON.stringify(initialBody ?? null), [initialBody]);
  // The sheet schema arrives first, then the API schema (same names, sharper types)
  // and the preview rows. A fresh form follows those, so Age does not stay in a
  // categorical slot after its type or distinct values show up. A saved body still wins.
  const schemaKey = React.useMemo(
    () => schema.map(c => `${c.name}\u0001${c.type ?? ''}`).join('\u0000'),
    [schema]
  );
  const previewKey = preview ? `${preview.headers.join('\u0001')}:${preview.rows.length}` : '';
  // specsStatus is part of the key: when the catalog arrives the spec values are seeded
  // then, not left at {} while the legacy form's picks (id, a 4-group variable) vanish.
  const setupKey = `${initialOp}\u0001${bodyKey}\u0001${schemaKey}\u0001${previewKey}\u0001${specsStatus}`;
  const setupKeyRef = React.useRef('');
  // Values filled in by the dialog (defaults, the catalog arriving) are not the person's edits.
  const rebaseline = React.useRef(true);

  React.useEffect(() => {
    if (!open || !datasetId) return;
    let cancelled = false;
    void apiClient.datasets
      .getMetadata(datasetId)
      .then(meta => {
        if (!cancelled) setActiveWeight(meta.active_weight_column?.trim() || null);
      })
      .catch(() => {
        if (!cancelled) setActiveWeight(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, datasetId]);

  React.useEffect(() => {
    if (!open) return;
    setServerError(null);
    setRunAttempted(false);
    rebaseline.current = true;
    if (!schema.length) {
      setForm(f => ({ ...f, analysis: initialOp }));
      return;
    }
    const spec = specsStatus === 'ready' ? specFor(initialOp) : undefined;
    const fullReset = setupKeyRef.current !== setupKey;
    setupKeyRef.current = setupKey;
    if (spec) {
      const stored = initialBody && Object.keys(initialBody).length > 0 ? initialBody : null;
      if (fullReset) {
        setSpecValues(valuesFromSpec(spec, stored, activeWeight, schema, preview));
      } else if (activeWeight && !stored) {
        setSpecValues(current => {
          const next = { ...current };
          let patched = false;
          for (const param of spec.params) {
            if (!isWeightParam(param)) continue;
            if (next[param.name] == null || next[param.name] === '') {
              next[param.name] = activeWeight;
              patched = true;
            }
          }
          return patched ? next : current;
        });
      }
    }
    if (!fullReset) return;
    if (initialBody && Object.keys(initialBody).length > 0) {
      setForm(formStateFromBody(initialOp, initialBody, schema));
      setOutputPrefs(current => {
        const next = { ...current };
        const apa = initialBody.apa_format ?? initialBody.apaFormat;
        const charts = initialBody.include_charts ?? initialBody.includeCharts;
        if (typeof apa === 'boolean') next.apaFormat = apa;
        if (typeof charts === 'boolean') next.includeCharts = charts;
        if (initialOp === 'banner_table') {
          next.decimalPlaces = bannerTableDecimalPlaces(initialBody);
        }
        return next;
      });
    } else {
      const fresh = defaultFormForAnalysis(initialOp, schema, preview);
      if (activeWeight) {
        fresh.weightCol = activeWeight;
        fresh.bannerWeight = activeWeight;
      }
      setForm(fresh);
      setOutputPrefs(loadOutputPreferences());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialBody in bodyKey, schema in schemaKey, preview in previewKey
  }, [open, initialOp, bodyKey, schemaKey, previewKey, activeWeight, specsStatus]);

  const allNames = schema.map(c => c.name);
  const analysis = form.analysis;
  // Only the state the values were seeded for. Reading the module cache directly let a
  // later rerender (Run) swap the filled legacy form for an empty spec form.
  const formKind = setupFormKind(specsStatus, Boolean(specFor(analysis)), contextLoading);
  const spec = formKind === 'spec' ? specFor(analysis) : undefined;
  const meta = ANALYSIS_WIZARD_META[analysis];
  const tooltip = ANALYSIS_WIZARD_TOOLTIPS[analysis];

  const fieldNotices = React.useMemo(
    () => computeWizardFieldNotices(analysis, form, schema, preview),
    [analysis, form, schema, preview]
  );

  const fieldErrors = React.useMemo(
    () => computeWizardFieldErrors(analysis, form, schema, preview),
    [analysis, form, schema, preview]
  );

  const runBlockers = React.useMemo(
    () =>
      spec
        ? specRunBlockers(spec, specValues)
        : getAnalysisRunBlockers(analysis, form, schema, datasetId, preview),
    [spec, specValues, analysis, form, schema, datasetId, preview]
  );

  const anovaPreviewLevels =
    analysis === 'anova_oneway'
      ? countPreviewDistinctNonEmpty(preview ?? null, form.groupCol)
      : null;
  const tukeyBlocked = anovaPreviewLevels != null && anovaPreviewLevels > 50;

  React.useEffect(() => {
    if (analysis !== 'anova_oneway' || !tukeyBlocked || form.anovaPostHoc !== 'tukey') return;
    setForm(f => ({ ...f, anovaPostHoc: 'none' }));
  }, [analysis, tukeyBlocked, form.anovaPostHoc]);

  const canRun = formKind !== 'loading' && runBlockers.length === 0;
  const firstInput = React.useRef(JSON.stringify([form, specValues]));
  const currentInput = JSON.stringify([form, specValues]);
  if (rebaseline.current) {
    firstInput.current = currentInput;
    rebaseline.current = false;
  }
  const touched = currentInput !== firstInput.current;
  const revealed = runAttempted || touched;

  const run = async () => {
    if (formKind === 'loading') return;
    setRunAttempted(true);
    setServerError(null);
    if (runBlockers.length) {
      setServerError(runBlockers[0]);
      return;
    }
    try {
      const body = spec
        ? analyzeRunBody(bodyFromSpec(spec, specValues, initialBody), outputPrefs)
        : analyzeRunBody(buildBodyFromForm(form), outputPrefs);
      const effectiveOp =
        !spec && form.analysis === 'chi_square' && form.chiUseFishersExact
          ? 'fishers_exact'
          : form.analysis;
      await onRun(effectiveOp, body);
      onOpenChange(false);
    } catch (e) {
      setServerError(formatApiErrorMessage(e));
    }
  };

  return (
    <AnalysisDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={ANALYSIS_LABELS[analysis]}
      meta={meta}
      tooltip={tooltip}
      onBack={onBackToPalette}
      busy={busy}
      canRun={analysis === 'descriptives' ? formKind !== 'loading' : canRun}
      runBlockers={runBlockers}
      revealBlockers={revealed}
      serverError={serverError}
      onRun={run}
    >
      {!schemaReady || formKind === 'loading' ? (
        <p className="text-sm text-muted-foreground">Loading your variables…</p>
      ) : !schema.length ? (
        <p className="text-sm text-muted-foreground">Upload a dataset with a schema first.</p>
      ) : (
        <>
          {spec ? (
            <SpecDrivenSetup
              spec={spec}
              values={specValues}
              onChange={(name, value) => setSpecValues(current => ({ ...current, [name]: value }))}
              schema={schema}
              preview={preview}
              revealSelectionError={revealed}
            />
          ) : (
            <>
              <DefaultsSummary analysis={analysis} />
              {renderAnalysisForm(analysis, {
                form,
                setForm,
                schema,
                allNames,
                notices: fieldNotices,
                errors: revealed ? fieldErrors : {},
                tukeyBlocked,
                preview,
              })}
            </>
          )}
          <div className="mt-6 space-y-3 border-t border-border pt-4">
            <p className="text-xs font-medium text-foreground">Report output</p>
            <div className="flex items-center gap-2">
              <Checkbox
                id="apa-format"
                checked={outputPrefs.apaFormat}
                onCheckedChange={checked => {
                  const next = { ...outputPrefs, apaFormat: checked === true };
                  setOutputPrefs(next);
                  saveOutputPreferences(next);
                }}
              />
              <Label htmlFor="apa-format" className="text-sm font-normal">
                APA-style tables
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="include-charts"
                checked={outputPrefs.includeCharts}
                onCheckedChange={checked => {
                  const next = { ...outputPrefs, includeCharts: checked === true };
                  setOutputPrefs(next);
                  saveOutputPreferences(next);
                }}
              />
              <Label htmlFor="include-charts" className="text-sm font-normal">
                Include charts in report when available
              </Label>
            </div>
            <div className="space-y-1">
              <Label htmlFor="decimal-places" className="text-sm">
                Decimal places
              </Label>
              <Input
                id="decimal-places"
                type="number"
                min={0}
                max={6}
                step={1}
                inputSize="sm"
                className="h-8 w-24 rounded-md px-2 text-sm"
                value={outputPrefs.decimalPlaces}
                onChange={event => {
                  const places = Number(event.target.value);
                  const next = {
                    ...outputPrefs,
                    decimalPlaces: Number.isFinite(places)
                      ? Math.max(0, Math.min(6, Math.round(places)))
                      : outputPrefs.decimalPlaces,
                  };
                  setOutputPrefs(next);
                  saveOutputPreferences(next);
                }}
              />
            </div>
          </div>
        </>
      )}
    </AnalysisDialogShell>
  );
}
