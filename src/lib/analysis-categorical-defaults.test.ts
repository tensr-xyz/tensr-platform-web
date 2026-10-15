import { buttonVariants } from '@/components/atoms/button';
import { defaultFormFieldsFromSchema, defaultFormForAnalysis } from './analysis-definitions';
import type { DatasetPreview, SchemaColumn } from './analysis-report-types';

function col(name: string, type: string, uniqueCount?: number): SchemaColumn {
  return { name, type, missing_count: 0, uniqueCount };
}

const SURVEY: SchemaColumn[] = [
  col('RespID', 'numeric', 300),
  col('case_no', 'integer', 300),
  col('Gender', 'categorical', 2),
  col('Region', 'categorical', 4),
  col('Age', 'numeric', 20),
];

const PREVIEW: DatasetPreview = {
  headers: ['RespID', 'Gender', 'Region'],
  rows: [
    [1, 'F', 'North'],
    [2, 'M', 'South'],
    [3, 'F', 'North'],
  ],
};

describe('categorical setup defaults', () => {
  it('starts chi-square and grouping slots on the first category, not RespID', () => {
    const fields = defaultFormFieldsFromSchema(SURVEY);
    expect(fields.chiA).toBe('Gender');
    expect(fields.chiB).toBe('Region');
    expect(fields.groupCol).toBe('Gender');
    expect(fields.factorBCol).toBe('Region');
    expect(fields.valueCol).toBe('Age');
    expect(fields.depCol).toBe('Age');
  });

  it('treats a high-cardinality integer in the preview as an id', () => {
    const schema: SchemaColumn[] = [
      { name: 'rownum', type: 'numeric', missing_count: 0 },
      { name: 'Gender', type: 'categorical', missing_count: 0 },
      { name: 'Region', type: 'categorical', missing_count: 0 },
      { name: 'Age', type: 'numeric', missing_count: 0 },
    ];
    const preview: DatasetPreview = {
      headers: ['rownum', 'Gender', 'Region'],
      rows: Array.from({ length: 40 }, (_, index) => [index + 1, 'F', 'North']),
    };
    const fields = defaultFormFieldsFromSchema(schema, preview);
    expect(fields.chiA).toBe('Gender');
    expect(fields.valueCol).not.toBe('rownum');
  });

  it('fills every categorical slot with a distinct category, skipping a high-cardinality Age', () => {
    const schema: SchemaColumn[] = [
      { name: 'RespID', type: 'categorical', missing_count: 0 },
      { name: 'Gender', type: 'categorical', missing_count: 0 },
      { name: 'Age', type: 'categorical', missing_count: 0 },
      { name: 'Group', type: 'categorical', missing_count: 0 },
    ];
    const preview: DatasetPreview = {
      headers: ['RespID', 'Gender', 'Age', 'Group'],
      rows: Array.from({ length: 60 }, (_, index) => [
        index + 1,
        index % 2 === 0 ? 'F' : 'M',
        18 + index,
        index % 2 === 0 ? 'A' : 'B',
      ]),
    };
    const fields = defaultFormFieldsFromSchema(schema, preview);
    expect(fields.chiA).toBe('Gender');
    expect(fields.chiB).toBe('Group');
    expect(fields.groupCol).toBe('Gender');
    expect(fields.factorBCol).toBe('Group');
    expect(fields.factorCCol).toBe('');
    expect(new Set([fields.chiA, fields.chiB]).size).toBe(2);
  });

  it('does not use a double-typed Age as a categorical slot', () => {
    const fields = defaultFormFieldsFromSchema([
      col('Gender', 'categorical', 2),
      col('Age', 'double', 60),
      col('Group', 'categorical', 3),
    ]);
    expect(fields.chiA).toBe('Gender');
    expect(fields.chiB).toBe('Group');
  });

  it('uses the preview name check when RespID is stored as a category', () => {
    const schema: SchemaColumn[] = [
      { name: 'RespID', type: 'categorical', missing_count: 0 },
      { name: 'Gender', type: 'categorical', missing_count: 0 },
    ];
    expect(defaultFormFieldsFromSchema(schema, PREVIEW).chiA).toBe('Gender');
  });

  it('keeps a classification outcome on a category and a network edge on the id columns', () => {
    const tree = defaultFormForAnalysis('decision_tree', SURVEY);
    expect(tree.depCol).toBe('Gender');
    const network = defaultFormForAnalysis('network', [
      col('from_id', 'string'),
      col('to_id', 'string'),
      col('w', 'numeric'),
    ]);
    expect(network.chiA).toBe('from_id');
    expect(network.chiB).toBe('to_id');
  });
});

describe('button compact size', () => {
  it('leaves padding, centering, text size, and svg size off the compact size', () => {
    const compact = buttonVariants({ variant: 'unstyled', size: 'compact' });
    expect(compact).not.toMatch(/justify-center/);
    expect(compact).not.toMatch(/text-sm/);
    expect(compact).not.toMatch(/px-4/);
    expect(compact).not.toMatch(/\[&_svg\]:size-4/);
    const standard = buttonVariants({ variant: 'default', size: 'default' });
    expect(standard).toMatch(/justify-center/);
    expect(standard).toMatch(/text-sm/);
    expect(standard).toMatch(/px-4/);
    expect(standard).toMatch(/\[&_svg\]:size-4/);
  });
});
