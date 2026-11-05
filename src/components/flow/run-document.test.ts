import {
  documentApa,
  documentCsv,
  documentMarkdown,
  placePins,
  readPins,
  runDocument,
  writePins,
  type ReportPin,
} from './run-document';

describe('saved run document', () => {
  const run = {
    op: 'anova_oneway',
    title: 'score by region',
    created_at: '2026-11-02T14:02:00Z',
    report: {
      summary: 'Score differs by region.',
      meta: { title: 'score by region', rows_dataset: 400 },
      tables: [{ title: 'Means', columns: ['Group', 'Mean'], rows: [['North', '4.2']] }],
      assumption_checks: { notes: ['Levene p = .21', '8 rows dropped'] },
      trust: { notes: ['8 rows dropped'] },
      reproducibility: { r_script: 'aov(score ~ region)' },
    },
    result: {
      group_descriptives: [{ group: 'North', n: 80, mean: 4.2, std: 1.1 }],
    },
  };

  it('reads the stored summary, base, table, and script', () => {
    const document = runDocument(run);
    expect(document.title).toBe('score by region');
    expect(document.base).toBe(400);
    expect(document.summary).toBe('Score differs by region.');
    expect(document.tables[0].rows[0]).toEqual(['North', '80', '4.2', '1.1']);
    expect(document.checks).toEqual(['Levene p = .21', '8 rows dropped']);
    expect(runDocument({ ...run, result: { ...run.result, n_used: 22 } }).base).toBe(22);
    expect(document.script).toContain('aov');
    const lead = runDocument({
      ...run,
      report: {
        ...run.report,
        answer_from_result: true,
        answer:
          'One-Way ANOVA. F = 4.200, df = 2.000, p = 0.040. The difference is unlikely to be chance.',
      },
    });
    expect(lead.summary.startsWith('One-Way ANOVA.')).toBe(true);
    expect(documentCsv(document)).toContain('North,80,4.2,1.1');
    expect(documentMarkdown(document)).toContain('# score by region');
    expect(documentApa(document)).toContain('Table 1');
  });

  it('places a pinned finding after the chosen section', () => {
    const pin: ReportPin = {
      id: 'pin',
      runId: 'run',
      headline: 'North is higher',
      support: 'Mean 4.2',
      citation: 'score by region',
      afterId: 'finding-1',
      deck: true,
      topline: false,
      keepLive: true,
    };
    const placed = placePins([{ id: 'finding-1' }, { id: 'finding-2' }], [pin]);
    expect(placed.map(entry => entry.item.id)).toEqual(['finding-1', 'pin', 'finding-2']);
    const storage = {
      value: '',
      getItem: () => storage.value,
      setItem: (_key: string, value: string) => {
        storage.value = value;
      },
    } as unknown as Storage;
    writePins('project', [pin], storage);
    expect(readPins('project', storage)[0].headline).toBe('North is higher');
  });
});
