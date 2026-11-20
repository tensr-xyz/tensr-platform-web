import {
  PALETTE_RECENT_STORAGE_KEY,
  readRecentPaletteActions,
  recentPaletteItemsFromCatalog,
  recordRecentPaletteAction,
} from './palette-recent';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key() {
      return null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

describe('palette recent actions', () => {
  it('stores newest first and dedupes by name', () => {
    const storage = memoryStorage();
    recordRecentPaletteAction('Frequencies', storage, 10);
    recordRecentPaletteAction('Descriptives', storage, 20);
    recordRecentPaletteAction('Frequencies', storage, 30);
    expect(readRecentPaletteActions(storage)).toEqual([
      { name: 'Frequencies', at: 30 },
      { name: 'Descriptives', at: 20 },
    ]);
    expect(storage.getItem(PALETTE_RECENT_STORAGE_KEY)).toContain('Frequencies');
  });

  it('resolves recent names against the catalog and skips retired ones', () => {
    const recent = [
      { name: 'Frequencies', at: 2 },
      { name: 'Retired Op', at: 1 },
      { name: 'Descriptives', at: 0 },
    ];
    const catalog = [{ name: 'Descriptives' }, { name: 'Frequencies' }];
    expect(recentPaletteItemsFromCatalog(recent, catalog).map(item => item.name)).toEqual([
      'Frequencies',
      'Descriptives',
    ]);
  });
});
