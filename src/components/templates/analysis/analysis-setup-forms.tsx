'use client';

import * as React from 'react';

import type {
  AnalysisFormState,
  AnalysisKey,
  ConfidenceLevelKey,
  DescriptiveStatKey,
} from '@/lib/analysis-definitions';
import {
  WIZARD_FIELD,
  type WizardFieldErrorsMap,
  type WizardFieldNoticesMap,
} from '@/lib/analysis-setup-validation';
import type { SchemaColumn } from '@/lib/analysis-report-types';
import { Checkbox } from '@/components/atoms/checkbox';
import { Label } from '@/components/atoms/label';
import {
  AdvancedOptionsDisclosure,
  ColumnSelect,
  FieldFeedbackList,
  FormSectionLabel,
  MultiColumnPicker,
  NumericField,
  PillToggle,
} from '@/components/molecules/analysis-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/molecules/tabs';

const CONFIDENCE_OPTIONS: { value: ConfidenceLevelKey; label: string }[] = [
  { value: '0.9', label: '90%' },
  { value: '0.95', label: '95%' },
  { value: '0.99', label: '99%' },
];

const CORRELATION_OPTIONS = [
  { value: 'pearson' as const, label: 'Pearson' },
  { value: 'spearman' as const, label: 'Spearman' },
  { value: 'kendall' as const, label: "Kendall's tau-b" },
];

const CORRELATION_METHOD_HINT: Record<AnalysisFormState['correlationMethod'], string> = {
  pearson: 'Measures linear association between continuous variables. Assumes normality.',
  spearman: 'Rank-based. Use when variables are ordinal or non-normally distributed.',
  kendall: 'Rank-based. More robust than Spearman with small samples or many tied ranks.',
};

const DESCRIPTIVE_STAT_LABELS: Record<DescriptiveStatKey, string> = {
  mean: 'Mean',
  median: 'Median',
  std_dev: 'Std deviation',
  variance: 'Variance',
  range: 'Range',
  min: 'Minimum',
  max: 'Maximum',
  skewness: 'Skewness',
  kurtosis: 'Kurtosis',
  sem: 'Std error of mean',
};

const REGRESSION_METHOD_HINT: Record<AnalysisFormState['regressionMethod'], string> = {
  enter: 'All selected predictors are entered simultaneously.',
  stepwise: 'Predictors are added or removed based on statistical criteria at each step.',
  backward:
    'Starts with all predictors. Removes the weakest one at each step until only significant predictors remain.',
  forward: 'Starts with no predictors. Adds the strongest one at each step.',
};

type FormSliceProps = {
  form: AnalysisFormState;
  setForm: React.Dispatch<React.SetStateAction<AnalysisFormState>>;
  schema: SchemaColumn[];
  allNames: string[];
  notices: WizardFieldNoticesMap;
  errors: WizardFieldErrorsMap;
  tukeyBlocked?: boolean;
};

function ConfidencePills({
  value,
  onChange,
}: {
  value: ConfidenceLevelKey;
  onChange: (v: ConfidenceLevelKey) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">Confidence level</Label>
      <PillToggle
        value={value}
        onChange={onChange}
        options={CONFIDENCE_OPTIONS}
        aria-label="Confidence level"
      />
    </div>
  );
}

function CheckboxRow({
  id,
  label,
  checked,
  onCheckedChange,
  hint,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <label htmlFor={id} className="flex cursor-pointer items-start gap-2 text-xs">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={v => onCheckedChange(v === true)}
          className="mt-0.5"
        />
        <span>{label}</span>
      </label>
      {hint ? <p className="pl-6 text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function DescriptivesForm({ form, setForm, schema, notices, errors }: FormSliceProps) {
  return (
    <section className="space-y-4">
      <div className="space-y-3">
        <FormSectionLabel>Variables</FormSectionLabel>
        <MultiColumnPicker
          selected={form.selectedCols}
          onChange={selectedCols => setForm(f => ({ ...f, selectedCols }))}
          schema={schema}
          showEmptyIncludesAll
          showTypeShortcuts
          notices={notices[WIZARD_FIELD.columns]}
          errors={errors[WIZARD_FIELD.columns]}
        />
        <p className="text-[10px] text-muted-foreground">
          Leave empty to include all applicable columns.
        </p>
      </div>
      <AdvancedOptionsDisclosure>
        <FormSectionLabel>Statistics</FormSectionLabel>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(DESCRIPTIVE_STAT_LABELS) as DescriptiveStatKey[]).map(key => (
            <CheckboxRow
              key={key}
              id={`desc-stat-${key}`}
              label={DESCRIPTIVE_STAT_LABELS[key]}
              checked={form.descriptiveStats[key]}
              onCheckedChange={checked =>
                setForm(f => ({
                  ...f,
                  descriptiveStats: { ...f.descriptiveStats, [key]: checked },
                }))
              }
            />
          ))}
        </div>
      </AdvancedOptionsDisclosure>
    </section>
  );
}

export function CorrelationForm({ form, setForm, schema, notices, errors }: FormSliceProps) {
  return (
    <section className="space-y-4">
      <div className="space-y-3">
        <FormSectionLabel>Variables</FormSectionLabel>
        <MultiColumnPicker
          selected={form.selectedCols}
          onChange={selectedCols => setForm(f => ({ ...f, selectedCols }))}
          schema={schema}
          filterSlot="numeric"
          showTypeShortcuts
          notices={notices[WIZARD_FIELD.columns]}
          errors={errors[WIZARD_FIELD.columns]}
        />
      </div>
      <div className="space-y-3">
        <FormSectionLabel>Options</FormSectionLabel>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Correlation method</Label>
          <PillToggle
            value={form.correlationMethod}
            onChange={correlationMethod => setForm(f => ({ ...f, correlationMethod }))}
            options={CORRELATION_OPTIONS}
            aria-label="Correlation method"
          />
          <p className="text-[10px] leading-snug text-muted-foreground">
            {CORRELATION_METHOD_HINT[form.correlationMethod]}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Significance</Label>
          <PillToggle
            value={form.correlationSignificance}
            onChange={correlationSignificance => setForm(f => ({ ...f, correlationSignificance }))}
            options={[
              { value: 'two_tailed' as const, label: 'Two-tailed' },
              { value: 'one_tailed' as const, label: 'One-tailed' },
            ]}
            aria-label="Significance"
          />
        </div>
        <CheckboxRow
          id="flag-sig-corr"
          label="Flag significant correlations"
          checked={form.flagSignificantCorrelations}
          onCheckedChange={flagSignificantCorrelations =>
            setForm(f => ({ ...f, flagSignificantCorrelations }))
          }
        />
      </div>
    </section>
  );
}

export function GroupNumericForm({
  form,
  setForm,
  schema,
  allNames,
  notices,
  errors,
  outcomeFirst = false,
  showConfidence = false,
  showPostHoc = false,
  showAnovaOptions = false,
  tukeyBlocked = false,
  outcomeLabel = 'Outcome',
  groupingLabel = 'Grouping variable',
  showHypothesizedDifference = false,
}: FormSliceProps & {
  outcomeFirst?: boolean;
  showConfidence?: boolean;
  showPostHoc?: boolean;
  showAnovaOptions?: boolean;
  outcomeLabel?: string;
  groupingLabel?: string;
  showHypothesizedDifference?: boolean;
}) {
  const outcome = (
    <ColumnSelect
      label={outcomeLabel}
      value={form.valueCol}
      onChange={valueCol => setForm(f => ({ ...f, valueCol }))}
      schema={schema}
      names={allNames}
      expectedType="numeric"
      notices={notices[WIZARD_FIELD.valueCol]}
      errors={errors[WIZARD_FIELD.valueCol]}
    />
  );
  const grouping = (
    <ColumnSelect
      label={groupingLabel}
      value={form.groupCol}
      onChange={groupCol => setForm(f => ({ ...f, groupCol }))}
      schema={schema}
      names={allNames}
      expectedType="categorical"
      notices={notices[WIZARD_FIELD.groupCol]}
      errors={errors[WIZARD_FIELD.groupCol]}
    />
  );

  return (
    <section className="space-y-4">
      <div className="space-y-3">
        <FormSectionLabel>Variables</FormSectionLabel>
        <div className="grid gap-3">
          {outcomeFirst ? (
            <>
              {outcome}
              {grouping}
            </>
          ) : (
            <>
              {grouping}
              {outcome}
            </>
          )}
        </div>
      </div>
      <div className="space-y-3">
        <FormSectionLabel>Options</FormSectionLabel>
        {showHypothesizedDifference ? (
          <NumericField
            label="Hypothesised difference"
            value={form.hypothesizedDifference}
            onChange={hypothesizedDifference => setForm(f => ({ ...f, hypothesizedDifference }))}
            hint="The expected difference between group means under the null hypothesis. Usually 0."
            error={errors[WIZARD_FIELD.hypothesizedDifference]?.[0]}
          />
        ) : null}
        {showPostHoc ? (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Post-hoc method</Label>
            <PillToggle
              value={form.anovaPostHoc}
              onChange={anovaPostHoc => setForm(f => ({ ...f, anovaPostHoc }))}
              options={[
                { value: 'none' as const, label: 'None' },
                {
                  value: 'tukey' as const,
                  label: 'Tukey HSD',
                  disabled: tukeyBlocked,
                  disabledReason: 'Unavailable with more than 50 groups',
                },
                { value: 'bonferroni' as const, label: 'Bonferroni' },
                { value: 'scheffe' as const, label: 'Scheffé' },
                { value: 'games_howell' as const, label: 'Games-Howell' },
              ]}
              aria-label="Post-hoc method"
            />
            <FieldFeedbackList
              notices={notices[WIZARD_FIELD.anovaPostHoc]}
              errors={errors[WIZARD_FIELD.anovaPostHoc]}
            />
          </div>
        ) : null}
        {showAnovaOptions ? (
          <>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Effect size</Label>
              <PillToggle
                value={form.anovaEffectSize}
                onChange={anovaEffectSize => setForm(f => ({ ...f, anovaEffectSize }))}
                options={[
                  { value: 'eta_squared' as const, label: 'η²' },
                  { value: 'partial_eta_squared' as const, label: 'Partial η²' },
                  { value: 'omega_squared' as const, label: 'ω²' },
                  { value: 'none' as const, label: 'None' },
                ]}
                aria-label="Effect size"
              />
            </div>
            <ConfidencePills
              value={form.confidenceLevel}
              onChange={confidenceLevel => setForm(f => ({ ...f, confidenceLevel }))}
            />
            <CheckboxRow
              id="anova-desc-group"
              label="Descriptives per group"
              checked={form.anovaDescriptivesByGroup}
              onCheckedChange={anovaDescriptivesByGroup =>
                setForm(f => ({ ...f, anovaDescriptivesByGroup }))
              }
            />
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Homogeneity test</Label>
              <PillToggle
                value={form.anovaHomogeneity}
                onChange={anovaHomogeneity => setForm(f => ({ ...f, anovaHomogeneity }))}
                options={[
                  { value: 'levene' as const, label: "Levene's" },
                  { value: 'brown_forsythe' as const, label: 'Brown–Forsythe' },
                  { value: 'none' as const, label: 'None' },
                ]}
                aria-label="Homogeneity test"
              />
            </div>
          </>
        ) : null}
        {showConfidence && !showAnovaOptions ? (
          <ConfidencePills
            value={form.confidenceLevel}
            onChange={confidenceLevel => setForm(f => ({ ...f, confidenceLevel }))}
          />
        ) : null}
      </div>
      {showAnovaOptions ? (
        <AdvancedOptionsDisclosure>
          <CheckboxRow
            id="anova-welch"
            label="Welch correction (unequal variances)"
            checked={form.anovaWelchCorrection}
            onCheckedChange={anovaWelchCorrection => setForm(f => ({ ...f, anovaWelchCorrection }))}
          />
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Missing values</Label>
            <PillToggle
              value={form.anovaMissingValues}
              onChange={anovaMissingValues => setForm(f => ({ ...f, anovaMissingValues }))}
              options={[
                { value: 'listwise' as const, label: 'Exclude listwise' },
                { value: 'pairwise' as const, label: 'Exclude pairwise' },
              ]}
              aria-label="Missing values"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Output chart</Label>
            <PillToggle
              value={form.anovaOutputChart}
              onChange={anovaOutputChart => setForm(f => ({ ...f, anovaOutputChart }))}
              options={[
                { value: 'boxplot' as const, label: 'Boxplot' },
                { value: 'means_plot' as const, label: 'Means plot' },
                { value: 'none' as const, label: 'None' },
              ]}
              aria-label="Output chart"
            />
          </div>
        </AdvancedOptionsDisclosure>
      ) : null}
    </section>
  );
}

export function IndependentTTestForm(props: FormSliceProps) {
  return (
    <GroupNumericForm
      {...props}
      outcomeFirst
      showConfidence
      showHypothesizedDifference
      outcomeLabel="Test variable"
      groupingLabel="Grouping variable"
    />
  );
}

export function AnovaForm(props: FormSliceProps) {
  return (
    <GroupNumericForm {...props} showPostHoc showAnovaOptions tukeyBlocked={props.tukeyBlocked} />
  );
}

export function KruskalWallisForm({ form, setForm, ...rest }: FormSliceProps) {
  return (
    <div className="space-y-0">
      <GroupNumericForm
        {...rest}
        form={form}
        setForm={setForm}
        outcomeLabel="Test variable"
        groupingLabel="Grouping variable"
      />
      <div className="mt-4 space-y-3">
        <FormSectionLabel>Options</FormSectionLabel>
        <CheckboxRow
          id="kruskal-posthoc"
          label="Post-hoc pairwise comparisons"
          checked={form.kruskalPostHoc}
          onCheckedChange={kruskalPostHoc => setForm(f => ({ ...f, kruskalPostHoc }))}
        />
      </div>
    </div>
  );
}

export function PairedTTestForm({
  form,
  setForm,
  schema,
  allNames,
  notices,
  errors,
}: FormSliceProps) {
  return (
    <section className="space-y-4">
      <div className="space-y-3">
        <FormSectionLabel>Variables</FormSectionLabel>
        <ColumnSelect
          label="Variable 1"
          value={form.pairedBeforeCol}
          onChange={pairedBeforeCol => setForm(f => ({ ...f, pairedBeforeCol }))}
          schema={schema}
          names={allNames}
          expectedType="numeric"
          notices={notices[WIZARD_FIELD.pairedVar1]}
          errors={errors[WIZARD_FIELD.pairedVar1]}
        />
        <ColumnSelect
          label="Variable 2"
          value={form.pairedAfterCol}
          onChange={pairedAfterCol => setForm(f => ({ ...f, pairedAfterCol }))}
          schema={schema}
          names={allNames}
          expectedType="numeric"
          notices={notices[WIZARD_FIELD.pairedVar2]}
          errors={errors[WIZARD_FIELD.pairedVar2]}
        />
      </div>
      <div className="space-y-3">
        <FormSectionLabel>Options</FormSectionLabel>
        <ConfidencePills
          value={form.confidenceLevel}
          onChange={confidenceLevel => setForm(f => ({ ...f, confidenceLevel }))}
        />
      </div>
    </section>
  );
}

export function OneSampleTTestForm({
  form,
  setForm,
  schema,
  allNames,
  notices,
  errors,
  hideHypothesizedMean,
}: FormSliceProps & { hideHypothesizedMean?: boolean }) {
  return (
    <section className="space-y-4">
      <div className="space-y-3">
        <FormSectionLabel>Variables</FormSectionLabel>
        <ColumnSelect
          label="Test variable"
          value={form.oneSampleCol}
          onChange={oneSampleCol => setForm(f => ({ ...f, oneSampleCol }))}
          schema={schema}
          names={allNames}
          expectedType="numeric"
          notices={notices[WIZARD_FIELD.oneSampleCol]}
          errors={errors[WIZARD_FIELD.oneSampleCol]}
        />
        {!hideHypothesizedMean ? (
          <NumericField
            label="Test value"
            value={form.hypothesizedMean}
            onChange={hypothesizedMean => setForm(f => ({ ...f, hypothesizedMean }))}
            hint="The population mean you are testing against. Use 0 to test whether the mean differs from zero."
            error={errors[WIZARD_FIELD.hypothesizedMean]?.[0]}
          />
        ) : null}
      </div>
      {!hideHypothesizedMean ? (
        <div className="space-y-3">
          <FormSectionLabel>Options</FormSectionLabel>
          <ConfidencePills
            value={form.confidenceLevel}
            onChange={confidenceLevel => setForm(f => ({ ...f, confidenceLevel }))}
          />
        </div>
      ) : null}
    </section>
  );
}

function RegressionVariablesTab({
  form,
  setForm,
  schema,
  allNames,
  notices,
  errors,
  logistic,
}: FormSliceProps & { logistic?: boolean }) {
  return (
    <div className="space-y-3">
      <ColumnSelect
        label={logistic ? 'Dependent variable (binary)' : 'Dependent variable'}
        value={form.depCol}
        onChange={depCol => setForm(f => ({ ...f, depCol }))}
        schema={schema}
        names={allNames}
        expectedType={logistic ? 'categorical' : 'numeric'}
        notices={notices[WIZARD_FIELD.depCol]}
        errors={errors[WIZARD_FIELD.depCol]}
      />
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">
          {logistic ? 'Covariates' : 'Independent variable(s)'}
        </Label>
        <MultiColumnPicker
          selected={form.independentCols}
          onChange={independentCols => setForm(f => ({ ...f, independentCols }))}
          schema={schema}
          filterSlot="numeric"
          showTypeShortcuts
          minSelected={1}
          notices={notices[WIZARD_FIELD.independentCols]}
          errors={errors[WIZARD_FIELD.independentCols]}
        />
      </div>
    </div>
  );
}

function RegressionOptionsTab({
  form,
  setForm,
  errors,
  logistic,
  showEntryMethod = false,
}: FormSliceProps & { logistic?: boolean; showEntryMethod?: boolean }) {
  return (
    <div className="space-y-4">
      {showEntryMethod ? (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Method</Label>
          <PillToggle
            value={form.regressionMethod}
            onChange={regressionMethod => setForm(f => ({ ...f, regressionMethod }))}
            options={[
              { value: 'enter' as const, label: 'Entry' },
              { value: 'stepwise' as const, label: 'Stepwise' },
              { value: 'forward' as const, label: 'Forward' },
              { value: 'backward' as const, label: 'Backward' },
            ]}
            aria-label="Regression method"
          />
          <p className="text-[11px] text-muted-foreground">
            {REGRESSION_METHOD_HINT[form.regressionMethod]}
          </p>
        </div>
      ) : null}
      <ConfidencePills
        value={form.confidenceLevel}
        onChange={confidenceLevel => setForm(f => ({ ...f, confidenceLevel }))}
      />
      <CheckboxRow
        id="reg-include-constant"
        label="Include constant in equation"
        checked={logistic ? form.logisticIncludeConstant : form.regressionIncludeConstant}
        onCheckedChange={checked =>
          setForm(f =>
            logistic
              ? { ...f, logisticIncludeConstant: checked }
              : { ...f, regressionIncludeConstant: checked }
          )
        }
      />
      {!logistic ? (
        <>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Missing values</Label>
            <PillToggle
              value={form.regressionMissingValues}
              onChange={regressionMissingValues =>
                setForm(f => ({ ...f, regressionMissingValues }))
              }
              options={[
                { value: 'listwise' as const, label: 'Exclude listwise' },
                { value: 'pairwise' as const, label: 'Exclude pairwise' },
              ]}
              aria-label="Missing values"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Residual plots</Label>
            <PillToggle
              value={form.regressionResidualPlots}
              onChange={regressionResidualPlots =>
                setForm(f => ({ ...f, regressionResidualPlots }))
              }
              options={[
                { value: 'none' as const, label: 'None' },
                { value: 'residuals_fitted' as const, label: 'Residuals vs fitted' },
                { value: 'qq' as const, label: 'Q-Q plot' },
                { value: 'both' as const, label: 'Both' },
              ]}
              aria-label="Residual plots"
            />
          </div>
          <CheckboxRow
            id="reg-collinearity"
            label="Collinearity diagnostics"
            checked={form.regressionCollinearity}
            onCheckedChange={regressionCollinearity =>
              setForm(f => ({ ...f, regressionCollinearity }))
            }
          />
        </>
      ) : (
        <>
          <NumericField
            label="Classification cutoff"
            value={form.logisticCutoff}
            onChange={logisticCutoff => setForm(f => ({ ...f, logisticCutoff }))}
            error={errors[WIZARD_FIELD.logisticCutoff]?.[0]}
          />
          <NumericField
            label="Maximum iterations"
            value={form.logisticMaxIterations}
            onChange={logisticMaxIterations => setForm(f => ({ ...f, logisticMaxIterations }))}
            error={errors[WIZARD_FIELD.logisticMaxIterations]?.[0]}
          />
          <CheckboxRow
            id="logistic-hl"
            label="Hosmer–Lemeshow goodness-of-fit test"
            checked={form.logisticHosmerLemeshow}
            onCheckedChange={logisticHosmerLemeshow =>
              setForm(f => ({ ...f, logisticHosmerLemeshow }))
            }
          />
        </>
      )}
    </div>
  );
}

function RegressionTabs(props: FormSliceProps & { logistic?: boolean }) {
  const showEntryMethod = props.form.analysis === 'linear_regression';
  return (
    <Tabs defaultValue="variables" className="w-full">
      <TabsList className="mb-4 grid w-full grid-cols-2">
        <TabsTrigger value="variables">Variables</TabsTrigger>
        <TabsTrigger value="options">Options</TabsTrigger>
      </TabsList>
      <TabsContent value="variables" className="mt-0">
        <RegressionVariablesTab {...props} />
      </TabsContent>
      <TabsContent value="options" className="mt-0">
        <RegressionOptionsTab {...props} showEntryMethod={showEntryMethod} />
      </TabsContent>
    </Tabs>
  );
}

export function ChiSquareForm({
  form,
  setForm,
  schema,
  allNames,
  notices,
  errors,
}: FormSliceProps) {
  return (
    <section className="space-y-3">
      <FormSectionLabel>Variables</FormSectionLabel>
      <ColumnSelect
        label="Row variable"
        value={form.chiA}
        onChange={chiA => setForm(f => ({ ...f, chiA }))}
        schema={schema}
        names={allNames}
        expectedType="categorical"
        errors={errors[WIZARD_FIELD.chiA]}
      />
      <ColumnSelect
        label="Column variable"
        value={form.chiB}
        onChange={chiB => setForm(f => ({ ...f, chiB }))}
        schema={schema}
        names={allNames}
        expectedType="categorical"
        notices={notices[WIZARD_FIELD.chiB]}
        errors={errors[WIZARD_FIELD.chiB]}
      />
      {form.analysis === 'chi_square' && (
        <>
          <FormSectionLabel>Association measures</FormSectionLabel>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.chiIncludePhi}
              onChange={e => setForm(f => ({ ...f, chiIncludePhi: e.target.checked }))}
            />
            Phi coefficient (2×2 tables)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.chiIncludeCramersV}
              onChange={e => setForm(f => ({ ...f, chiIncludeCramersV: e.target.checked }))}
            />
            Cramér&apos;s V
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.chiUseFishersExact}
              onChange={e => setForm(f => ({ ...f, chiUseFishersExact: e.target.checked }))}
            />
            Use Fisher&apos;s exact test (recommended for 2×2 tables with small expected counts)
          </label>
        </>
      )}
      {form.analysis === 'weighted_kappa' && (
        <label className="flex flex-col gap-1 text-sm">
          <span>Weight scheme</span>
          <select
            className="rounded border border-border bg-background px-2 py-1"
            value={form.kappaWeights}
            onChange={e =>
              setForm(f => ({ ...f, kappaWeights: e.target.value as 'linear' | 'quadratic' }))
            }
          >
            <option value="linear">Linear</option>
            <option value="quadratic">Quadratic</option>
          </select>
        </label>
      )}
    </section>
  );
}

export function CanonicalCorrelationForm({
  form,
  setForm,
  schema,
  notices,
  errors,
}: FormSliceProps) {
  return (
    <section className="space-y-3">
      <FormSectionLabel>Set 1 variables</FormSectionLabel>
      <MultiColumnPicker
        selected={form.selectedCols}
        onChange={selectedCols => setForm(f => ({ ...f, selectedCols }))}
        schema={schema}
        filterSlot="numeric"
        showTypeShortcuts
        minSelected={1}
        errors={errors[WIZARD_FIELD.columns]}
      />
      <FormSectionLabel>Set 2 variables</FormSectionLabel>
      <MultiColumnPicker
        selected={form.independentCols}
        onChange={independentCols => setForm(f => ({ ...f, independentCols }))}
        schema={schema}
        filterSlot="numeric"
        showTypeShortcuts
        minSelected={1}
        notices={notices[WIZARD_FIELD.independentCols]}
        errors={errors[WIZARD_FIELD.independentCols]}
      />
    </section>
  );
}

export function FriedmanForm({ form, setForm, schema, notices, errors }: FormSliceProps) {
  return (
    <section className="space-y-3">
      <FormSectionLabel>Repeated measures (3+)</FormSectionLabel>
      <MultiColumnPicker
        selected={form.selectedCols}
        onChange={selectedCols => setForm(f => ({ ...f, selectedCols }))}
        schema={schema}
        filterSlot="numeric"
        showTypeShortcuts
        minSelected={3}
        notices={notices[WIZARD_FIELD.columns]}
        errors={errors[WIZARD_FIELD.columns]}
      />
    </section>
  );
}

export function ReliabilityForm({ form, setForm, schema, notices, errors }: FormSliceProps) {
  return (
    <section className="space-y-3">
      <FormSectionLabel>Scale items</FormSectionLabel>
      <MultiColumnPicker
        selected={form.selectedCols}
        onChange={selectedCols => setForm(f => ({ ...f, selectedCols }))}
        schema={schema}
        filterSlot="numeric"
        showTypeShortcuts
        minSelected={2}
        notices={notices[WIZARD_FIELD.columns]}
        errors={errors[WIZARD_FIELD.columns]}
      />
    </section>
  );
}

export function KolmogorovSmirnovForm({
  form,
  setForm,
  schema,
  allNames,
  notices,
  errors,
}: FormSliceProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Test type</Label>
        <PillToggle
          value={form.ksTestType}
          onChange={ksTestType => setForm(f => ({ ...f, ksTestType }))}
          options={[
            { value: 'two_sample' as const, label: 'Two samples' },
            { value: 'normality' as const, label: 'Normality' },
          ]}
          aria-label="Kolmogorov-Smirnov test type"
        />
      </div>
      <ColumnSelect
        label={form.ksTestType === 'normality' ? 'Variable' : 'Sample 1'}
        value={form.pairedBeforeCol}
        onChange={pairedBeforeCol => setForm(f => ({ ...f, pairedBeforeCol }))}
        schema={schema}
        names={allNames}
        expectedType="numeric"
        notices={notices[WIZARD_FIELD.pairedVar1]}
        errors={errors[WIZARD_FIELD.pairedVar1]}
      />
      {form.ksTestType === 'two_sample' ? (
        <ColumnSelect
          label="Sample 2"
          value={form.pairedAfterCol}
          onChange={pairedAfterCol => setForm(f => ({ ...f, pairedAfterCol }))}
          schema={schema}
          names={allNames}
          expectedType="numeric"
          notices={notices[WIZARD_FIELD.pairedVar2]}
          errors={errors[WIZARD_FIELD.pairedVar2]}
        />
      ) : null}
    </section>
  );
}

export function PartialCorrelationForm({
  form,
  setForm,
  schema,
  allNames,
  notices,
  errors,
}: FormSliceProps) {
  return (
    <section className="space-y-4">
      <ColumnSelect
        label="Variable X"
        value={form.pairedBeforeCol}
        onChange={pairedBeforeCol => setForm(f => ({ ...f, pairedBeforeCol }))}
        schema={schema}
        names={allNames}
        expectedType="numeric"
        errors={errors[WIZARD_FIELD.pairedVar1]}
      />
      <ColumnSelect
        label="Variable Y"
        value={form.pairedAfterCol}
        onChange={pairedAfterCol => setForm(f => ({ ...f, pairedAfterCol }))}
        schema={schema}
        names={allNames}
        expectedType="numeric"
        errors={errors[WIZARD_FIELD.pairedVar2]}
      />
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Control variables</Label>
        <MultiColumnPicker
          selected={form.independentCols}
          onChange={independentCols => setForm(f => ({ ...f, independentCols }))}
          schema={schema}
          filterSlot="numeric"
          showTypeShortcuts
        />
      </div>
      <PillToggle
        value={form.correlationMethod}
        onChange={correlationMethod => setForm(f => ({ ...f, correlationMethod }))}
        options={CORRELATION_OPTIONS}
        aria-label="Correlation method"
      />
    </section>
  );
}

export function PcaForm({ form, setForm, schema, notices, errors }: FormSliceProps) {
  return (
    <section className="space-y-3">
      <FormSectionLabel>Variables</FormSectionLabel>
      <MultiColumnPicker
        selected={form.selectedCols}
        onChange={selectedCols => setForm(f => ({ ...f, selectedCols }))}
        schema={schema}
        filterSlot="numeric"
        showTypeShortcuts
        minSelected={2}
        errors={errors[WIZARD_FIELD.columns]}
      />
      <NumericField
        label="Number of components (optional)"
        value={form.pcaNComponents}
        onChange={pcaNComponents => setForm(f => ({ ...f, pcaNComponents }))}
        hint="Leave blank to extract all components (up to the number of variables)."
      />
    </section>
  );
}

export function EfaForm(props: FormSliceProps) {
  const { form, setForm, schema, errors } = props;
  return (
    <section className="space-y-3">
      <FormSectionLabel>Variables</FormSectionLabel>
      <MultiColumnPicker
        selected={form.selectedCols}
        onChange={selectedCols => setForm(f => ({ ...f, selectedCols }))}
        schema={schema}
        filterSlot="numeric"
        showTypeShortcuts
        minSelected={2}
        errors={errors[WIZARD_FIELD.columns]}
      />
      <NumericField
        label="Number of factors (optional)"
        value={form.pcaNComponents}
        onChange={pcaNComponents => setForm(f => ({ ...f, pcaNComponents }))}
        hint="Leave blank for an automatic factor count (up to five)."
      />
    </section>
  );
}

export function ClusterForm({ form, setForm, schema, errors }: FormSliceProps) {
  return (
    <section className="space-y-3">
      <FormSectionLabel>Clustering variables</FormSectionLabel>
      <MultiColumnPicker
        selected={form.selectedCols}
        onChange={selectedCols => setForm(f => ({ ...f, selectedCols }))}
        schema={schema}
        filterSlot="numeric"
        showTypeShortcuts
        minSelected={1}
        errors={errors[WIZARD_FIELD.columns]}
      />
      <PillToggle
        value={form.clusterMethod}
        onChange={clusterMethod => setForm(f => ({ ...f, clusterMethod }))}
        options={[
          { value: 'kmeans', label: 'K-means' },
          { value: 'hierarchical', label: 'Hierarchical' },
        ]}
        aria-label="Cluster method"
      />
      <NumericField
        label="Number of clusters"
        value={form.pcaNComponents || '3'}
        onChange={pcaNComponents => setForm(f => ({ ...f, pcaNComponents }))}
      />
      <CheckboxRow
        id="cluster-standardize"
        label="Standardize variables before clustering"
        checked={form.clusterStandardize}
        onCheckedChange={clusterStandardize => setForm(f => ({ ...f, clusterStandardize }))}
      />
    </section>
  );
}

export function DiscriminantForm({ form, setForm, schema, allNames, errors }: FormSliceProps) {
  return (
    <section className="space-y-3">
      <ColumnSelect
        label="Grouping variable"
        value={form.groupCol}
        onChange={groupCol => setForm(f => ({ ...f, groupCol }))}
        schema={schema}
        names={allNames}
        expectedType="categorical"
        errors={errors[WIZARD_FIELD.groupCol]}
      />
      <FormSectionLabel>Predictors</FormSectionLabel>
      <MultiColumnPicker
        selected={form.selectedCols}
        onChange={selectedCols => setForm(f => ({ ...f, selectedCols }))}
        schema={schema}
        filterSlot="numeric"
        showTypeShortcuts
        minSelected={1}
        errors={errors[WIZARD_FIELD.columns]}
      />
    </section>
  );
}

export function ManovaForm({ form, setForm, schema, allNames, errors }: FormSliceProps) {
  return (
    <section className="space-y-3">
      <ColumnSelect
        label="Grouping variable"
        value={form.groupCol}
        onChange={groupCol => setForm(f => ({ ...f, groupCol }))}
        schema={schema}
        names={allNames}
        expectedType="categorical"
        errors={errors[WIZARD_FIELD.groupCol]}
      />
      <FormSectionLabel>Dependent variables (2+)</FormSectionLabel>
      <MultiColumnPicker
        selected={form.selectedCols}
        onChange={selectedCols => setForm(f => ({ ...f, selectedCols }))}
        schema={schema}
        filterSlot="numeric"
        showTypeShortcuts
        minSelected={2}
        errors={errors[WIZARD_FIELD.columns]}
      />
    </section>
  );
}

export function AncovaForm({ form, setForm, schema, allNames, errors }: FormSliceProps) {
  return (
    <section className="space-y-3">
      <ColumnSelect
        label="Grouping variable"
        value={form.groupCol}
        onChange={groupCol => setForm(f => ({ ...f, groupCol }))}
        schema={schema}
        names={allNames}
        expectedType="categorical"
        errors={errors[WIZARD_FIELD.groupCol]}
      />
      <ColumnSelect
        label="Dependent variable"
        value={form.valueCol}
        onChange={valueCol => setForm(f => ({ ...f, valueCol }))}
        schema={schema}
        names={allNames}
        expectedType="numeric"
        errors={errors[WIZARD_FIELD.valueCol]}
      />
      <ColumnSelect
        label="Covariate"
        value={form.covariateCol}
        onChange={covariateCol => setForm(f => ({ ...f, covariateCol }))}
        schema={schema}
        names={allNames}
        expectedType="numeric"
        errors={errors[WIZARD_FIELD.depCol]}
      />
      <CheckboxRow
        id="ancova-interaction"
        label="Include group × covariate interaction"
        checked={form.anovaInteraction}
        onCheckedChange={anovaInteraction => setForm(f => ({ ...f, anovaInteraction }))}
      />
    </section>
  );
}

export function DecisionTreeForm({ form, setForm, schema, allNames, errors }: FormSliceProps) {
  return (
    <section className="space-y-3">
      <ColumnSelect
        label="Outcome (categorical)"
        value={form.depCol}
        onChange={depCol => setForm(f => ({ ...f, depCol }))}
        schema={schema}
        names={allNames}
        expectedType="categorical"
        errors={errors[WIZARD_FIELD.depCol]}
      />
      <FormSectionLabel>Predictors</FormSectionLabel>
      <MultiColumnPicker
        selected={form.independentCols}
        onChange={independentCols => setForm(f => ({ ...f, independentCols }))}
        schema={schema}
        filterSlot="numeric"
        showTypeShortcuts
        minSelected={1}
        errors={errors[WIZARD_FIELD.independentCols]}
      />
      <NumericField
        label="Maximum tree depth (optional)"
        value={form.treeMaxDepth}
        onChange={treeMaxDepth => setForm(f => ({ ...f, treeMaxDepth }))}
        hint="Leave blank for an unrestricted tree."
      />
    </section>
  );
}

export function MlClassificationForm({ form, setForm, schema, allNames, errors }: FormSliceProps) {
  return (
    <section className="space-y-3">
      <ColumnSelect
        label="Target (categorical)"
        value={form.depCol}
        onChange={depCol => setForm(f => ({ ...f, depCol }))}
        schema={schema}
        names={allNames}
        expectedType="categorical"
        errors={errors[WIZARD_FIELD.depCol]}
      />
      <FormSectionLabel>Features</FormSectionLabel>
      <MultiColumnPicker
        selected={form.independentCols}
        onChange={independentCols => setForm(f => ({ ...f, independentCols }))}
        schema={schema}
        filterSlot="numeric"
        showTypeShortcuts
        minSelected={1}
        errors={errors[WIZARD_FIELD.independentCols]}
      />
    </section>
  );
}

export function MlRegressionForm({ form, setForm, schema, allNames, errors }: FormSliceProps) {
  return (
    <section className="space-y-3">
      <ColumnSelect
        label="Target (numeric)"
        value={form.depCol}
        onChange={depCol => setForm(f => ({ ...f, depCol }))}
        schema={schema}
        names={allNames}
        expectedType="numeric"
        errors={errors[WIZARD_FIELD.depCol]}
      />
      <FormSectionLabel>Features</FormSectionLabel>
      <MultiColumnPicker
        selected={form.independentCols}
        onChange={independentCols => setForm(f => ({ ...f, independentCols }))}
        schema={schema}
        filterSlot="numeric"
        showTypeShortcuts
        minSelected={1}
        errors={errors[WIZARD_FIELD.independentCols]}
      />
    </section>
  );
}

export function MlModeForm({ form, setForm, schema, allNames, errors }: FormSliceProps) {
  const isRegression = form.mlMode === 'regression';
  return (
    <section className="space-y-3">
      <PillToggle
        value={form.mlMode}
        onChange={mlMode => setForm(f => ({ ...f, mlMode }))}
        options={[
          { value: 'classification', label: 'Classification' },
          { value: 'regression', label: 'Regression' },
        ]}
        aria-label="Model mode"
      />
      <ColumnSelect
        label={isRegression ? 'Target (numeric)' : 'Target (categorical)'}
        value={form.depCol}
        onChange={depCol => setForm(f => ({ ...f, depCol }))}
        schema={schema}
        names={allNames}
        expectedType={isRegression ? 'numeric' : 'categorical'}
        errors={errors[WIZARD_FIELD.depCol]}
      />
      <FormSectionLabel>Features</FormSectionLabel>
      <MultiColumnPicker
        selected={form.independentCols}
        onChange={independentCols => setForm(f => ({ ...f, independentCols }))}
        schema={schema}
        filterSlot="numeric"
        showTypeShortcuts
        minSelected={1}
        errors={errors[WIZARD_FIELD.independentCols]}
      />
    </section>
  );
}

export function DbscanForm({ form, setForm, schema, errors }: FormSliceProps) {
  return (
    <section className="space-y-3">
      <FormSectionLabel>Feature variables</FormSectionLabel>
      <MultiColumnPicker
        selected={form.selectedCols}
        onChange={selectedCols => setForm(f => ({ ...f, selectedCols }))}
        schema={schema}
        filterSlot="numeric"
        showTypeShortcuts
        minSelected={1}
        errors={errors[WIZARD_FIELD.columns]}
      />
      <NumericField
        label="Epsilon (neighborhood radius)"
        value={form.dbscanEpsilon}
        onChange={dbscanEpsilon => setForm(f => ({ ...f, dbscanEpsilon }))}
      />
      <NumericField
        label="Minimum samples"
        value={form.dbscanMinSamples}
        onChange={dbscanMinSamples => setForm(f => ({ ...f, dbscanMinSamples }))}
      />
      <CheckboxRow
        id="dbscan-standardize"
        label="Standardize features before clustering"
        checked={form.clusterStandardize}
        onCheckedChange={clusterStandardize => setForm(f => ({ ...f, clusterStandardize }))}
      />
    </section>
  );
}

function TimeSeriesTargetFields({
  form,
  setForm,
  schema,
  allNames,
  errors,
  showForecast,
  showPeriod,
  showMaxLags,
  requireDate,
}: FormSliceProps & {
  showForecast?: boolean;
  showPeriod?: boolean;
  showMaxLags?: boolean;
  requireDate?: boolean;
}) {
  return (
    <>
      <ColumnSelect
        label="Target variable (numeric)"
        value={form.valueCol}
        onChange={valueCol => setForm(f => ({ ...f, valueCol }))}
        schema={schema}
        names={allNames}
        expectedType="numeric"
        errors={errors[WIZARD_FIELD.valueCol]}
      />
      <ColumnSelect
        label={requireDate ? 'Date / time column' : 'Date / time column (optional)'}
        value={form.dateCol}
        onChange={dateCol => setForm(f => ({ ...f, dateCol }))}
        schema={schema}
        names={allNames}
        expectedType="date/time"
        errors={errors[WIZARD_FIELD.dateCol]}
      />
      {showPeriod ? (
        <NumericField
          label="Seasonal period"
          value={form.seasonalPeriod}
          onChange={seasonalPeriod => setForm(f => ({ ...f, seasonalPeriod }))}
          error={errors[WIZARD_FIELD.seasonalPeriod]?.[0]}
        />
      ) : null}
      {showForecast ? (
        <NumericField
          label="Forecast steps"
          value={form.forecastSteps}
          onChange={forecastSteps => setForm(f => ({ ...f, forecastSteps }))}
          error={errors[WIZARD_FIELD.forecastSteps]?.[0]}
        />
      ) : null}
      {showMaxLags ? (
        <NumericField
          label="Maximum lags"
          value={form.acfMaxLags}
          onChange={acfMaxLags => setForm(f => ({ ...f, acfMaxLags }))}
          error={errors[WIZARD_FIELD.acfMaxLags]?.[0]}
        />
      ) : null}
    </>
  );
}

export function TimeSeriesForecastForm(props: FormSliceProps) {
  return (
    <section className="space-y-3">
      <TimeSeriesTargetFields {...props} showForecast showPeriod />
    </section>
  );
}

export function StlDecompositionForm(props: FormSliceProps) {
  return (
    <section className="space-y-3">
      <TimeSeriesTargetFields {...props} showPeriod />
    </section>
  );
}

export function StationarityTestsForm(props: FormSliceProps) {
  return (
    <section className="space-y-3">
      <TimeSeriesTargetFields {...props} />
    </section>
  );
}

export function AutocorrelationForm(props: FormSliceProps) {
  return (
    <section className="space-y-3">
      <TimeSeriesTargetFields {...props} showMaxLags />
    </section>
  );
}

export function KaplanMeierForm({ form, setForm, schema, allNames, errors }: FormSliceProps) {
  return (
    <section className="space-y-3">
      <ColumnSelect
        label="Duration column"
        value={form.durationCol}
        onChange={durationCol => setForm(f => ({ ...f, durationCol }))}
        schema={schema}
        names={allNames}
        expectedType="numeric"
        errors={errors[WIZARD_FIELD.durationCol]}
      />
      <ColumnSelect
        label="Event column (1 = event, 0 = censored)"
        value={form.eventCol}
        onChange={eventCol => setForm(f => ({ ...f, eventCol }))}
        schema={schema}
        names={allNames}
        expectedType="numeric"
        errors={errors[WIZARD_FIELD.eventCol]}
      />
      <ColumnSelect
        label="Grouping variable (optional)"
        value={form.groupCol}
        onChange={groupCol => setForm(f => ({ ...f, groupCol }))}
        schema={schema}
        names={allNames}
        expectedType="categorical"
        errors={errors[WIZARD_FIELD.groupCol]}
      />
    </section>
  );
}

export function CoxProportionalHazardsForm({
  form,
  setForm,
  schema,
  allNames,
  errors,
}: FormSliceProps) {
  return (
    <section className="space-y-3">
      <ColumnSelect
        label="Duration column"
        value={form.durationCol}
        onChange={durationCol => setForm(f => ({ ...f, durationCol }))}
        schema={schema}
        names={allNames}
        expectedType="numeric"
        errors={errors[WIZARD_FIELD.durationCol]}
      />
      <ColumnSelect
        label="Event column (1 = event, 0 = censored)"
        value={form.eventCol}
        onChange={eventCol => setForm(f => ({ ...f, eventCol }))}
        schema={schema}
        names={allNames}
        expectedType="numeric"
        errors={errors[WIZARD_FIELD.eventCol]}
      />
      <FormSectionLabel>Covariates</FormSectionLabel>
      <MultiColumnPicker
        selected={form.independentCols}
        onChange={independentCols => setForm(f => ({ ...f, independentCols }))}
        schema={schema}
        filterSlot="numeric"
        showTypeShortcuts
        minSelected={1}
        errors={errors[WIZARD_FIELD.independentCols]}
      />
    </section>
  );
}

export function NelsonAalenForm({ form, setForm, schema, allNames, errors }: FormSliceProps) {
  return (
    <section className="space-y-3">
      <ColumnSelect
        label="Duration column"
        value={form.durationCol}
        onChange={durationCol => setForm(f => ({ ...f, durationCol }))}
        schema={schema}
        names={allNames}
        expectedType="numeric"
        errors={errors[WIZARD_FIELD.durationCol]}
      />
      <ColumnSelect
        label="Event column (1 = event, 0 = censored)"
        value={form.eventCol}
        onChange={eventCol => setForm(f => ({ ...f, eventCol }))}
        schema={schema}
        names={allNames}
        expectedType="numeric"
        errors={errors[WIZARD_FIELD.eventCol]}
      />
    </section>
  );
}

export function MixedModelForm({ form, setForm, schema, allNames, errors }: FormSliceProps) {
  return (
    <section className="space-y-3">
      <ColumnSelect
        label="Dependent variable (numeric)"
        value={form.depCol}
        onChange={depCol => setForm(f => ({ ...f, depCol }))}
        schema={schema}
        names={allNames}
        expectedType="numeric"
        errors={errors[WIZARD_FIELD.depCol]}
      />
      <ColumnSelect
        label="Grouping variable"
        value={form.groupCol}
        onChange={groupCol => setForm(f => ({ ...f, groupCol }))}
        schema={schema}
        names={allNames}
        expectedType="categorical"
        errors={errors[WIZARD_FIELD.groupCol]}
      />
      <FormSectionLabel>Fixed effects</FormSectionLabel>
      <MultiColumnPicker
        selected={form.independentCols}
        onChange={independentCols => setForm(f => ({ ...f, independentCols }))}
        schema={schema}
        filterSlot="numeric"
        showTypeShortcuts
        minSelected={1}
        errors={errors[WIZARD_FIELD.independentCols]}
      />
    </section>
  );
}

export function GlmmForm({ form, setForm, schema, allNames, errors }: FormSliceProps) {
  return (
    <section className="space-y-3">
      <PillToggle
        value={form.glmmFamily}
        onChange={glmmFamily => setForm(f => ({ ...f, glmmFamily }))}
        options={[
          { value: 'binomial', label: 'Binomial' },
          { value: 'poisson', label: 'Poisson' },
        ]}
        aria-label="GLMM family"
      />
      <ColumnSelect
        label={form.glmmFamily === 'poisson' ? 'Dependent (count)' : 'Dependent (binary)'}
        value={form.depCol}
        onChange={depCol => setForm(f => ({ ...f, depCol }))}
        schema={schema}
        names={allNames}
        expectedType={form.glmmFamily === 'poisson' ? 'numeric' : 'categorical'}
        errors={errors[WIZARD_FIELD.depCol]}
      />
      <ColumnSelect
        label="Grouping variable"
        value={form.groupCol}
        onChange={groupCol => setForm(f => ({ ...f, groupCol }))}
        schema={schema}
        names={allNames}
        expectedType="categorical"
        errors={errors[WIZARD_FIELD.groupCol]}
      />
      <FormSectionLabel>Fixed effects</FormSectionLabel>
      <MultiColumnPicker
        selected={form.independentCols}
        onChange={independentCols => setForm(f => ({ ...f, independentCols }))}
        schema={schema}
        filterSlot="numeric"
        showTypeShortcuts
        minSelected={1}
        errors={errors[WIZARD_FIELD.independentCols]}
      />
    </section>
  );
}

export function MultilevelForm({ form, setForm, schema, allNames, errors }: FormSliceProps) {
  return (
    <section className="space-y-3">
      <ColumnSelect
        label="Outcome (level 1)"
        value={form.valueCol}
        onChange={valueCol => setForm(f => ({ ...f, valueCol }))}
        schema={schema}
        names={allNames}
        expectedType="numeric"
        errors={errors[WIZARD_FIELD.valueCol]}
      />
      <ColumnSelect
        label="Level-2 grouping variable"
        value={form.groupCol}
        onChange={groupCol => setForm(f => ({ ...f, groupCol }))}
        schema={schema}
        names={allNames}
        expectedType="categorical"
        errors={errors[WIZARD_FIELD.groupCol]}
      />
      <FormSectionLabel>Level-1 predictors</FormSectionLabel>
      <MultiColumnPicker
        selected={form.independentCols}
        onChange={independentCols => setForm(f => ({ ...f, independentCols }))}
        schema={schema}
        filterSlot="numeric"
        showTypeShortcuts
        minSelected={1}
        errors={errors[WIZARD_FIELD.independentCols]}
      />
    </section>
  );
}

export function LcaForm({ form, setForm, schema, errors }: FormSliceProps) {
  return (
    <section className="space-y-3">
      <FormSectionLabel>Indicator variables</FormSectionLabel>
      <MultiColumnPicker
        selected={form.selectedCols}
        onChange={selectedCols => setForm(f => ({ ...f, selectedCols }))}
        schema={schema}
        showTypeShortcuts
        minSelected={1}
        errors={errors[WIZARD_FIELD.columns]}
      />
      <NumericField
        label="Number of classes"
        value={form.pcaNComponents || '2'}
        onChange={pcaNComponents => setForm(f => ({ ...f, pcaNComponents }))}
      />
    </section>
  );
}

function SemModelSpecField({
  form,
  setForm,
}: {
  form: FormSliceProps['form'];
  setForm: FormSliceProps['setForm'];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FormSectionLabel>Model specification (semopy syntax)</FormSectionLabel>
      <textarea
        className="min-h-[120px] w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
        value={form.semModelSpec}
        onChange={e => setForm(f => ({ ...f, semModelSpec: e.target.value }))}
        spellCheck={false}
      />
    </div>
  );
}

export function CfaForm({ form, setForm, schema, errors }: FormSliceProps) {
  return (
    <section className="space-y-3">
      <FormSectionLabel>Indicators</FormSectionLabel>
      <MultiColumnPicker
        selected={form.selectedCols}
        onChange={selectedCols => setForm(f => ({ ...f, selectedCols }))}
        schema={schema}
        filterSlot="numeric"
        showTypeShortcuts
        minSelected={2}
        errors={errors[WIZARD_FIELD.columns]}
      />
      <SemModelSpecField form={form} setForm={setForm} />
    </section>
  );
}

export function SemForm({ form, setForm, schema, errors }: FormSliceProps) {
  return (
    <section className="space-y-3">
      <SemModelSpecField form={form} setForm={setForm} />
      <FormSectionLabel>Observed variables (optional)</FormSectionLabel>
      <MultiColumnPicker
        selected={form.selectedCols}
        onChange={selectedCols => setForm(f => ({ ...f, selectedCols }))}
        schema={schema}
        showTypeShortcuts
        errors={errors[WIZARD_FIELD.columns]}
      />
    </section>
  );
}

export function TwoWayAnovaForm({
  form,
  setForm,
  schema,
  allNames,
  notices,
  errors,
}: FormSliceProps) {
  return (
    <section className="space-y-3">
      <GroupNumericForm
        form={form}
        setForm={setForm}
        schema={schema}
        allNames={allNames}
        notices={notices}
        errors={errors}
        outcomeLabel="Dependent variable"
        groupingLabel="Factor A"
      />
      <ColumnSelect
        label="Factor B"
        value={form.factorBCol}
        onChange={factorBCol => setForm(f => ({ ...f, factorBCol }))}
        schema={schema}
        names={allNames}
        expectedType="categorical"
        errors={errors[WIZARD_FIELD.groupCol]}
      />
      <CheckboxRow
        id="anova-interaction"
        label="Include A × B interaction"
        checked={form.anovaInteraction}
        onCheckedChange={anovaInteraction => setForm(f => ({ ...f, anovaInteraction }))}
      />
    </section>
  );
}

export function RepeatedMeasuresAnovaForm({
  form,
  setForm,
  schema,
  allNames,
  notices,
  errors,
}: FormSliceProps) {
  return (
    <section className="space-y-3">
      <ColumnSelect
        label="Subject ID"
        value={form.subjectCol}
        onChange={subjectCol => setForm(f => ({ ...f, subjectCol }))}
        schema={schema}
        names={allNames}
        expectedType="categorical"
        errors={errors[WIZARD_FIELD.groupCol]}
      />
      <FormSectionLabel>Repeated measures (2+)</FormSectionLabel>
      <MultiColumnPicker
        selected={form.selectedCols}
        onChange={selectedCols => setForm(f => ({ ...f, selectedCols }))}
        schema={schema}
        filterSlot="numeric"
        showTypeShortcuts
        minSelected={2}
        errors={errors[WIZARD_FIELD.columns]}
      />
    </section>
  );
}

export function ThreeWayAnovaForm({
  form,
  setForm,
  schema,
  allNames,
  notices,
  errors,
}: FormSliceProps) {
  return (
    <section className="space-y-3">
      <TwoWayAnovaForm
        form={form}
        setForm={setForm}
        schema={schema}
        allNames={allNames}
        notices={notices}
        errors={errors}
      />
      <ColumnSelect
        label="Factor C"
        value={form.factorCCol}
        onChange={factorCCol => setForm(f => ({ ...f, factorCCol }))}
        schema={schema}
        names={allNames}
        expectedType="categorical"
      />
    </section>
  );
}

export function MixedAnovaForm({
  form,
  setForm,
  schema,
  allNames,
  notices,
  errors,
}: FormSliceProps) {
  return (
    <section className="space-y-3">
      <ColumnSelect
        label="Subject ID"
        value={form.subjectCol}
        onChange={subjectCol => setForm(f => ({ ...f, subjectCol }))}
        schema={schema}
        names={allNames}
        expectedType="categorical"
        errors={errors[WIZARD_FIELD.groupCol]}
      />
      <ColumnSelect
        label="Between-subjects factor"
        value={form.groupCol}
        onChange={groupCol => setForm(f => ({ ...f, groupCol }))}
        schema={schema}
        names={allNames}
        expectedType="categorical"
      />
      <FormSectionLabel>Within-subject measures (2+)</FormSectionLabel>
      <MultiColumnPicker
        selected={form.selectedCols}
        onChange={selectedCols => setForm(f => ({ ...f, selectedCols }))}
        schema={schema}
        filterSlot="numeric"
        minSelected={2}
        errors={errors[WIZARD_FIELD.columns]}
      />
    </section>
  );
}

export function ModerationForm({ form, setForm, schema, allNames, errors }: FormSliceProps) {
  return (
    <section className="space-y-3">
      <ColumnSelect
        label="Outcome (Y)"
        value={form.depCol}
        onChange={depCol => setForm(f => ({ ...f, depCol }))}
        schema={schema}
        names={allNames}
        expectedType="numeric"
        errors={errors[WIZARD_FIELD.depCol]}
      />
      <ColumnSelect
        label="Predictor (X)"
        value={form.valueCol}
        onChange={valueCol => setForm(f => ({ ...f, valueCol }))}
        schema={schema}
        names={allNames}
        expectedType="numeric"
        errors={errors[WIZARD_FIELD.valueCol]}
      />
      <ColumnSelect
        label="Moderator (M)"
        value={form.groupCol}
        onChange={groupCol => setForm(f => ({ ...f, groupCol }))}
        schema={schema}
        names={allNames}
        errors={errors[WIZARD_FIELD.groupCol]}
      />
    </section>
  );
}

export function HierarchicalRegressionForm({
  form,
  setForm,
  schema,
  allNames,
  errors,
}: FormSliceProps) {
  return (
    <section className="space-y-3">
      <ColumnSelect
        label="Dependent variable"
        value={form.depCol}
        onChange={depCol => setForm(f => ({ ...f, depCol }))}
        schema={schema}
        names={allNames}
        expectedType="numeric"
        errors={errors[WIZARD_FIELD.depCol]}
      />
      <FormSectionLabel>Block 1 predictors</FormSectionLabel>
      <MultiColumnPicker
        selected={form.independentCols}
        onChange={independentCols => setForm(f => ({ ...f, independentCols }))}
        schema={schema}
        filterSlot="numeric"
        minSelected={1}
        errors={errors[WIZARD_FIELD.independentCols]}
      />
      <FormSectionLabel>Block 2 predictors (optional)</FormSectionLabel>
      <MultiColumnPicker
        selected={form.selectedCols}
        onChange={selectedCols => setForm(f => ({ ...f, selectedCols }))}
        schema={schema}
        filterSlot="numeric"
      />
    </section>
  );
}

export function TrendTestForm({ form, setForm, schema, allNames, errors }: FormSliceProps) {
  return (
    <section className="space-y-3">
      <ColumnSelect
        label="Ordered group (exposure)"
        value={form.groupCol}
        onChange={groupCol => setForm(f => ({ ...f, groupCol }))}
        schema={schema}
        names={allNames}
        expectedType="categorical"
        errors={errors[WIZARD_FIELD.groupCol]}
      />
      <ColumnSelect
        label="Binary outcome"
        value={form.valueCol}
        onChange={valueCol => setForm(f => ({ ...f, valueCol }))}
        schema={schema}
        names={allNames}
        errors={errors[WIZARD_FIELD.valueCol]}
      />
    </section>
  );
}

export function renderAnalysisForm(analysis: AnalysisKey, props: FormSliceProps): React.ReactNode {
  switch (analysis) {
    case 'descriptives':
      return <DescriptivesForm {...props} />;
    case 'correlation':
      return <CorrelationForm {...props} />;
    case 'ttest_independent':
      return <IndependentTTestForm {...props} />;
    case 'anova_oneway':
      return <AnovaForm {...props} />;
    case 'ttest_paired':
      return <PairedTTestForm {...props} />;
    case 'ttest_one_sample':
      return <OneSampleTTestForm {...props} />;
    case 'linear_regression':
      return <RegressionTabs {...props} />;
    case 'logistic_regression':
      return <RegressionTabs {...props} logistic />;
    case 'chi_square':
      return <ChiSquareForm {...props} />;
    case 'mann_whitney_u':
      return (
        <GroupNumericForm
          {...props}
          outcomeFirst
          outcomeLabel="Test variable"
          groupingLabel="Grouping variable"
        />
      );
    case 'kruskal_wallis':
      return <KruskalWallisForm {...props} />;
    case 'wilcoxon_signed_rank':
      return <PairedTTestForm {...props} />;
    case 'friedman':
      return <FriedmanForm {...props} />;
    case 'kolmogorov_smirnov':
      return <KolmogorovSmirnovForm {...props} />;
    case 'reliability_cronbach':
      return <ReliabilityForm {...props} />;
    case 'partial_correlation':
      return <PartialCorrelationForm {...props} />;
    case 'pca':
      return <PcaForm {...props} />;
    case 'anova_twoway':
      return <TwoWayAnovaForm {...props} />;
    case 'anova_repeated':
      return <RepeatedMeasuresAnovaForm {...props} />;
    case 'poisson_regression':
      return <RegressionTabs {...props} />;
    case 'cohens_kappa':
    case 'fishers_exact':
    case 'odds_ratio':
    case 'relative_risk':
    case 'goodman_kruskal_gamma':
    case 'somers_d':
    case 'goodman_kruskal_lambda':
    case 'weighted_kappa':
      return <ChiSquareForm {...props} />;
    case 'fleiss_kappa':
    case 'kendalls_w':
      return <FriedmanForm {...props} />;
    case 'mantel_haenszel':
    case 'cochran_armitage':
      return <TrendTestForm {...props} />;
    case 'loglinear':
      return <ReliabilityForm {...props} />;
    case 'hierarchical_regression':
      return <HierarchicalRegressionForm {...props} />;
    case 'anova_mixed':
      return <MixedAnovaForm {...props} />;
    case 'anova_threeway':
      return <ThreeWayAnovaForm {...props} />;
    case 'moderation_analysis':
      return <ModerationForm {...props} />;
    case 'efa':
      return <EfaForm {...props} />;
    case 'cluster_analysis':
      return <ClusterForm {...props} />;
    case 'discriminant_analysis':
      return <DiscriminantForm {...props} />;
    case 'manova':
      return <ManovaForm {...props} />;
    case 'ancova':
      return <AncovaForm {...props} />;
    case 'decision_tree':
      return <DecisionTreeForm {...props} />;
    case 'random_forest_classification':
    case 'svm_classification':
      return <MlClassificationForm {...props} />;
    case 'random_forest_regression':
      return <MlRegressionForm {...props} />;
    case 'gradient_boosting':
    case 'neural_network_mlp':
      return <MlModeForm {...props} />;
    case 'dbscan':
      return <DbscanForm {...props} />;
    case 'arima_sarima':
    case 'exponential_smoothing':
      return <TimeSeriesForecastForm {...props} />;
    case 'stl_decomposition':
      return <StlDecompositionForm {...props} />;
    case 'stationarity_tests':
      return <StationarityTestsForm {...props} />;
    case 'autocorrelation':
      return <AutocorrelationForm {...props} />;
    case 'kaplan_meier':
      return <KaplanMeierForm {...props} />;
    case 'cox_proportional_hazards':
      return <CoxProportionalHazardsForm {...props} />;
    case 'nelson_aalen':
      return <NelsonAalenForm {...props} />;
    case 'linear_mixed_model':
      return <MixedModelForm {...props} />;
    case 'generalized_linear_mixed_model':
      return <GlmmForm {...props} />;
    case 'multilevel_modelling':
      return <MultilevelForm {...props} />;
    case 'latent_class_analysis':
      return <LcaForm {...props} />;
    case 'confirmatory_factor_analysis':
      return <CfaForm {...props} />;
    case 'structural_equation_modelling':
      return <SemForm {...props} />;
    case 'shapiro_wilk':
    case 'lilliefors_ks':
      return <OneSampleTTestForm {...props} hideHypothesizedMean />;
    case 'sign_test':
      return <PairedTTestForm {...props} />;
    case 'probit_regression':
    case 'negative_binomial_regression':
      return <RegressionTabs {...props} logistic={props.form.analysis === 'probit_regression'} />;
    case 'ordinal_regression':
      return <RegressionTabs {...props} />;
    case 'median_test':
    case 'jonckheere_terpstra':
    case 'moses_test':
      return (
        <GroupNumericForm
          {...props}
          outcomeFirst
          outcomeLabel="Test variable"
          groupingLabel="Grouping variable"
        />
      );
    case 'runs_test':
      return <OneSampleTTestForm {...props} hideHypothesizedMean />;
    case 'cochrans_q':
      return <FriedmanForm {...props} />;
    case 'canonical_correlation':
      return <CanonicalCorrelationForm {...props} />;
    case 'multidimensional_scaling':
      return <PcaForm {...props} />;
    case 'hotelling_t2':
      return <ManovaForm {...props} />;
    default:
      return null;
  }
}
