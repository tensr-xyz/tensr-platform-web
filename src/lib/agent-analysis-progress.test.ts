import { interpretProgressMessage } from './agent-analysis-progress';
import type { AgentAnalysisPlan } from '@/lib/chat-pending-action';

function plan(analysisType: string, spec: Record<string, unknown>): AgentAnalysisPlan {
  return { analysisType, spec };
}

describe('interpretProgressMessage', () => {
  it('uses column list for PCA validating step', () => {
    const msg = interpretProgressMessage(
      plan('pca', { columns: ['PTS', 'AST', 'TRB', 'STL', 'BLK'] }),
      'validating'
    );
    expect(msg).toMatch(/Checking PTS, AST, TRB, STL, BLK look right/i);
    expect(msg).toMatch(/Principal Component Analysis/i);
  });

  it('uses column list for correlation validating step', () => {
    const msg = interpretProgressMessage(
      plan('correlation', { columns: ['PTS', 'AST'] }),
      'validating'
    );
    expect(msg).toMatch(/Checking PTS and AST look right/i);
    expect(msg).toMatch(/Bivariate Correlations/i);
  });

  it('uses regression phrasing for running step', () => {
    const msg = interpretProgressMessage(
      plan('linear_regression', { dependent: 'PTS', independents: ['MP', 'FGA'] }),
      'running'
    );
    expect(msg).toMatch(/Running Linear Regression predicting \*\*PTS\*\* from MP, FGA/i);
  });

  it('uses factor names for two-way ANOVA validating step', () => {
    const msg = interpretProgressMessage(
      plan('anova_twoway', { factor_a: 'Pos', factor_b: 'Tm', value_column: 'PTS' }),
      'validating'
    );
    expect(msg).toMatch(/Checking Pos, Tm and PTS look right/i);
  });

  it('uses column_a and column_b when columns array is absent', () => {
    const msg = interpretProgressMessage(
      plan('correlation', { column_a: 'PTS', column_b: 'AST' }),
      'validating'
    );
    expect(msg).toMatch(/Checking PTS and AST look right/i);
  });

  it('prefers columns array over group_column and value_column', () => {
    const msg = interpretProgressMessage(
      plan('pca', {
        columns: ['PTS', 'AST', 'TRB'],
        group_column: 'group',
        value_column: 'outcome',
      }),
      'validating'
    );
    expect(msg).toMatch(/Checking PTS, AST, TRB look right/i);
    expect(msg).not.toMatch(/group/i);
    expect(msg).not.toMatch(/outcome/i);
  });

  it('falls back to generic columns phrase when spec has no known fields', () => {
    const msg = interpretProgressMessage(plan('descriptives', {}), 'validating');
    expect(msg).toMatch(/Checking your columns look right for a Frequencies/i);
  });
});
