import {
  analysisSearchText,
  filterAnalysisItems,
  getAllAnalysisItems,
  normalizeSearchText,
  searchTextMatches,
} from './utils';

const names = (query: string) =>
  filterAnalysisItems(getAllAnalysisItems(), query).map(item => item.name);

describe('⌘K search aliases', () => {
  it('ignores hyphens, spaces and case', () => {
    expect(normalizeSearchText('T-Test')).toBe('ttest');
    expect(normalizeSearchText(' t test ')).toBe('ttest');
    expect(searchTextMatches('Independent-Samples T Test', 'TTEST')).toBe(true);
    expect(searchTextMatches('Independent-Samples T Test', 'independent t')).toBe(true);
    expect(searchTextMatches('Independent-Samples T Test', 'pivot')).toBe(false);
  });

  it.each(['t-test', 'ttest', 't test', 'T-Test', 'student'])(
    'finds both t-tests for "%s"',
    query => {
      expect(names(query)).toEqual(
        expect.arrayContaining(['Independent-Samples T Test', 'Paired-Samples T Test'])
      );
    }
  );

  it('finds the independent t-test for "independent t"', () => {
    const found = names('independent t');
    expect(found).toContain('Independent-Samples T Test');
    expect(found).not.toContain('Paired-Samples T Test');
  });

  it.each([
    ['chi-square', 'Chi-square'],
    ['chi2', 'Chi-square'],
    ['chisq', 'Chi-square'],
    ['crosstab', 'Chi-square'],
    ['anova', 'One-Way ANOVA'],
    ['pearson', 'Bivariate Correlations'],
    ['correlation', 'Bivariate Correlations'],
    ['regression', 'Linear Regression'],
    ['ols', 'Linear Regression'],
    ['mann whitney', 'Mann-Whitney U'],
    ['mannwhitney', 'Mann-Whitney U'],
    ['kruskal', 'Kruskal-Wallis H'],
  ])('"%s" finds %s', (query, name) => {
    expect(names(query)).toContain(name);
  });

  it('includes aliases in the search text', () => {
    const item = getAllAnalysisItems().find(row => row.analysisKey === 'chi_square')!;
    expect(analysisSearchText(item)).toEqual(expect.arrayContaining(['chi2']));
  });

  it('still finds nothing for nonsense', () => {
    expect(names('zzqqxx')).toEqual([]);
  });
});
