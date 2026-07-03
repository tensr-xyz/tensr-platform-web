import { resolveChatAction } from './chat-actions';

describe('resolveChatAction', () => {
  it('parses sort commands', () => {
    expect(resolveChatAction('sort by Age desc')).toEqual({
      kind: 'sort_column',
      column: 'Age',
      direction: 'desc',
    });
    expect(resolveChatAction('order by Player ascending')).toEqual({
      kind: 'sort_column',
      column: 'Player',
      direction: 'asc',
    });
  });

  it('parses filter commands', () => {
    expect(resolveChatAction('filter Age > 25')).toEqual({
      kind: 'filter_column',
      column: 'Age',
      operator: 'greaterThan',
      value: '25',
    });
    expect(resolveChatAction('where Pos contains SF')).toEqual({
      kind: 'filter_column',
      column: 'Pos',
      operator: 'contains',
      value: 'SF',
    });
  });

  it('parses bulk commands', () => {
    expect(resolveChatAction('clear filters')).toEqual({ kind: 'clear_filters' });
    expect(resolveChatAction('clear sort')).toEqual({ kind: 'clear_sort' });
    expect(resolveChatAction('show hidden columns')).toEqual({
      kind: 'show_hidden_columns',
    });
  });

  it('parses group commands', () => {
    expect(resolveChatAction('group by Team')).toEqual({
      kind: 'group_by',
      column: 'Team',
    });
  });

  it('falls through to chat for unknown input', () => {
    expect(resolveChatAction('hello there')).toEqual({ kind: 'chat' });
  });

  it('falls through to chat for plot/chart intents (inline charts)', () => {
    expect(resolveChatAction('Plot the correlation between minutes and points')).toEqual({
      kind: 'chat',
    });
  });

  it('still opens correlation analysis for analysis questions without plot verbs', () => {
    expect(resolveChatAction("What's the correlation between two numeric columns?")).toEqual({
      kind: 'analysis',
      op: 'correlation',
      menuName: 'Bivariate Correlations',
    });
  });

  it('routes SEM synonyms before filter parsing', () => {
    expect(resolveChatAction('run a structural equation model')).toEqual({
      kind: 'analysis',
      op: 'structural_equation_modelling',
      menuName: 'Structural Equation Modelling (SEM)',
    });
    expect(resolveChatAction('sem model for FG and FGA')).toEqual({
      kind: 'analysis',
      op: 'structural_equation_modelling',
      menuName: 'Structural Equation Modelling (SEM)',
    });
    expect(resolveChatAction('path model with latent factor')).toEqual({
      kind: 'analysis',
      op: 'structural_equation_modelling',
      menuName: 'Structural Equation Modelling (SEM)',
    });
  });

  it('routes moderation and Kendall W before regression synonyms', () => {
    expect(resolveChatAction('run a moderation analysis with FGA and MP')).toEqual({
      kind: 'analysis',
      op: 'moderation_analysis',
      menuName: 'Moderation Analysis',
    });
    expect(resolveChatAction("compute kendall's w for item1 item2 item3")).toEqual({
      kind: 'analysis',
      op: 'kendalls_w',
      menuName: "Kendall's W",
    });
  });
});
