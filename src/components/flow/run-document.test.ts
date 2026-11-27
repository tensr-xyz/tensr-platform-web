import {
  baseFooterFromTable,
  clientBaseFooterFromTable,
  documentApa,
  documentCsv,
  documentMarkdown,
  enrichPinFromRunDocument,
  pinIsThin,
  pinStory,
  placePins,
  readPins,
  runDocument,
  slideTableFromRunTable,
  stripSlideCellIndex,
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

  it('TEN-267: crosstab base rows become the footer, never chart bars', () => {
    const document = runDocument({
      op: 'banner',
      report: {
        summary: 'NYT leads WSJ on reach.',
        meta: { title: 'Reach of NYT and WSJ' },
        tables: [
          {
            title: 'Reach',
            columns: ['Item', 'Total'],
            rows: [
              ['The New York Times', '53.3'],
              ['The Wall Street Journal', '49.7'],
              ['Weighted base', '4822587.0'],
              ['Unweighted base', '218.0'],
              ['Effective base (Kish)', '204.2'],
              ['DEFF', '1.1'],
            ],
          },
        ],
      },
      result: {},
    });
    const story = pinStory(document);
    expect(story.bars.map(bar => bar.label)).toEqual([
      'The New York Times',
      'The Wall Street Journal',
    ]);
    expect(story.bars.map(bar => bar.percent)).toEqual([53.3, 49.7]);
    expect(story.baseFooter).toMatch(/^Base:/);
    expect(story.baseFooter).toContain('n = 218');
    expect(story.baseFooter).toMatch(/weighted 4\.82m/i);
    expect(story.baseFooter).not.toMatch(/deff/i);
    expect(story.baseFooter).not.toContain('%');
    const enriched = enrichPinFromRunDocument(
      {
        id: 'pin-reach',
        runId: 'run-reach',
        headline: 'Chat title',
        support: 'Other commentary.',
        citation: 'Banner',
        afterId: '',
        deck: true,
        topline: true,
        keepLive: true,
        bars: [{ label: 'Weighted base', percent: 4822587 }],
      },
      document
    );
    expect(enriched.bars?.map(bar => bar.label)).toEqual([
      'The New York Times',
      'The Wall Street Journal',
    ]);
    expect(enriched.baseFooter).toContain('n = 218');
    expect(enriched.op).toBe('banner');
  });

  it.each([
    {
      title: 'Spearman correlations',
      op: 'correlation',
      columns: ['Variable', 'Satisfaction', 'Trust', 'Recommend'],
      rows: [
        ['Satisfaction', '1.000', '0.700', '0.100'],
        ['Trust', '0.700', '1.000', '1.000'],
        ['Recommend', '0.100', '1.000', '1.000'],
      ],
    },
    {
      title: 'Pearson correlation',
      op: 'correlation',
      columns: ['Variables', 'r', 'p', 'n'],
      rows: [['Aroma with Taste', '0.42', '0.010', '500']],
    },
    {
      title: 'Partial correlation',
      op: 'partial_correlation',
      columns: ['Pair', 'ρ', 'p', 'n'],
      rows: [['Spend with Visits | Age', '-0.18', '0.040', '1,204']],
    },
  ])('TEN-267: $title never becomes share % bars', ({ title, op, columns, rows }) => {
    const document = runDocument({
      op,
      report: {
        summary: 'Coefficients for the asked variables.',
        meta: { title },
        tables: [{ title, columns, rows }],
      },
      result: {},
    });
    const story = pinStory(document);
    expect(story.bars).toEqual([]);
    const enriched = enrichPinFromRunDocument(
      {
        id: `pin-${op}`,
        runId: `run-${op}`,
        headline: 'Chat title',
        support: 'Other commentary.',
        citation: 'Correlation',
        afterId: '',
        deck: true,
        topline: true,
        keepLive: true,
        bars: [
          { label: 'Satisfaction', percent: 0.7 },
          { label: 'Trust', percent: 0.1 },
        ],
      },
      document
    );
    expect(enriched.bars).toEqual([]);
    expect(enriched.op).toBe(op);
  });

  it.each([
    {
      name: 'reach Total + audience',
      columns: ['Item', 'Total %', 'Sector buyers %', 'Total index', 'Sector buyers index'],
      rows: [
        ['Title A', '18.6%', '49.7%', '100', '267'],
        ['Title B', '23.2%', '53.3%', '100', '230'],
        ['Weighted base', '105700000', '4822587', '', ''],
        ['Unweighted base', '10100', '218', '', ''],
        ['DEFF', '1.20', '1.07', '', ''],
      ],
      audience: 'Sector buyers',
      expectColumns: ['Item', 'Total %', 'Sector buyers %'],
    },
    {
      name: 'awareness Total + age',
      columns: ['Stub', 'Total', '18–34', '35–54'],
      rows: [
        ['Aware', '62.0', '71.0', '58.0'],
        ['Unweighted base', '1204', '310', '420'],
        ['Weighted base', '1204', '310', '420'],
      ],
      audience: '',
      expectColumns: ['Stub', 'Total', '18–34', '35–54'],
    },
    {
      name: 'lone Total renamed to audience',
      columns: ['Item', 'Total'],
      rows: [
        ['Brand One', '41.2% idx 100'],
        ['Brand Two', '33.0% idx 100'],
        ['Unweighted base', '88'],
        ['Weighted base', '2100000'],
      ],
      audience: 'Weekend travellers',
      expectColumns: ['Item', 'Weekend travellers'],
    },
  ])(
    'TEN-267: slide table keeps columns for $name and moves bases to footer',
    ({ columns, rows, audience, expectColumns }) => {
      const table = { title: 'Reach', columns, rows };
      const slide = slideTableFromRunTable(table, { audienceLabel: audience });
      expect(slide?.columns).toEqual(expectColumns);
      expect(slide?.rows.every(row => !/base|deff/i.test(row[0] || ''))).toBe(true);
      expect(JSON.stringify(slide?.rows)).not.toMatch(/idx/i);
      const footer = clientBaseFooterFromTable(table, { audienceLabel: audience });
      expect(footer).toMatch(/^Base:/);
      expect(footer).not.toMatch(/deff/i);
      if (audience) expect(footer).toContain(audience);
      expect(stripSlideCellIndex('49.7% idx 100')).toBe('49.7%');
      expect(stripSlideCellIndex('53.3% · idx 230')).toBe('53.3%');
      expect(stripSlideCellIndex('18.6%')).toBe('18.6%');
    }
  );

  it.each([
    {
      op: 'banner_table',
      columns: ['Item', 'Total %', 'US institutional investors %'],
      rows: [
        ['Paper A', '18.6%', '49.7%'],
        ['Paper B', '23.2%', '53.3%'],
        ['Unweighted base', '10100', '218'],
        ['Weighted base', '105700000', '4822587'],
      ],
    },
    {
      op: 'banner',
      columns: ['Stub', 'Total', 'North region'],
      rows: [
        ['Yes', '40.0', '55.0'],
        ['No', '60.0', '45.0'],
        ['Unweighted base', '800', '120'],
      ],
    },
    {
      op: 'frequencies',
      columns: ['Answer', 'Total %', 'Buyers %'],
      rows: [
        ['Daily', '12.0%', '28.0%'],
        ['Weekly', '30.0%', '41.0%'],
        ['Unweighted base', '500', '90'],
      ],
    },
  ])(
    'TEN-267: multi-column $op pin stays a table, not one-series bars',
    ({ op, columns, rows }) => {
      const document = runDocument({
        op,
        report: {
          summary: 'Among the audience, the leaders differ.',
          meta: { title: 'Reach by audience' },
          tables: [{ title: 'Reach by audience', columns, rows }],
        },
        result: {},
      });
      const story = pinStory(document);
      expect(story.bars).toEqual([]);
      expect(story.baseFooter).toMatch(/^Base:/);
      expect(story.baseFooter).not.toMatch(/deff/i);
    }
  );

  it.each([
    { ess: '204.2', expect: '204' },
    { ess: '6347.8', expect: '6,348' },
    { ess: '88.4', expect: '88' },
  ])('TEN-242: Kish footer rounds $ess to a whole count', ({ ess, expect: shown }) => {
    const footer = baseFooterFromTable({
      title: 'Reach',
      columns: ['Item', 'Total'],
      rows: [
        ['Title A', '40.0'],
        ['Weighted base', '1200'],
        ['Unweighted base', '100'],
        ['Effective base (Kish)', ess],
        ['DEFF', '1.20'],
      ],
    });
    expect(footer).toContain(`Effective base (Kish) ${shown}`);
    expect(footer).not.toContain(ess);
    expect(footer).toMatch(/DEFF 1\.2/);
  });
});
