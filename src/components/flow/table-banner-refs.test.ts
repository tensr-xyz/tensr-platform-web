import {
  audienceBannerSizeLabel,
  bannerRefsFromSpec,
  bannerRequestItems,
  tableBannerKey,
} from '@/components/flow/table-banner-refs';

describe('table banner refs (TEN-105 / Paper 5d)', () => {
  it('formats projected people and n like the banner picker', () => {
    expect(audienceBannerSizeLabel({ n: 1211, projected_people: 1_565_852 })).toBe(
      '1,566k · n 1,211'
    );
    expect(audienceBannerSizeLabel({ n: 168, projected_people: 261_000 })).toBe('261k · n 168');
    expect(audienceBannerSizeLabel({ n: 40 })).toBe('n 40');
  });

  it('restores a saved audience banner and a question from the table spec', () => {
    expect(
      bannerRefsFromSpec({
        banners: [
          {
            audience: 'seniors',
            label: 'Senior decision makers',
            filter: {
              combine: 'or',
              filters: [
                { column: 'seniority', op: '=', value: '1' },
                { column: 'seniority', op: '=', value: '2' },
              ],
            },
          },
          { columns: ['market'], label: 'Market' },
        ],
      })
    ).toEqual([
      {
        kind: 'audience',
        name: 'seniors',
        label: 'Senior decision makers',
        filter: {
          combine: 'or',
          filters: [
            { column: 'seniority', op: '=', value: '1' },
            { column: 'seniority', op: '=', value: '2' },
          ],
        },
      },
      { kind: 'column', column: 'market' },
    ]);
  });

  it('sends an audience as a banner column entry, not a row filter', () => {
    expect(
      bannerRequestItems([
        { kind: 'audience', name: 'seniors', label: 'Senior decision makers' },
        { kind: 'column', column: 'gender' },
      ])
    ).toEqual([{ label: 'Senior decision makers', audience: 'seniors' }, { column: 'gender' }]);
    expect(tableBannerKey({ kind: 'audience', name: 'seniors', label: 'X' })).toBe(
      'audience:seniors'
    );
  });
});
