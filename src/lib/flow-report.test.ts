import { analysisReportForTable, findingFromTable, type ReportTable } from './flow-report';

const table: ReportTable = {
  id: 'spec-1',
  label: 'agree by region',
  index: 1,
  columns: [
    { id: 'east', label: 'region=East' },
    { id: 'north', label: 'region=North' },
  ],
  letters: [{ stub_row_id: 'price', banner_id: 'east', letter: 'A' }],
  rows: [
    {
      id: 'price',
      label: 'Price too high',
      kind: 'value',
      cells: [
        { banner_id: 'east', percent: 16, unweighted_n: 13, column_unweighted_n: 81 },
        { banner_id: 'north', percent: 7.5, unweighted_n: 6, column_unweighted_n: 80 },
      ],
    },
    {
      id: 'staff',
      label: 'Staff',
      kind: 'value',
      cells: [
        { banner_id: 'east', percent: 4, unweighted_n: 3, column_unweighted_n: 81, low_base: true },
        {
          banner_id: 'north',
          percent: 2,
          unweighted_n: 2,
          column_unweighted_n: 80,
          low_base: true,
        },
      ],
    },
  ],
};

describe('report findings', () => {
  it('builds a synthesize-report body from the cited cells', () => {
    const report = analysisReportForTable(table, null, null);
    const summary = String(report.summary);
    expect(summary).toContain('Price too high is 16.0% in East');
    expect(summary).toContain('row 1');
    expect(summary).not.toContain('Staff');
    const rows = (report.tables as { rows: { row: number }[] }[])[0].rows;
    expect(rows.map(row => row.row)).toEqual([1]);
  });

  it('cites the table row and keeps a segment cut on the chart', () => {
    const markdown = [
      '## Executive Summary',
      '',
      'Price too high is 16.0% in East (n 13 of 81, row 1).',
      '',
      '## Results and Findings',
      '',
      'The East column carries letter A.',
    ].join('\n');
    const finding = findingFromTable(table, markdown, 'east', [{ tableId: 'spec-1', number: 1 }]);
    expect(finding.citation).toBe('T1 · row 1');
    expect(finding.significant).toBe(true);
    expect(finding.bars).toEqual([{ label: 'Price too high', percent: 16 }]);
    expect(finding.headline).toContain('16.0%');
    expect(finding.support).toContain('letter A');
  });

  it('keeps the finding to the first two sentences', () => {
    const markdown = [
      '## Executive Summary',
      '',
      'Row one is 10.0% in East. Row two is 4.0% in North. Row three is 1.0% in South.',
    ].join('\n');
    const finding = findingFromTable(table, markdown, null, null);
    expect(finding.headline).toBe('Row one is 10.0% in East.');
    expect(finding.support).toBe('Row two is 4.0% in North.');
    expect(finding.citation).toBe('T1 · row 1');
  });

  it('uses the selected rows when a filter cut is applied', () => {
    const finding = findingFromTable(table, '', null, [{ tableId: 'spec-1', number: 2 }]);
    expect(finding.citation).toBe('T1 · row 2');
    expect(finding.lowBase).toBe(true);
    expect(finding.bars.map(bar => bar.label)).toEqual(['East', 'North']);
    expect(finding.headline).toContain('Staff is 4.0% in East');
  });
});
