import {
  fieldsFromPivotConfig,
  moveField,
  pivotBody,
  removeField,
  reorderField,
  significanceSupported,
  swapRowsAndColumns,
  type PivotField,
} from './pivot-zones';

const region: PivotField = { id: '1', column: 'region', zone: 'rows' };
const quarter: PivotField = { id: '2', column: 'quarter', zone: 'columns' };
const sales: PivotField = { id: '3', column: 'sales', zone: 'values', agg: 'sum' };

describe('pivot zones', () => {
  it('moves a column into a zone and can swap, reorder, and remove it', () => {
    const dropped = moveField([region, sales], quarter.id, 'columns', 0).concat(
      quarter.zone === 'columns' ? [] : []
    );
    const withQuarter = moveField([region, sales], 'missing', 'columns', 0);
    expect(withQuarter).toHaveLength(2);
    const placed = moveField(
      [region, { ...quarter, zone: 'rows' }, sales],
      quarter.id,
      'columns',
      0
    );
    expect(placed.find(field => field.id === quarter.id)?.zone).toBe('columns');
    const swapped = swapRowsAndColumns(placed);
    expect(swapped.find(field => field.column === 'region')?.zone).toBe('columns');
    expect(swapped.find(field => field.column === 'quarter')?.zone).toBe('rows');
    const reordered = reorderField(
      [
        { id: 'a', column: 'region', zone: 'rows' },
        { id: 'b', column: 'channel', zone: 'rows' },
      ],
      'b',
      -1
    );
    expect(reordered.filter(field => field.zone === 'rows').map(field => field.column)).toEqual([
      'channel',
      'region',
    ]);
    expect(removeField(placed, sales.id).some(field => field.column === 'sales')).toBe(false);
    expect(dropped.length).toBeGreaterThan(0);
  });

  it('builds a banner-backed body and restores a saved config', () => {
    const body = pivotBody([region, quarter, sales], {
      topN: 10,
      significance: true,
      showSubtotals: true,
      showGrandTotal: true,
      filters: [{ column: 'year', value: '2024' }],
    });
    expect(body.rows).toEqual(['region']);
    expect(body.columns).toEqual(['quarter']);
    expect(body.values).toEqual([{ column: 'sales', agg: 'sum' }]);
    expect(body.filter).toEqual({
      combine: 'and',
      filters: [{ column: 'year', op: '=', value: '2024' }],
    });
    expect(significanceSupported('sum')).toBe(false);
    expect(significanceSupported('pct_column')).toBe(true);
    const restored = fieldsFromPivotConfig(body);
    expect(restored.map(field => field.zone)).toEqual(['rows', 'columns', 'values']);
  });
});
