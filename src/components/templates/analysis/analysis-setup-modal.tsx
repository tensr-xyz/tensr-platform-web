'use client';

import * as React from 'react';
import type { DatasetPreview, SchemaColumn } from '@/lib/analysis-report-types';

import {
  ANALYSIS_LABELS,
  ANALYSIS_WIZARD_META,
  type AnalysisKey,
  buildBodyFromForm,
  defaultFormFieldsFromSchema,
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
import { AnalysisDialogShell } from '@/components/molecules/analysis-dialog';
import { Checkbox } from '@/components/atoms/checkbox';
import { Label } from '@/components/atoms/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import {
  loadOutputPreferences,
  outputPreferencesToBody,
  saveOutputPreferences,
  type OutputPreferences,
} from '@/lib/output-preferences';
import { renderAnalysisForm } from '@/components/templates/analysis/analysis-setup-forms';

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
};

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
}: Props) {
  const [form, setForm] = React.useState<AnalysisFormState>(() => ({
    analysis: initialOp,
    ...defaultFormFieldsFromSchema([]),
  }));
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [outputPrefs, setOutputPrefs] = React.useState<OutputPreferences>(() =>
    loadOutputPreferences()
  );

  const bodyKey = React.useMemo(() => JSON.stringify(initialBody ?? null), [initialBody]);

  React.useEffect(() => {
    if (!open) return;
    setServerError(null);
    if (!schema.length) {
      setForm(f => ({ ...f, analysis: initialOp }));
      return;
    }
    if (initialBody && Object.keys(initialBody).length > 0) {
      setForm(formStateFromBody(initialOp, initialBody, schema));
    } else {
      setForm({ analysis: initialOp, ...defaultFormFieldsFromSchema(schema) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialBody encoded in bodyKey
  }, [open, initialOp, bodyKey, schema]);

  const allNames = schema.map(c => c.name);
  const analysis = form.analysis;
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
    () => getAnalysisRunBlockers(analysis, form, schema, datasetId, preview),
    [analysis, form, schema, datasetId, preview]
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

  const canRun = runBlockers.length === 0;

  const run = async () => {
    setServerError(null);
    if (runBlockers.length) {
      setServerError(runBlockers[0]);
      return;
    }
    try {
      const body = {
        ...buildBodyFromForm(form),
        ...outputPreferencesToBody(outputPrefs),
      };
      const effectiveOp =
        form.analysis === 'chi_square' && form.chiUseFishersExact ? 'fishers_exact' : form.analysis;
      await onRun(effectiveOp, body);
      onOpenChange(false);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Could not run analysis');
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
      canRun={canRun}
      runBlockers={runBlockers}
      serverError={serverError}
      onRun={run}
    >
      {!schema.length ? (
        <p className="text-sm text-muted-foreground">Upload a dataset with a schema first.</p>
      ) : (
        <>
          {renderAnalysisForm(analysis, {
            form,
            setForm,
            schema,
            allNames,
            notices: fieldNotices,
            errors: fieldErrors,
            tukeyBlocked,
          })}
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
              <Select
                value={String(outputPrefs.decimalPlaces)}
                onValueChange={value => {
                  const next = { ...outputPrefs, decimalPlaces: Number(value) };
                  setOutputPrefs(next);
                  saveOutputPreferences(next);
                }}
              >
                <SelectTrigger id="decimal-places" className="h-8 w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3, 4, 5].map(n => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </>
      )}
    </AnalysisDialogShell>
  );
}
