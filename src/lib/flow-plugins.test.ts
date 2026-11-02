import {
  installCount,
  installErrorMessage,
  languageAccepted,
  PLUGIN_CURRENCY,
  pluginByline,
  pluginLanguageChoices,
  pluginMatches,
  reviewLines,
  type FlowPlugin,
} from './flow-plugins';

const column: FlowPlugin = {
  pluginId: 'column-summary',
  name: 'Column Summary',
  description: 'One-click profile of any column',
  authorName: 'Tensr',
  language: 'typescript',
  tags: ['Cleaning'],
  revenue: { totalDownloads: 0 },
};

const house: FlowPlugin = {
  pluginId: 'maxdiff',
  name: 'MaxDiff anchored scaling',
  description: 'House method',
  authorId: 'user-1',
  authorName: 'Skopos',
  language: 'python',
  tags: ['Survey methods'],
  revenue: { totalDownloads: 1200 },
};

describe('plugin catalog cuts', () => {
  it('keeps a tag match and a team plugin, and drops sample download zeros', () => {
    const options = {
      category: 'Cleaning' as const,
      query: '',
      mine: false,
      installed: new Set<string>(),
      userIds: ['user-1'],
    };
    expect(pluginMatches(column, options)).toBe(true);
    expect(pluginMatches(house, options)).toBe(false);
    expect(pluginMatches(house, { ...options, category: 'Your team', query: 'anchored' })).toBe(
      true
    );
    expect(pluginMatches(column, { ...options, category: 'All', mine: true })).toBe(false);
    expect(installCount(column)).toBeNull();
    expect(installCount(house)).toBe('1.2k installs');
    expect(pluginByline(column)).toBe('TypeScript · by Tensr');
  });

  it('reads an install refusal from the API body', () => {
    expect(installErrorMessage(new Error('{"detail":"Purchase required"}'))).toBe(
      'Purchase required'
    );
  });

  it('accepts the languages the upload route stores and reports a real review state', () => {
    expect(languageAccepted('typescript')).toBe(true);
    expect(languageAccepted('python')).toBe(false);
    expect(
      pluginLanguageChoices()
        .filter(item => item.soon)
        .map(item => item.id)
    ).toEqual(['python', 'r']);
    expect(PLUGIN_CURRENCY).toBe('gbp');
    expect(reviewLines({ status: 'PENDING', scanResults: { passed: true } })).toEqual([
      'Static scan passed',
      'Manual review pending',
    ]);
    expect(reviewLines({ status: 'APPROVED' })).toEqual(['Published']);
  });
});
