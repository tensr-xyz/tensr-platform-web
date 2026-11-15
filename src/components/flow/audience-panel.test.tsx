import { fireEvent, render, screen } from '@testing-library/react';
import { audienceFilter } from './audience-filter';
import { AudiencePanel } from './audience-panel';

jest.mock('@/lib/tensr-api-url', () => ({
  tensrApiUrl: (path: string) => path,
}));

jest.mock('@/utils/auth', () => ({
  getTensrApiHeaders: () => ({ Authorization: 'Bearer test' }),
}));

describe('audience filter', () => {
  it('keeps every condition and wraps an excluded one as not', () => {
    expect(
      audienceFilter('or', [
        { column: 'place', op: '=', value: '1', exclude: false },
        { column: 'place', op: '=', value: '2', exclude: true },
        { column: '', op: '=', value: '3', exclude: false },
      ])
    ).toEqual({
      combine: 'or',
      filters: [
        { column: 'place', op: '=', value: '1' },
        { op: 'not', combine: 'and', filters: [{ column: 'place', op: '=', value: '2' }] },
      ],
    });
  });
});

describe('audience panel', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('lists a saved audience and asks for a condition before saving', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        audiences: [
          {
            name: 'Regulars',
            label: 'Regulars',
            description: 'People who go often',
            filter: { combine: 'and', filters: [{ column: 'place', op: '=', value: '1' }] },
          },
        ],
      }),
    });
    render(
      <AudiencePanel datasetId="file-1" columns={[{ name: 'place', label: 'Which place' }]} />
    );
    expect(await screen.findByText('Regulars')).toBeTruthy();
    expect(screen.getByText('People who go often')).toBeTruthy();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        name: 'Occasional',
        label: 'Occasional',
        description: 'People who go sometimes',
        filter: { combine: 'and', filters: [{ column: 'place', op: '=', value: '2' }] },
      }),
    });
    fireEvent.change(screen.getByLabelText('Audience name'), { target: { value: 'Occasional' } });
    fireEvent.change(screen.getByLabelText('Audience description'), {
      target: { value: 'People who go sometimes' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save audience' }));
    expect(
      await screen.findByText(
        'An audience needs a name, a description, and at least one condition.'
      )
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
