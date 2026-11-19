import {
  estimateOfficeDeckSeconds,
  groupReportExportPages,
  pagesFromReportDocument,
  reportPageGroupKey,
} from '@/lib/office-deck-job';

describe('reportPageGroupKey', () => {
  it('maps executive summary, insights and appendix sections', () => {
    expect(reportPageGroupKey('Executive summary', 'Study intro')).toBe('summary');
    expect(reportPageGroupKey('Insights', 'Where respondents are based')).toBe('insights');
    expect(reportPageGroupKey('Appendix', 'Region')).toBe('appendix');
  });
});

describe('pagesFromReportDocument / groupReportExportPages', () => {
  it('groups pages and keeps appendix collapsed by default', () => {
    const pages = pagesFromReportDocument({
      pages: [
        { id: 's1', title: 'Study intro', section: 'Executive summary' },
        {
          id: 'i1',
          title: 'Where respondents are based',
          section: 'Insights',
          objects: [{ table_spec_id: 'spec-region' }],
        },
        { id: 'i2', title: 'Profession mix', section: 'Insights' },
        { id: 'a1', title: 'Region', section: 'Appendix', objects: [{ tableSpecId: 'spec-a' }] },
        { id: 'a2', title: 'Profession', section: 'Appendix' },
      ],
    });
    expect(pages).toHaveLength(5);
    expect(pages[1].tableSpecId).toBe('spec-region');
    const groups = groupReportExportPages(pages);
    expect(groups.map(group => group.key)).toEqual(['summary', 'insights', 'appendix']);
    expect(groups.find(group => group.key === 'insights')?.defaultExpanded).toBe(true);
    expect(groups.find(group => group.key === 'appendix')?.defaultExpanded).toBe(false);
    expect(groups.find(group => group.key === 'summary')?.pages).toHaveLength(1);
  });
});

describe('estimateOfficeDeckSeconds', () => {
  it('scales with page count without going below a usable floor', () => {
    expect(estimateOfficeDeckSeconds(0)).toBe(15);
    expect(estimateOfficeDeckSeconds(39)).toBeGreaterThanOrEqual(20);
    expect(estimateOfficeDeckSeconds(39)).toBeLessThanOrEqual(180);
  });
});
