import {
  columnLevelCount,
  datasetPreviewFromPage,
  defaultFormForAnalysis,
  isIdLikeSchemaColumn,
  twoGroupColumnNames,
} from './analysis-definitions';
import { installAnalysisSpecs, namesForParam, specFor } from './analysis-spec-setup';
import { SPEC_FIXTURES } from './analysis-spec-fixtures';
import type { DatasetPreview, SchemaColumn } from './analysis-report-types';

const SCHEMA: SchemaColumn[] = [
  { name: 'id', type: 'integer', missing_count: 0 },
  { name: 'respondent_id', type: 'categorical', missing_count: 0 },
  { name: '_row_uid', type: 'categorical', missing_count: 0 },
  { name: 'region', type: 'categorical', missing_count: 0 },
  { name: 'gender', type: 'categorical', missing_count: 0 },
  { name: 'score', type: 'integer', missing_count: 0 },
];

const PREVIEW: DatasetPreview = {
  headers: ['id', 'respondent_id', '_row_uid', 'region', 'gender', 'score'],
  rows: Array.from({ length: 40 }, (_, index) => [
    index + 1,
    `R${index + 1}`,
    `u${index}`,
    ['North', 'South', 'East', 'West'][index % 4],
    index === 3 ? null : index % 2 === 0 ? 'F' : 'M',
    index % 10,
  ]),
};

describe('independent t-test defaults', () => {
  it('treats id, respondent_id, respid and _row_uid as ids', () => {
    for (const name of ['id', 'respondent_id', 'respid', '_row_uid', 'RespID']) {
      expect(isIdLikeSchemaColumn({ name, type: 'categorical', missing_count: 0 })).toBe(true);
    }
    expect(isIdLikeSchemaColumn({ name: 'gender', type: 'categorical', missing_count: 0 })).toBe(
      false
    );
  });

  it('counts non-missing groups from rows, then value labels', () => {
    expect(columnLevelCount(SCHEMA[4], PREVIEW)).toBe(2);
    expect(columnLevelCount(SCHEMA[3], PREVIEW)).toBe(4);
    expect(
      columnLevelCount({
        name: 'q1',
        type: 'categorical',
        missing_count: 0,
        value_labels: { '1': 'Yes', '2': 'No' },
      })
    ).toBe(2);
  });

  it('offers only two-group variables for grouping', () => {
    expect(twoGroupColumnNames(SCHEMA, PREVIEW)).toEqual(['gender']);
  });

  it('never starts on an id and picks the first two-group grouping variable', () => {
    const form = defaultFormForAnalysis('ttest_independent', SCHEMA, PREVIEW);
    expect(form.valueCol).toBe('score');
    expect(form.groupCol).toBe('gender');
  });

  it('leaves grouping empty when no variable has two groups', () => {
    const schema = SCHEMA.filter(column => column.name !== 'gender');
    const form = defaultFormForAnalysis('ttest_independent', schema, PREVIEW);
    expect(form.groupCol).toBe('');
    expect(form.valueCol).not.toMatch(/id/i);
  });

  it('narrows the spec grouping picker for the independent t-test only', () => {
    installAnalysisSpecs(SPEC_FIXTURES);
    const spec = specFor('ttest_independent')!;
    const group = spec.params.find(param => param.name === 'group_column')!;
    expect(namesForParam(SCHEMA, group, PREVIEW, 'ttest_independent')).toEqual(['gender']);
    expect(namesForParam(SCHEMA, group, PREVIEW)).toContain('region');
  });

  it('reads the preview endpoint page', () => {
    expect(datasetPreviewFromPage({ headers: ['a'], rows: [[1], [{ x: 1 }]] })).toEqual({
      headers: ['a'],
      rows: [[1], ['[object Object]']],
    });
    expect(datasetPreviewFromPage({ headers: [], rows: [] })).toBeNull();
    expect(datasetPreviewFromPage(null)).toBeNull();
  });
});
