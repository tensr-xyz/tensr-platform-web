export type LineageVersion = {
  dataset_id: string;
  producing_operation: string;
  parent_dataset_id?: string | null;
  origin_dataset_id?: string | null;
};

export type WeightOption = {
  datasetId: string;
  kind: 'unweighted' | 'this_file' | 'raked';
  label: string;
};

export const WEIGHT_CROSSTAB_COPY =
  'Weighted crosstabs. Chi-square, t-tests and regression are unweighted.';

function isWeightedOp(producing: string): boolean {
  const p = producing.toLowerCase();
  return p === 'rake' || p.startsWith('weight:');
}

export function weightPickerOptions(versions: LineageVersion[], currentId: string): WeightOption[] {
  const origin =
    versions.find(v => !v.parent_dataset_id) ||
    versions.find(v => v.producing_operation === 'upload') ||
    versions.find(v => v.dataset_id === v.origin_dataset_id);
  const options: WeightOption[] = [];
  if (origin) {
    options.push({
      datasetId: origin.dataset_id,
      kind: 'unweighted',
      label: 'Unweighted (original file)',
    });
  }
  const current = versions.find(v => v.dataset_id === currentId);
  if (current && isWeightedOp(current.producing_operation)) {
    options.push({
      datasetId: current.dataset_id,
      kind: 'this_file',
      label: "This file's weight",
    });
  }
  for (const version of versions) {
    if (!isWeightedOp(version.producing_operation)) continue;
    if (version.dataset_id === currentId) continue;
    options.push({
      datasetId: version.dataset_id,
      kind: 'raked',
      label: `Raked weight (${version.dataset_id.slice(0, 8)}…)`,
    });
  }
  return options;
}

export function pickRunDatasetId(option: WeightOption): string {
  return option.datasetId;
}
