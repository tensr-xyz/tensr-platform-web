import { matchWave } from './wave-match';

describe('wave match', () => {
  it('matches by name, then by label, and lists what is missing', () => {
    const matched = matchWave(
      [
        { name: 'q1', label: 'Age' },
        { name: 'q2', label: 'Role' },
        { name: 'q3', label: 'City' },
      ],
      [
        { name: 'q1', label: 'Age band' },
        { name: 'role_w2', label: 'Role' },
      ]
    );
    expect(matched.byName).toEqual(['q1']);
    expect(matched.byLabel).toEqual([{ previous: 'q2', next: 'role_w2', label: 'Role' }]);
    expect(matched.missing).toEqual(['City']);
  });
});
