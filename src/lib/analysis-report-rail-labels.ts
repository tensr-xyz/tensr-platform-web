import { specFor } from '@/lib/analysis-spec-setup';

/** Role words the rail already used before specs loaded. Spec labels win. */
const ROLE_LABELS: Record<string, string> = {
  dependent_variable: 'DV',
  dependent: 'DV',
  dependent_var: 'DV',
  dv: 'DV',
  outcome: 'DV',
  y: 'DV',
  value_column: 'Test variable',
  independent_variable: 'Factor',
  independent_var: 'Factor',
  independents: 'Factor',
  factor: 'Factor',
  group: 'Factor',
  group_column: 'Grouping variable',
  x: 'Factor',
  predictor: 'Predictor',
  covariate: 'Covariate',
  stub_column: 'Rows',
  stub_columns: 'Rows',
  stubs: 'Rows',
  banner_column: 'Columns',
  banner: 'Columns',
  weight: 'Weight',
  weight_column: 'Weight',
  column_a: 'Row variable',
  column_b: 'Column variable',
  include_phi: 'Phi',
  include_cramers_v: "Cramér's V",
  use_fishers_exact: "Fisher's exact test",
  method: 'Method',
  tail: 'Tail',
};

/** A label that is only the parameter name, or that name with underscores turned into spaces. */
export function isRawParamLabel(name: string, label: string): boolean {
  const shown = label.trim();
  if (!shown || shown === name) return true;
  if (!name.includes('_')) return false;
  return shown.toLowerCase() === name.replace(/_/g, ' ').toLowerCase();
}

export function railParamLabel(analysisKey: string, paramName: string): string {
  const fromSpec = specFor(analysisKey)
    ?.params.find(param => param.name === paramName)
    ?.label?.trim();
  if (fromSpec && !isRawParamLabel(paramName, fromSpec)) return fromSpec;
  const mapped = ROLE_LABELS[paramName];
  if (mapped && !isRawParamLabel(paramName, mapped)) return mapped;
  const titled = paramName
    .split('_')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  if (titled && !isRawParamLabel(paramName, titled)) return titled;
  return fromSpec || mapped || titled;
}
