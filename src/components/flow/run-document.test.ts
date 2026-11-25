import {
  documentApa,
  documentCsv,
  documentMarkdown,
  enrichPinFromRunDocument,
  pinIsThin,
  pinStory,
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

  it('skips Group means when the result only has medians', () => {
    const document = runDocument({
      ...run,
      op: 'mann_whitney_u',
      report: {
        ...run.report,
        tables: [
          {
            title: 'Groups',
            columns: ['Group', 'n', 'Median'],
            rows: [['North', '80', '4']],
          },
        ],
      },
      result: {
        group_descriptives: [{ group: 'North', n: 80, median: 4 }],
      },
    });
    expect(document.tables.map(table => table.title)).toEqual(['Groups']);
  });

  it('TEN-93: Groups codes become stamped value labels on the saved page', () => {
    const document = runDocument({
      ...run,
      op: 'mann_whitney_u',
      report: {
        ...run.report,
        answer_from_result: true,
        answer:
          'Overall liking for Male and Female: U = 12.000, p = 0.120, r = -0.033 (negligible), consistent with chance.',
        assumption_checks: {
          notes: [
            'SPSS NPAR TESTS default: asymptotic Mann–Whitney with continuity correction.',
            'Effect size (negligible; r < 0.1 negligible). Cutoffs: Cohen, 1988.',
          ],
        },
        tables: [
          {
            title: 'Groups',
            columns: ['Group', 'n', 'Median'],
            rows: [
              ['1.0', '10', '4'],
              ['2.0', '10', '5'],
            ],
          },
        ],
      },
      result: {
        group_descriptives: [
          { group: '1.0', label: 'Male', n: 10, median: 4 },
          { group: '2.0', label: 'Female', n: 10, median: 5 },
        ],
        group_labels: ['Male', 'Female'],
        group_names: ['1.0', '2.0'],
      },
    });
    expect(document.tables[0].rows.map(row => row[0])).toEqual(['Male', 'Female']);
    expect(document.summary).toContain('r = -0.033 (negligible)');
    expect(document.checks.some(note => note.includes('Effect size'))).toBe(true);
  });

  it('reads the stored summary, base, table, and script', () => {
    const document = runDocument(run);
    expect(document.title).toBe('score by region');
    expect(document.base).toBe(400);
    expect(document.summary).toBe('Score differs by region.');
    expect(document.tables[0].rows[0]).toEqual(['North', '80', '4.2', '1.1']);
    const labelled = runDocument({
      ...run,
      result: {
        group_descriptives: [{ group: '1', label: 'North region', n: 80, mean: 4.2, std: 1.1 }],
      },
    });
    expect(labelled.tables[0].rows[0][0]).toBe('North region');
    expect(document.checks).toEqual(['Levene p = .21', '8 rows dropped']);
    expect(runDocument({ ...run, result: { ...run.result, n_used: 22 } }).base).toBe(22);
    expect(
      runDocument({
        ...run,
        report: { ...run.report, exclusion_summary: { rows_used: 191 } },
        result: { ...run.result, n_used: 248, bases: [{ unweighted: 191 }] },
      }).base
    ).toBe(191);
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

  it('a thin card keeps the lead and the share bars from the run', () => {
    const document = runDocument({
      op: 'frequencies',
      report: {
        summary: 'First is the largest group.',
        meta: { title: 'Group' },
        tables: [
          {
            title: 'Group',
            columns: ['Answer', 'Percent'],
            rows: [
              ['First', '30.120'],
              ['Second', '12.048'],
            ],
          },
        ],
      },
      result: {},
    });
    const story = pinStory(document);
    expect(story.support).toBe('First is the largest group.');
    expect(story.bars.map(bar => bar.percent)).toEqual([30.1, 12]);
    expect(pinIsThin({ support: 'n = 40', bars: [] })).toBe(true);
    expect(pinIsThin({ support: story.support, bars: story.bars })).toBe(false);
    const enriched = enrichPinFromRunDocument(
      {
        id: 'pin-run-1',
        runId: 'run-1',
        headline: 'Chat title',
        support: 'Commentary from another output.',
        citation: 'Frequencies',
        afterId: '',
        deck: true,
        topline: true,
        keepLive: true,
      },
      document
    );
    expect(enriched.support).toBe('First is the largest group.');
    expect(enriched.bars?.map(bar => bar.percent)).toEqual([30.1, 12]);
    expect(enriched.headline).toBe('Group');
  });
});
