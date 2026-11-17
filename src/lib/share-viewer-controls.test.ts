import {
  controlsForViewer,
  filterRefFromSelections,
  isAllSelection,
  normalizeControl,
  normalizeControls,
  optionLabel,
  publicControl,
} from './share-viewer-controls';

describe('share viewer controls', () => {
  it('normalises combo box to dropdown with a custom All label', () => {
    const control = normalizeControl({
      type: 'combo_box',
      column: 'region',
      label: 'Region',
      all_label: 'Everywhere',
      values: ['N', 'S'],
      value_labels: { N: 'North' },
    });
    expect(control?.type).toBe('dropdown');
    expect(control?.allLabel).toBe('Everywhere');
    expect(optionLabel('N', control?.valueLabels)).toBe('North');
  });

  it('hides explore columns and hide_from_viewers controls', () => {
    const controls = normalizeControls([
      { id: 'a', type: 'dropdown', column: 'region', values: ['N'] },
      { id: 'b', type: 'listbox', column: 'segment', values: ['A'], hide_from_viewers: true },
      { id: 'c', type: 'dropdown', column: 'wave', values: ['1'] },
    ]);
    const visible = controlsForViewer(controls, {
      exploreMode: true,
      exploreHiddenColumns: ['wave'],
    });
    expect(visible.map(row => row.id)).toEqual(['a']);
  });

  it('builds filter_ref and treats All as no filter', () => {
    const controls = normalizeControls([
      {
        id: 'region',
        type: 'dropdown',
        column: 'region',
        all_label: '(All)',
        values: ['North', 'South'],
      },
      { id: 'seg', type: 'listbox', column: 'segment', values: ['A', 'B'] },
    ]);
    expect(isAllSelection(controls[0], '(All)')).toBe(true);
    expect(filterRefFromSelections(controls, { region: '(All)' })).toBeNull();
    expect(filterRefFromSelections(controls, { region: 'North', seg: ['A', 'B'] })).toEqual({
      combine: 'and',
      filters: [
        { column: 'region', op: 'equals', value: 'North' },
        { column: 'segment', op: 'in', value: ['A', 'B'] },
      ],
    });
  });

  it('exposes option labels on the public control payload', () => {
    const control = normalizeControl({
      id: 'r',
      type: 'dropdown',
      column: 'region',
      values: ['1', '2'],
      value_labels: { '1': 'North', '2': 'South' },
    });
    expect(control).not.toBeNull();
    expect(publicControl(control!).options[0]).toEqual({ value: '1', label: 'North' });
  });
});
