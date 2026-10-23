import { dataTypeFromSchemaColumn } from './schema-column-type';

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
