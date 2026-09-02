import { pickRunDatasetId, weightPickerOptions, WEIGHT_CROSSTAB_COPY } from './weight';

const ORIGIN = 'origin-id';
const RAKED = 'raked-id';
const OTHER = 'other-rake';

const versions = [
  {
    dataset_id: OTHER,
    producing_operation: 'rake',
    parent_dataset_id: ORIGIN,
    origin_dataset_id: ORIGIN,
  },
  {
    dataset_id: RAKED,
    producing_operation: 'rake',
    parent_dataset_id: ORIGIN,
    origin_dataset_id: ORIGIN,
  },
  {
    dataset_id: ORIGIN,
    producing_operation: 'upload',
    parent_dataset_id: null,
    origin_dataset_id: ORIGIN,
  },
];

describe('weight version picker', () => {
  it('offers unweighted origin, this file, and other raked children', () => {
    const opts = weightPickerOptions(versions, RAKED);
    expect(opts.map(o => o.kind)).toEqual(['unweighted', 'this_file', 'raked']);
    expect(opts.find(o => o.kind === 'unweighted')?.datasetId).toBe(ORIGIN);
    expect(opts.find(o => o.kind === 'this_file')?.datasetId).toBe(RAKED);
    expect(opts.find(o => o.kind === 'raked')?.datasetId).toBe(OTHER);
  });

  it('running unweighted posts to the parent version, not the raked file', () => {
    const opts = weightPickerOptions(versions, RAKED);
    const unweighted = opts.find(o => o.kind === 'unweighted')!;
    expect(pickRunDatasetId(unweighted)).toBe(ORIGIN);
    expect(pickRunDatasetId(opts.find(o => o.kind === 'this_file')!)).toBe(RAKED);
  });

  it('says weighted crosstabs are not weighted inferential tests', () => {
    expect(WEIGHT_CROSSTAB_COPY.toLowerCase()).toContain('weighted crosstabs');
    expect(WEIGHT_CROSSTAB_COPY.toLowerCase()).toContain('unweighted');
  });
});
