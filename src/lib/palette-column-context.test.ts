import {
  getPaletteColumnContext,
  paletteColumnKindFromType,
  setPaletteColumnContext,
  subscribePaletteColumnContext,
} from './palette-column-context';

describe('palette column context', () => {
  afterEach(() => {
    setPaletteColumnContext(null);
  });

  it('maps sheet types onto suggestion kinds', () => {
    expect(paletteColumnKindFromType('numeric')).toBe('numeric');
    expect(paletteColumnKindFromType('INTEGER')).toBe('numeric');
    expect(paletteColumnKindFromType('nominal')).toBe('categorical');
    expect(paletteColumnKindFromType('text')).toBe('text');
    expect(paletteColumnKindFromType('')).toBe('unknown');
  });

  it('notifies subscribers when the focused variable changes', () => {
    const seen: string[] = [];
    const stop = subscribePaletteColumnContext(() => {
      seen.push(getPaletteColumnContext()?.label || '');
    });
    setPaletteColumnContext({ label: 'Age', kind: 'numeric' });
    setPaletteColumnContext({ label: 'Age', kind: 'numeric' });
    setPaletteColumnContext({ label: 'Region', kind: 'categorical' });
    stop();
    expect(seen).toEqual(['Age', 'Region']);
  });
});
