'use client';

import * as React from 'react';
import type { AnalysisFormState, AnalysisKey } from '@/lib/analysis-definitions';
import type { SchemaColumn } from '@/lib/analysis-report-types';
import {
  SpssDialogLayout,
  MissingValuesOptions,
} from '@/components/molecules/analysis-dialog/spss-dialog-layout';
import type { WizardFieldErrorsMap, WizardFieldNoticesMap } from '@/lib/analysis-setup-validation';

export type FormSliceProps = {
  form: AnalysisFormState;
  setForm: React.Dispatch<React.SetStateAction<AnalysisFormState>>;
  schema: SchemaColumn[];
  allNames: string[];
  notices: WizardFieldNoticesMap;
  errors: WizardFieldErrorsMap;
  tukeyBlocked?: boolean;
};

type SpssWrapOptions = {
  statistics?: React.ReactNode;
  optionsExtra?: React.ReactNode;
  useMissingToggle?: boolean;
  missingField?: 'anovaMissingValues' | 'regressionMissingValues';
};

export function wrapSpssForm(
  props: FormSliceProps,
  slots: { id: string; label: string; children: React.ReactNode }[],
  opts?: SpssWrapOptions
) {
  const { form, setForm } = props;
  const missingKey = opts?.missingField ?? 'anovaMissingValues';
  const mv = form[missingKey] as 'listwise' | 'pairwise';

  return (
    <SpssDialogLayout
      variables={props.schema}
      slots={slots}
      statisticsDialog={opts?.statistics ?? undefined}
      optionsDialog={
        <div className="space-y-3">
          {opts?.useMissingToggle !== false ? (
            <MissingValuesOptions
              value={mv}
              onChange={v => setForm(f => ({ ...f, [missingKey]: v }))}
            />
          ) : null}
          {opts?.optionsExtra}
        </div>
      }
    />
  );
}
