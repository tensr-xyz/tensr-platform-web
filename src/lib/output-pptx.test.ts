import { tableToEngineBook, toolTraceFromResult } from '@/lib/output-pptx';

describe('output PowerPoint helpers', () => {
  it('turns a display table into an engine book with shares', () => {
    const book = tableToEngineBook({
      title: 'Reach',
      columns: ['Title', '%'],
      rows: [
        ['Northwind Post', '41.2%'],
        ['Harbour Times', '29%'],
      ],
    });
    expect(book).toMatchObject({
      title: 'Reach',
      banner_columns: [{ id: 'total' }],
    });
    expect((book as { rows: { label: string; cells: { percent: number }[] }[] }).rows).toEqual([
      {
        id: 'r0',
        label: 'Northwind Post',
        kind: 'value',
        cells: [{ banner_id: 'total', percent: 41.2 }],
      },
      {
        id: 'r1',
        label: 'Harbour Times',
        kind: 'value',
        cells: [{ banner_id: 'total', percent: 29 }],
      },
    ]);
  });

  it('builds a tool trace from the result card', () => {
    const trace = toolTraceFromResult({
      lead: 'Northwind Post reaches 41.2%.',
      tables: [
        {
          title: 'Reach',
          columns: ['Title', '%'],
          rows: [['Northwind Post', '41.2%']],
        },
      ],
      footnote: 'Base 171 · Projection weight',
    });
    expect(trace).toHaveLength(1);
    expect(trace[0].result).toMatchObject({
      answer_markdown: 'Northwind Post reaches 41.2%.',
      result: {
        title: 'Reach',
        base_label: 'Base 171 · Projection weight',
      },
    });
  });
});
