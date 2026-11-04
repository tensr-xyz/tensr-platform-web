import { columnTypeFromSchemaColumn, dataTypeFromSchemaColumn } from './schema-column-type';

describe('dataTypeFromSchemaColumn', () => {
  it('counts a numeric schema type as numeric even when cells are value labels', () => {
    expect(
      dataTypeFromSchemaColumn({ name: 'gender', type: 'numeric', storage_type: 'numeric' })
    ).toBe('numeric');
  });

  it('keeps a text id as text when SPSS storage was recorded as numeric', () => {
    expect(
      dataTypeFromSchemaColumn({ name: 'id', type: 'categorical', storage_type: 'numeric' })
    ).toBe('categorical');
  });

  it('uses numeric storage only when the schema omitted type', () => {
    expect(dataTypeFromSchemaColumn({ name: 'age', storage_type: 'numeric' })).toBe('numeric');
  });
});

describe('columnTypeFromSchemaColumn', () => {
  it('types a numeric schema column before analyze-file returns', () => {
    expect(
      columnTypeFromSchemaColumn({ name: 'Q7', type: 'numeric', storage_type: 'numeric' })
    ).toBe('number');
    expect(
      columnTypeFromSchemaColumn({ name: 'id', type: 'categorical', storage_type: 'numeric' })
    ).toBe('string');
  });
});
