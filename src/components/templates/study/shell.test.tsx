import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StudyShell } from './shell';

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children?: string }) => <div>{children}</div>,
}));

function jsonResponse(body: unknown) {
  return {
    ok: true,
    text: async () => JSON.stringify(body),
  };
}

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: async () =>
      JSON.stringify({ rows: [], variable_names: [], findings: [], specs: [], books: [] }),
  }) as unknown as typeof fetch;
});

describe('StudyShell', () => {
  it('keeps Chat, Sources, and Report as coming next, and opens Responses', () => {
    render(
      <StudyShell
        project={{ id: 'p1', name: 'Brand tracker' }}
        datasets={[{ id: 'ds', original_filename: 'w4.sav' }]}
        onBack={() => undefined}
      />
    );
    expect(screen.getByRole('heading', { name: 'Brand tracker' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    expect(screen.getByText('Coming next.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sources' }));
    expect(screen.getByText('Coming next.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Report' }));
    expect(screen.getByText('Coming next.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Responses' }));
    expect(screen.queryByText('Coming next.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Weighting' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tables' }));
    expect(screen.getByRole('heading', { name: 'Ask about this table' })).toBeTruthy();
  });

  it('reads the selected cell bitset and does not ask for a paste', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/preview')) {
        return jsonResponse({ variable_names: ['comment_codes', 'gender'], rows: [] });
      }
      if (url.includes('/tables') && init?.method === 'POST') {
        return jsonResponse({
          resolved_weight: 'weight',
          rows: [
            {
              id: 'price',
              label: 'Price',
              column: 'comment_codes',
              source_text_column: 'comment',
              cells: [
                {
                  banner_id: 'gender=F',
                  percent: 40,
                  column_unweighted_n: 25,
                  provenance: { row_uid_bitset: 'bitset-1' },
                },
              ],
            },
          ],
        });
      }
      if (url.includes('/quotes')) {
        return jsonResponse({
          total: 1,
          quotes: [{ respondent_id: 'r1', text: 'too dear' }],
        });
      }
      return jsonResponse({ rows: [], variable_names: [], findings: [], specs: [], books: [] });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(
      <StudyShell
        project={{ id: 'p1', name: 'Brand tracker' }}
        datasets={[{ id: 'ds', original_filename: 'w4.sav' }]}
        onBack={() => undefined}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'evidence' }));
    expect(screen.getByText(/Select a cell in Themes or Tables/)).toBeTruthy();
    expect(screen.queryByPlaceholderText('row_uid_bitset')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'themes' }));
    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThan(2));
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'comment_codes' } });
    fireEvent.change(selects[2], { target: { value: 'gender' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run themes' }));
    fireEvent.click(await screen.findByRole('button', { name: /Price/ }));
    expect(await screen.findByText('too dear')).toBeTruthy();
    const quoteCall = fetchMock.mock.calls.find(call => String(call[0]).includes('/quotes'));
    const body = JSON.parse(String(quoteCall?.[1]?.body));
    expect(body.row_uid_bitset).toBe('bitset-1');
    expect(body.text_column).toBe('comment');
  });

  it('codes with keywords when the organisation is schema only', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/organizations')) {
        return jsonResponse({
          active_organization_id: 'org-1',
          organizations: [{ id: 'org-1', privacy_mode: 'schema_only' }],
        });
      }
      if (url.includes('/preview')) {
        return jsonResponse({ variable_names: ['comment'], rows: [] });
      }
      return jsonResponse({ rows: [], variable_names: [], findings: [], specs: [], books: [] });
    }) as unknown as typeof fetch;
    render(
      <StudyShell
        project={{ id: 'p1', name: 'Brand tracker' }}
        datasets={[{ id: 'ds', original_filename: 'w4.sav' }]}
        onBack={() => undefined}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Code frame' }));
    expect(await screen.findByText('Schema-only studies code with keywords.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Code with Haiku' })).toBeNull();
  });

  it('merges the selected themes', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/open-end/propose')) {
        return jsonResponse({
          codes: [
            { id: 'price', label: 'Price', keywords: ['price'] },
            { id: 'cost', label: 'Cost', keywords: ['cost'] },
          ],
        });
      }
      if (url.includes('/open-end/frame')) {
        return jsonResponse({ ok: true });
      }
      if (url.includes('/preview')) {
        return jsonResponse({ variable_names: ['comment'], rows: [] });
      }
      return jsonResponse({
        rows: [],
        variable_names: [],
        findings: [],
        specs: [],
        books: [],
        organizations: [],
      });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(
      <StudyShell
        project={{ id: 'p1', name: 'Brand tracker' }}
        datasets={[{ id: 'ds', original_filename: 'w4.sav' }]}
        onBack={() => undefined}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Code frame' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Propose' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: /Price/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Cost/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(call => String(call[0]).includes('/open-end/frame'))).toBe(
        true
      )
    );
    const frameCall = fetchMock.mock.calls.find(call =>
      String(call[0]).includes('/open-end/frame')
    );
    expect(JSON.parse(String(frameCall?.[1]?.body))).toMatchObject({
      action: 'merge',
      code_id: 'cost',
      into: 'price',
    });
  });

  it('splits a theme through the codeframe route', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/open-end/propose')) {
        return jsonResponse({
          codes: [{ id: 'price', label: 'Price', keywords: ['price'] }],
        });
      }
      if (url.includes('/open-end/frame')) return jsonResponse({ ok: true });
      if (url.includes('/preview')) {
        return jsonResponse({ variable_names: ['comment'], rows: [] });
      }
      return jsonResponse({ organizations: [], rows: [], variable_names: [], findings: [] });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(
      <StudyShell
        project={{ id: 'p1', name: 'Brand tracker' }}
        datasets={[{ id: 'ds', original_filename: 'w4.sav' }]}
        onBack={() => undefined}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Code frame' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Propose' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Split' }));
    fireEvent.change(screen.getByPlaceholderText('First theme'), { target: { value: 'Cost' } });
    fireEvent.change(screen.getByPlaceholderText('Second theme'), { target: { value: 'Value' } });
    fireEvent.click(screen.getByRole('button', { name: 'Split price' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(call => String(call[0]).includes('/open-end/frame'))).toBe(
        true
      )
    );
    const frameCall = fetchMock.mock.calls.find(call =>
      String(call[0]).includes('/open-end/frame')
    );
    expect(JSON.parse(String(frameCall?.[1]?.body))).toMatchObject({
      action: 'split',
      code_id: 'price',
      parts: [
        { id: 'cost', label: 'Cost' },
        { id: 'value', label: 'Value' },
      ],
    });
  });

  it('loads weighting targets from another dataset in the study', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/preview')) {
        return jsonResponse({ variable_names: ['gender'], rows: [] });
      }
      if (url.includes('/column_frequencies')) {
        return jsonResponse({
          frequencies: [
            { value: 'F', percentage: 0.6 },
            { value: 'M', percentage: 0.4 },
          ],
        });
      }
      if (url.includes('/weights/rake')) {
        return jsonResponse({ diagnostics: { weighting_efficiency: 0.9, kish_ess: 80 } });
      }
      return jsonResponse({ rows: [], variable_names: [], findings: [], specs: [], books: [] });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(
      <StudyShell
        project={{ id: 'p1', name: 'Brand tracker' }}
        datasets={[
          { id: 'ds', original_filename: 'w5.sav' },
          { id: 'w4', original_filename: 'w4.sav' },
        ]}
        onBack={() => undefined}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Weighting' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Target column 1').innerHTML).toContain('gender')
    );
    fireEvent.change(screen.getByLabelText('Target column 1'), { target: { value: 'gender' } });
    fireEvent.change(screen.getByLabelText('Load from'), { target: { value: 'w4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Load targets' }));
    expect(await screen.findByDisplayValue('F')).toBeTruthy();
    expect(screen.getByDisplayValue('60')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Rake' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(call => String(call[0]).includes('/weights/rake'))).toBe(
        true
      )
    );
    const rakeCall = fetchMock.mock.calls.find(call => String(call[0]).includes('/weights/rake'));
    expect(JSON.parse(String(rakeCall?.[1]?.body)).categorical_targets).toEqual({
      gender: { F: 0.6, M: 0.4 },
    });
    expect(await screen.findByText(/90\.0%/)).toBeTruthy();
  });

  it('labels a derived dataset and hides internal columns', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/preview')) {
        return jsonResponse({
          variable_names: ['_row_uid', 'comment', 'comment_coding'],
          rows: [['uid-1', 'late again', { code: 'late' }]],
          n_rows: 1,
          n_rows_matched: 1,
        });
      }
      return jsonResponse({ rows: [], variable_names: [], findings: [] });
    }) as unknown as typeof fetch;
    render(
      <StudyShell
        project={{ id: 'p1', name: 'Brand tracker', active_dataset_id: 'child' }}
        datasets={[
          {
            id: 'child',
            original_filename: 'w4.sav',
            lineage_label: 'coded comments',
          },
        ]}
        onBack={() => undefined}
      />
    );
    expect(screen.getByRole('option', { name: 'w4.sav · coded comments' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'comment' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '_row_uid' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'comment_coding' })).toBeNull();
    expect(screen.getByText(/1.1 of 1/)).toBeTruthy();
  });

  it('proposes a frame before coding with keywords', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/open-end/propose')) {
        return jsonResponse({
          codes: [{ id: 'late', label: 'Late', keywords: ['late'] }],
        });
      }
      if (url.includes('/open-end/apply')) {
        return jsonResponse({
          done: true,
          processed: 4,
          total: 4,
          review_count: 0,
          derived_dataset_id: 'coded-1',
          original_filename: 'w4.sav',
        });
      }
      if (url.includes('/preview')) {
        return jsonResponse({ variable_names: ['comments'], rows: [] });
      }
      return jsonResponse({ organizations: [], rows: [], findings: [] });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(
      <StudyShell
        project={{ id: 'p1', name: 'Brand tracker' }}
        datasets={[{ id: 'ds', original_filename: 'w4.sav' }]}
        onBack={() => undefined}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Code frame' }));
    expect(await screen.findByRole('option', { name: 'comments' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Open-end column'), { target: { value: 'comments' } });
    fireEvent.click(screen.getByRole('button', { name: 'Code with keywords' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(call => String(call[0]).includes('/open-end/apply'))).toBe(
        true
      )
    );
    const applyCall = fetchMock.mock.calls.find(call =>
      String(call[0]).includes('/open-end/apply')
    );
    expect(JSON.parse(String(applyCall?.[1]?.body)).codes).toEqual([
      { id: 'late', label: 'Late', keywords: ['late'] },
    ]);
    expect(await screen.findByText('Coded 4 of 4 comments.')).toBeTruthy();
  });
});
