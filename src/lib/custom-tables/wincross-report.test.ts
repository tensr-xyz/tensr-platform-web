import { canvasFromConvertedTable, refusalCopy, wincrossHeadline } from './wincross-report';

const SAMPLE: Parameters<typeof wincrossHeadline>[0] = {
  conversion: {
    tables_converted: 1,
    tables_refused: 2,
    tables_total: 3,
    table_rate_percent: 33.3,
  },
  report: {
    tables_converted: [{ name: 'Aware among males', stub: 'aware' }],
    tables_refused: [
      {
        name: 'Incomplete filter',
        reason: 'This table uses a filter that does not name a variable and value.',
        hand_work: 'Rebuild the base in Custom Tables.',
      },
    ],
    tables_converted_count: 1,
    tables_refused_count: 2,
    tables_total: 3,
  },
  tables: [
    {
      name: 'Aware among males',
      ok: true,
      spec: {
        stubs: [{ column: 'aware', values: ['1'] }],
        banner: [{ column: 'age_band', values: [] }],
        nest_banners: true,
        significance_display: 'cell_comparisons',
        statistics: ['column_proportion'],
      },
    },
  ],
};

describe('WinCross conversion report', () => {
  it('states converted vs refused in DP language, not a stack trace', () => {
    expect(wincrossHeadline(SAMPLE)).toBe('1 of 3 tables converted (33.3%)');
    const copy = refusalCopy(SAMPLE.report!.tables_refused[0]);
    expect(copy.reason.toLowerCase()).toContain('filter');
    expect(copy.handWork.toLowerCase()).toContain('custom tables');
    expect(copy.reason).not.toContain('Traceback');
  });

  it('loads a converted table onto the custom-tables canvas', () => {
    const canvas = canvasFromConvertedTable(SAMPLE.tables![0]);
    expect(canvas?.stubs[0].column).toBe('aware');
    expect(canvas?.banners[0].column).toBe('age_band');
  });

  it('does not load a refused table', () => {
    expect(canvasFromConvertedTable({ ok: false, spec: undefined })).toBeNull();
  });
});
