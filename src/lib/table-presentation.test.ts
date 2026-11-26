import {
  applyTablePresentation,
  normalizeTableEdits,
  normalizeTableRules,
  normalizeTableStyle,
  tableRuleLabel,
  tableStylePresetLabel,
} from './table-presentation';

function syntheticBook() {
  return {
    banner_columns: [
      { id: 'total', label: 'Total' },
      { id: 'north', label: 'North' },
      { id: 'south', label: 'South' },
      { id: 'empty_col', label: 'Empty' },
    ],
    letters: [{ stub_row_id: 'alpha', banner_id: 'north', letter: 'A' }],
    rows: [
      {
        id: 'alpha',
        label: 'Alpha',
        kind: 'category',
        cells: [
          { stub_row_id: 'alpha', banner_id: 'total', percent: 40, unweighted_n: 80 },
          { stub_row_id: 'alpha', banner_id: 'north', percent: 55, unweighted_n: 40 },
          { stub_row_id: 'alpha', banner_id: 'south', percent: 25, unweighted_n: 40 },
          {
            stub_row_id: 'alpha',
            banner_id: 'empty_col',
            percent: 0,
            unweighted_n: 0,
            column_unweighted_n: 0,
          },
        ],
      },
      {
        id: 'beta',
        label: 'Beta',
        kind: 'category',
        cells: [
          { stub_row_id: 'beta', banner_id: 'total', percent: 30, unweighted_n: 20 },
          { stub_row_id: 'beta', banner_id: 'north', percent: 20, unweighted_n: 10 },
          { stub_row_id: 'beta', banner_id: 'south', percent: 40, unweighted_n: 10 },
          {
            stub_row_id: 'beta',
            banner_id: 'empty_col',
            percent: 0,
            unweighted_n: 0,
            column_unweighted_n: 0,
          },
        ],
      },
      {
        id: 'gamma',
        label: 'Gamma',
        kind: 'category',
        cells: [
          { stub_row_id: 'gamma', banner_id: 'total', percent: 20, unweighted_n: 8 },
          { stub_row_id: 'gamma', banner_id: 'north', percent: 10, unweighted_n: 4 },
          { stub_row_id: 'gamma', banner_id: 'south', percent: 30, unweighted_n: 4 },
          {
            stub_row_id: 'gamma',
            banner_id: 'empty_col',
            percent: 0,
            unweighted_n: 0,
            column_unweighted_n: 0,
          },
        ],
      },
      {
        id: 'empty_row',
        label: 'Empty',
        kind: 'category',
        cells: [
          { stub_row_id: 'empty_row', banner_id: 'total', percent: 0, unweighted_n: 0 },
          { stub_row_id: 'empty_row', banner_id: 'north', percent: 0, unweighted_n: 0 },
          { stub_row_id: 'empty_row', banner_id: 'south', percent: 0, unweighted_n: 0 },
          {
            stub_row_id: 'empty_row',
            banner_id: 'empty_col',
            percent: 0,
            unweighted_n: 0,
            column_unweighted_n: 0,
          },
        ],
      },
      {
        id: 'net-agree',
        label: 'NET Agree',
        kind: 'net',
        cells: [
          { stub_row_id: 'net-agree', banner_id: 'total', percent: 70, unweighted_n: 100 },
          { stub_row_id: 'net-agree', banner_id: 'north', percent: 75, unweighted_n: 50 },
          { stub_row_id: 'net-agree', banner_id: 'south', percent: 65, unweighted_n: 50 },
          {
            stub_row_id: 'net-agree',
            banner_id: 'empty_col',
            percent: 0,
            unweighted_n: 0,
            column_unweighted_n: 0,
          },
        ],
      },
    ],
  };
}

describe('table presentation engine', () => {
  it('normalises style, rules and edits', () => {
    const style = normalizeTableStyle({
      preset: 'client',
      freezeHeader: true,
      rowHeights: { alpha: 24 },
      cellFormats: [{ rowId: 'alpha', columnId: 'north', fill: '#abc', bold: true }],
    });
    expect(style.preset).toBe('client');
    expect(style.fontFamily).toBe('Georgia');
    expect(style.freezeHeader).toBe(true);
    expect(style.cellFormats[0]?.fill).toBe('#AABBCC');
    expect(normalizeTableStyle({ preset: 'house' }).preset).toBe('default');
    expect(normalizeTableStyle({ preset: 'minimal' }).preset).toBe('compact');
    expect(tableStylePresetLabel('default')).toBe('House');
    expect(tableStylePresetLabel('banded')).toBe('Banded');
    expect(
      tableRuleLabel({
        id: 'r1',
        type: 'highlight',
        enabled: true,
        op: 'below',
        value: 50,
        statistic: 'unweighted_n',
        fill: '#F5E6C8',
        color: '#A15C12',
      })
    ).toBe('Amber when base under 50');

    const rules = normalizeTableRules([
      { type: 'hide_small_bases', threshold: 25, mode: 'blank_cell' },
      { type: 'color_scale', lowColor: '#fff', highColor: '#1e6b58' },
      { type: 'unknown_rule' },
    ]);
    expect(rules.map(rule => rule.type)).toEqual(['hide_small_base', 'colour_scale']);

    const edits = normalizeTableEdits({
      rowRenames: { alpha: 'Brand A' },
      hiddenRowIds: ['gamma'],
      merges: [{ label: 'NET Top', rowIds: ['alpha', 'beta'] }],
    });
    expect(edits.renames.alpha).toBe('Brand A');
    expect(edits.merges[0]?.label).toBe('NET Top');
  });

  it('re-applies rules and edits on a fresh book', () => {
    const book = syntheticBook();
    const presented = applyTablePresentation(book, {
      style: { preset: 'brand_health', freeze_header: true },
      rules: [
        { type: 'hide_empty', axis: 'both' },
        { type: 'hide_small_base', threshold: 9, mode: 'hide_row' },
        { type: 'show_top_k', k: 2, by: 'north' },
        { type: 'highlight', op: 'above', value: 50, statistic: 'percent', fill: '#DCEFE8' },
        { type: 'shade_net_rows', fill: '#E8F1ED' },
      ],
      edits: { renames: { alpha: 'Brand A' } },
    });

    const labels = presented.rows.map(row => String(row.label || ''));
    expect(labels).not.toContain('Empty');
    expect(labels).not.toContain('Gamma');
    expect(labels).toContain('Brand A');
    expect(
      presented.banner_columns?.every(col => (col as { id?: string }).id !== 'empty_col')
    ).toBe(true);
    const categories = presented.rows
      .filter(row => row.kind !== 'net')
      .map(row => String(row.label || ''));
    expect(categories).toEqual(['Brand A', 'Beta']);
    expect(presented.presentation.style.preset).toBe('brand_health');
    expect(
      presented.presentation.cellStyles.some(
        item => item.rowId === 'alpha' && item.columnId === 'north' && item.fill === '#DCEFE8'
      )
    ).toBe(true);
    expect(book.rows[0]?.label).toBe('Alpha');
  });

  it('applies banded preset shading without an explicit alternate-row rule', () => {
    const presented = applyTablePresentation(syntheticBook(), {
      style: { preset: 'banded' },
      rules: [],
    });
    expect(presented.presentation.style.preset).toBe('banded');
    expect(
      presented.presentation.cellStyles.some(
        item => item.rowId === 'beta' && item.fill === '#F6F6F3'
      )
    ).toBe(true);
  });

  it('merges rows into a presentation NET and blanks small bases', () => {
    const presented = applyTablePresentation(syntheticBook(), {
      rules: [{ type: 'hide_small_base', threshold: 15, mode: 'blank_cell' }],
      edits: {
        merges: [{ label: 'NET Top two', rowIds: ['alpha', 'beta'], hideMembers: true }],
        hiddenRowIds: ['empty_row'],
      },
    });
    const ids = presented.rows.map(row => String(row.id || ''));
    expect(ids).not.toContain('alpha');
    expect(ids).not.toContain('beta');
    expect(presented.rows.some(row => row.label === 'NET Top two' && row.kind === 'net')).toBe(
      true
    );
    const gamma = presented.rows.find(row => row.id === 'gamma') as {
      cells: Array<{ blanked_small_base?: boolean; percent?: number | null }>;
    };
    expect(gamma.cells.some(cell => cell.blanked_small_base && cell.percent == null)).toBe(true);
  });

  it('adds rank and difference columns from rules', () => {
    const presented = applyTablePresentation(syntheticBook(), {
      rules: [
        {
          type: 'add_rank_column',
          id: 'rank-1',
          by: 'north',
          direction: 'desc',
          label: 'Rank',
        },
        {
          type: 'add_difference_column',
          id: 'diff-1',
          leftColumnId: 'North',
          rightColumnId: 'South',
        },
      ],
    });
    const banners = Object.fromEntries(
      (presented.banner_columns || []).map(col => {
        const record = col as { id?: string; label?: string; kind?: string };
        return [String(record.id || ''), record];
      })
    );
    expect(banners['rank-rank-1']?.label).toBe('Rank');
    expect(banners['rank-rank-1']?.kind).toBe('rank');
    expect(banners['diff-diff-1']?.label).toBe('North − South');

    const cellValue = (rowId: string, columnId: string) => {
      const row = presented.rows.find(item => item.id === rowId) as {
        cells: Array<{ banner_id?: string; percent?: number | null }>;
      };
      return row.cells.find(cell => cell.banner_id === columnId)?.percent ?? null;
    };

    expect(cellValue('alpha', 'rank-rank-1')).toBe(1);
    expect(cellValue('beta', 'rank-rank-1')).toBe(2);
    expect(cellValue('net-agree', 'rank-rank-1')).toBeNull();
    expect(cellValue('alpha', 'diff-diff-1')).toBe(30);
    expect(cellValue('beta', 'diff-diff-1')).toBe(-20);
    expect(tableRuleLabel({ id: 'r', type: 'add_rank_column', enabled: true, label: 'Rank' })).toBe(
      'Add rank column (Rank)'
    );
  });
});
