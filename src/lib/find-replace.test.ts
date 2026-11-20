import {
  DEFAULT_FIND_REPLACE_SCOPES,
  findReplaceAllLabel,
  findReplaceApplyBody,
  findReplaceMatchesLabel,
  findReplacePreviewBody,
  findReplaceSnippet,
  findReplaceVisibleRows,
  formatFindReplaceMatchLine,
  toggleFindReplaceScope,
  type FindReplaceMatch,
} from './find-replace';

describe('find-replace helpers', () => {
  it('keeps at least one scope when toggling chips', () => {
    expect(DEFAULT_FIND_REPLACE_SCOPES).toEqual(['report_text', 'table_labels']);
    const dropped = toggleFindReplaceScope(['report_text'], 'report_text');
    expect(dropped).toEqual(['report_text']);
    expect(toggleFindReplaceScope(['report_text'], 'variable_labels')).toEqual([
      'report_text',
      'variable_labels',
    ]);
  });

  it('builds preview and apply bodies', () => {
    expect(
      JSON.parse(
        findReplacePreviewBody({
          find: 'Brand',
          replace: 'X',
          scopes: ['report_text'],
          caseSensitive: false,
        })
      )
    ).toEqual({
      find: 'Brand',
      replace: 'X',
      dry_run: true,
      case_sensitive: false,
      scopes: ['report_text'],
    });
    expect(
      JSON.parse(
        findReplaceApplyBody({
          find: 'Brand',
          replace: 'X',
          scopes: ['table_labels'],
          caseSensitive: true,
          matchIndex: 0,
        })
      )
    ).toEqual({
      find: 'Brand',
      replace: 'X',
      dry_run: false,
      case_sensitive: true,
      scopes: ['table_labels'],
      match_index: 0,
    });
  });

  it('formats match lines and overflow like Paper 9e', () => {
    const match: FindReplaceMatch = {
      scope: 'report_text',
      path: 'object.text',
      before: 'Brand X leads on trust among buyers',
      page_index: 2,
    };
    expect(findReplaceSnippet(match.before, 'Brand X')).toContain('Brand X');
    expect(formatFindReplaceMatchLine(match, 'Brand X')).toBe(
      `Page 2 · ${findReplaceSnippet(match.before, 'Brand X')}`
    );
    expect(findReplaceMatchesLabel(14)).toBe('14 matches');
    expect(findReplaceMatchesLabel(1)).toBe('1 match');
    expect(findReplaceAllLabel(14)).toBe('Replace all 14');

    const rows = findReplaceVisibleRows(
      [
        match,
        {
          scope: 'table_labels',
          path: 'table_edits.renames.row-1',
          before: 'Brand X (last 30 days)',
        },
        { scope: 'variable_labels', path: 'column.label', before: 'Brand X score', column: 'q1' },
      ],
      'Brand X'
    );
    expect(rows).toHaveLength(3);
    expect(rows[0].line.startsWith('Page 2 ·')).toBe(true);
    expect(rows[1].line.startsWith('Table row ·')).toBe(true);
    expect(rows[2]).toEqual({ key: 'overflow', line: '+ 1 more', overflow: true });
  });
});
