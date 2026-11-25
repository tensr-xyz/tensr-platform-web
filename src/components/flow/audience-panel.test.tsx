import type { ReactElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { audienceDefinitionText, audienceFilter, audienceQuestions } from './audience-filter';
import { AudiencePanel } from './audience-panel';

jest.mock('@/lib/tensr-api-url', () => ({
  tensrApiUrl: (path: string) => path,
}));

jest.mock('@/utils/auth', () => ({
  getTensrApiHeaders: () => ({ Authorization: 'Bearer test' }),
  getStytchBearerForTensrApi: () => 'Bearer test',
}));

function renderPanel(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

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

  it('writes an excluded condition as is not in the definition', () => {
    const columns = [
      {
        name: 'place',
        label: 'Which place',
        value_labels: { '1': 'Often', '2': 'Sometimes' },
      },
    ];
    expect(
      audienceDefinitionText(
        {
          combine: 'and',
          filters: [
            { op: 'not', combine: 'and', filters: [{ column: 'place', op: '=', value: '1' }] },
          ],
        },
        columns
      )
    ).toBe('Which place is not Often');
  });

  it('offers a question by its label and writes the definition in those words', () => {
    const columns = [
      { name: '_row_uid', label: 'Row', value_labels: { a: 'A' } },
      { name: 'q20_switch', label: 'q20_switch' },
      {
        name: 'q20_switch',
        label: 'Likelihood to switch',
        value_labels: { '7': '7', '8': '8', '9': '9', '10': '10' },
      },
    ];
    const offered = audienceQuestions(columns).map(column => column.label);
    expect(offered).toEqual(['Likelihood to switch']);
    expect(
      audienceDefinitionText(
        {
          combine: 'and',
          filters: [{ column: 'q20_switch', op: 'in', value: ['7', '8', '9', '10'] }],
        },
        columns
      )
    ).toBe('Q20 Likelihood to switch is 7–10');
  });

  it('joins answers on the same question instead of repeating the question', () => {
    const columns = [
      {
        name: 'role',
        label: 'Role',
        value_labels: { '1': 'Director', '2': 'Board', '3': 'Manager', '4': 'Lead' },
      },
    ];
    expect(
      audienceDefinitionText(
        {
          combine: 'or',
          filters: [
            { column: 'role', op: '=', value: '1' },
            { column: 'role', op: '=', value: '2' },
          ],
        },
        columns
      )
    ).toBe('Role is Director or Board');
    expect(
      audienceDefinitionText(
        {
          combine: 'or',
          filters: [
            { column: 'role', op: '=', value: '1.0' },
            { column: 'role', op: '=', value: 'Board' },
          ],
        },
        columns
      )
    ).toBe('Role is Director or Board');
  });

  it('uses the stored answer when the column has no code list', () => {
    const columns = [{ name: 'seniority_code', label: 'Seniority' }];
    expect(
      audienceDefinitionText(
        {
          combine: 'or',
          filters: [
            { column: 'seniority_code', op: '=', value: 'C-suite' },
            { column: 'seniority_code', op: '=', value: 'Board / director' },
          ],
        },
        columns
      )
    ).toBe('Seniority is C-suite or Board / director');
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
            used_in: 4,
          },
        ],
      }),
    });
    renderPanel(
      <AudiencePanel
        datasetId="file-1"
        columns={[{ name: 'place', label: 'Which place', value_labels: { '1': 'Often' } }]}
      />
    );
    expect(await screen.findByText('Regulars')).toBeTruthy();
    expect(screen.getByText('Used in 4 answers')).toBeTruthy();
    expect(
      screen.getByText('Regulars').closest('li')?.querySelector('.audience-definition')?.textContent
    ).toBe('Which place is Often');
    expect(screen.queryByText('place', { exact: true })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '+ New audience' }));
    fireEvent.change(screen.getByLabelText('Name · what people will type in chat'), {
      target: { value: 'Occasional' },
    });
    fireEvent.change(screen.getByLabelText('Plain description · shown in answers and footnotes'), {
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

  it('picks an answer from the question instead of a typed code', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ audiences: [] }),
    });
    renderPanel(
      <AudiencePanel
        datasetId="file-1"
        columns={[
          { name: '_row_uid', label: 'Row id', value_labels: { a: 'Hidden' } },
          { name: 'q20_switch', label: 'q20_switch', value_labels: { '1': 'Yes' } },
          {
            name: 'q20_switch',
            label: 'Likelihood to switch',
            value_labels: { '1': 'Yes', '2': 'No' },
          },
        ]}
      />
    );
    expect(await screen.findByText('No audiences yet.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '+ New audience' }));
    expect(screen.queryByText('_row_uid')).toBeNull();
    expect(screen.queryByText('q20_switch')).toBeNull();
    fireEvent.change(screen.getByLabelText('Add a question, search by label'), {
      target: { value: 'Likelihood' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Q20 Likelihood to switch' }));
    expect(screen.getByRole('button', { name: 'Yes' })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: /value/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    fireEvent.change(screen.getByLabelText('Name · what people will type in chat'), {
      target: { value: 'Likely' },
    });
    fireEvent.change(screen.getByLabelText('Plain description · shown in answers and footnotes'), {
      target: { value: 'People who say yes' },
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        name: 'Likely',
        label: 'Likely',
        description: 'People who say yes',
        filter: { combine: 'and', filters: [{ column: 'q20_switch', op: '=', value: '1' }] },
      }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ n: 4, n_total: 10, share: 0.4, weighted_share: null }),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save audience' }));
    expect(await screen.findByText('Likely')).toBeTruthy();
    const post = fetchMock.mock.calls.find(
      call => call[1]?.method === 'POST' && !String(call[0]).endsWith('/preview')
    );
    expect(post).toBeTruthy();
    const body = JSON.parse(String(post?.[1].body));
    expect(body.filter.filters).toEqual([{ column: 'q20_switch', op: '=', value: '1' }]);
  });

  it('shows value labels on a short code list and does not flag a large base', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        audiences: [
          {
            name: 'Leads',
            label: 'Leads',
            description: 'People in the first two roles',
            filter: {
              combine: 'or',
              filters: [
                { column: 'role', op: '=', value: '1' },
                { column: 'role', op: '=', value: '2' },
              ],
            },
            n: 1211,
            share: 0.4,
            weighted_share: 0.42,
            projected_people: 1500,
          },
        ],
      }),
    });
    renderPanel(
      <AudiencePanel
        datasetId="file-1"
        columns={[
          {
            name: 'role',
            label: 'Role',
            value_labels: { '1': 'Director', '2': 'Board', '3': 'Manager', '4': 'Lead' },
          },
        ]}
      />
    );
    expect(
      (await screen.findByText('Leads')).closest('li')?.querySelector('.audience-definition')
        ?.textContent
    ).toBe('Role is Director or Board');
    expect(screen.getByText('n = 1211')).toBeTruthy();
    expect(screen.getByText('1,500 people')).toBeTruthy();
    expect(screen.queryByText(/Low base/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '+ New audience' }));
    fireEvent.change(screen.getByLabelText('Add a question, search by label'), {
      target: { value: 'Role' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Role' }));
    expect(screen.getByRole('button', { name: 'Director' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '1' })).toBeNull();
  });

  it('flags a base under 50', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        audiences: [
          {
            name: 'Small',
            label: 'Small',
            description: 'A small group',
            filter: { combine: 'and', filters: [{ column: 'role', op: '=', value: '1' }] },
            n: 12,
            share: 0.01,
            used_in: 2,
          },
        ],
      }),
    });
    renderPanel(
      <AudiencePanel
        datasetId="file-1"
        columns={[{ name: 'role', label: 'Role', value_labels: { '1': 'Director' } }]}
      />
    );
    expect(await screen.findByText(/Low base/)).toBeTruthy();
    expect(screen.queryByText(/Used in/)).toBeNull();
  });

  it('toggles is to is not so the condition is stored as not', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ audiences: [] }),
    });
    renderPanel(
      <AudiencePanel
        datasetId="file-1"
        columns={[
          {
            name: 'place',
            label: 'Which place',
            value_labels: { '1': 'Often', '2': 'Sometimes' },
          },
        ]}
      />
    );
    expect(await screen.findByText('No audiences yet.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '+ New audience' }));
    fireEvent.change(screen.getByLabelText('Add a question, search by label'), {
      target: { value: 'Which place' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Which place' }));
    fireEvent.click(screen.getByRole('button', { name: 'Often' }));
    fireEvent.click(screen.getByRole('button', { name: /Match operator for Which place/ }));
    expect(
      screen.getByRole('button', { name: /Match operator for Which place/ }).textContent
    ).toMatch(/is not/);
    fireEvent.change(screen.getByLabelText('Name · what people will type in chat'), {
      target: { value: 'Elsewhere' },
    });
    fireEvent.change(screen.getByLabelText('Plain description · shown in answers and footnotes'), {
      target: { value: 'Not the often place' },
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        name: 'Elsewhere',
        label: 'Elsewhere',
        description: 'Not the often place',
        filter: {
          combine: 'and',
          filters: [
            { op: 'not', combine: 'and', filters: [{ column: 'place', op: '=', value: '1' }] },
          ],
        },
      }),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save audience' }));
    expect(await screen.findByText('Elsewhere')).toBeTruthy();
    const post = fetchMock.mock.calls.find(
      call => call[1]?.method === 'POST' && !String(call[0]).endsWith('/preview')
    );
    const body = JSON.parse(String(post?.[1].body));
    expect(body.filter.filters).toEqual([
      { op: 'not', combine: 'and', filters: [{ column: 'place', op: '=', value: '1' }] },
    ]);
  });

  it('flags audiences that did not carry to this file', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        audiences: [],
        unmatched: ['Legacy segment'],
      }),
    });
    renderPanel(
      <AudiencePanel
        datasetId="file-1"
        columns={[{ name: 'role', label: 'Role', value_labels: { '1': 'Director' } }]}
      />
    );
    expect(await screen.findByText(/Did not carry to this file: Legacy segment/)).toBeTruthy();
  });
});
