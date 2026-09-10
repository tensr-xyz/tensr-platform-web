import { parseOpenTextLexicon } from './analysis-definitions';

describe('parseOpenTextLexicon', () => {
  it('parses theme: keyword lines', () => {
    expect(
      parseOpenTextLexicon('quality: great, excellent\nprice: expensive, cheap\n# comment\nbadline')
    ).toEqual({
      quality: ['great', 'excellent'],
      price: ['expensive', 'cheap'],
    });
  });

  it('returns empty for blank input', () => {
    expect(parseOpenTextLexicon('')).toEqual({});
    expect(parseOpenTextLexicon('   \n')).toEqual({});
  });
});
