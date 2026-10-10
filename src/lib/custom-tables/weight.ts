export type LineageVersion = {
  dataset_id: string;
  producing_operation: string;
  parent_dataset_id?: string | null;
  origin_dataset_id?: string | null;
};

export type WeightOption = {
  optionId: string;
  datasetId: string;
  kind: 'unweighted' | 'this_file_unweighted' | 'this_file' | 'raked';
  label: string;
  weight: 'none' | 'active';
};

export const WEIGHT_CROSSTAB_COPY =
  'Crosstabs, means, t-tests, chi-square, and regression use the active weight. Other analyses refuse while a weight is active.';

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
  options.push({
    optionId: `unweighted-this:${currentId}`,
    datasetId: currentId,
    kind: 'this_file_unweighted',
    label: 'Unweighted (this file)',
    weight: 'none',
  });
  if (origin && origin.dataset_id !== currentId) {
    options.push({
      optionId: `unweighted-origin:${origin.dataset_id}`,
      datasetId: origin.dataset_id,
      kind: 'unweighted',
      label: 'Unweighted (pre-merge upload)',
      weight: 'none',
    });
  }
  const current = versions.find(v => v.dataset_id === currentId);
  if (current && isWeightedOp(current.producing_operation)) {
    options.push({
      optionId: `weight:${current.dataset_id}`,
      datasetId: current.dataset_id,
      kind: 'this_file',
      label: "This file's weight",
      weight: 'active',
    });
  }
  for (const version of versions) {
    if (!isWeightedOp(version.producing_operation)) continue;
    if (version.dataset_id === currentId) continue;
    options.push({
      optionId: `raked:${version.dataset_id}`,
      datasetId: version.dataset_id,
      kind: 'raked',
      label: `Raked weight (${version.dataset_id.slice(0, 8)}…)`,
      weight: 'active',
    });
  }
  return options;
}

export function pickRunDatasetId(option: WeightOption): string {
  return option.datasetId;
}
