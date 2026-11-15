import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('lists a saved audience and saves a new one with its description', async () => {
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
    fireEvent.change(screen.getByLabelText('Condition 1 question'), { target: { value: 'place' } });
    fireEvent.change(screen.getByLabelText('Condition 1 value'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save audience' }));
    await waitFor(() => expect(screen.getByText('Occasional')).toBeTruthy());
    const saveCall = fetchMock.mock.calls[1];
    expect(saveCall[0]).toBe('/datasets/file-1/audiences');
    expect(saveCall[1].method).toBe('POST');
    const sent = JSON.parse(String(saveCall[1].body));
    expect(sent.description).toBe('People who go sometimes');
    expect(sent.filter.filters).toEqual([{ column: 'place', op: '=', value: '2' }]);
  });
});
