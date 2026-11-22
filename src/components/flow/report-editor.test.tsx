import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { previewGridFromBannerBook, ReportEditor } from './report-editor';

function renderEditor(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

jest.mock('@/lib/flow-api', () => ({
  flowJson: jest.fn(async (path: string, init?: { method?: string; body?: string }) => {
    if (String(path).includes('/tables/spec-live')) {
      return {
        ok: true,
        title: 'Frequency Table: Prompted awareness',
        base_label: 'Base: all respondents (1,204)',
        weight: { weight_aware: true, weighted_n: 1204, unweighted_n: 1204 },
        significance_display: 'column_letters',
        significance_alpha: 0.05,
        letters: [{ row: 'aware', col: 'young', letters: 'c' }],
        banner_columns: [
          { id: 'total', label: 'Total' },
          { id: 'young', label: '18–34' },
        ],
        rows: [
          {
            id: 'aware',
            label: 'Prompted awareness',
            cells: [
              { banner_id: 'total', percent: 62 },
              { banner_id: 'young', percent: 71 },
            ],
          },
        ],
      };
    }
    if (String(path).includes('/report/document') && (!init || init.method === 'GET')) {
      return {
        ok: true,
        has_document: true,
        document: {
          pages: [
            {
              id: 'page-a',
              title: 'Finding',
              layout_id: 'title_and_content',
              objects: [
                {
                  id: 'text-a',
                  kind: 'text',
                  frame: { x: 0.1, y: 0.1, w: 0.6, h: 0.2 },
                  text: 'Awareness is up',
                  text_style: { font_size_pt: 22, bold: true },
                  z_index: 1,
                },
                {
                  id: 'text-b',
                  kind: 'text',
                  frame: { x: 0.1, y: 0.4, w: 0.6, h: 0.2 },
                  text: 'Second box',
                  text_style: { font_size_pt: 14, bold: false },
                  z_index: 2,
                },
                {
                  id: 'table-a',
                  kind: 'table',
                  table_spec_id: 'spec-live',
                  frame: { x: 0.08, y: 0.55, w: 0.84, h: 0.35 },
                  table_style: { preset: 'default' },
                  table_rules: [],
                  table_edits: {},
                  z_index: 3,
                },
              ],
            },
          ],
          default_labels: { net: 'NET', total: 'Total' },
        },
      };
    }
    if (init?.method === 'PUT') {
      return { ok: true, document: JSON.parse(String(init.body || '{}')).document, n_pages: 1 };
    }
    return { ok: true };
  }),
}));

describe('previewGridFromBannerBook', () => {
  it('builds percent rows from a banner book and never invents placeholder labels', () => {
    const grid = previewGridFromBannerBook({
      banner_columns: [
        { id: 'total', label: 'Total' },
        { id: 'south', label: 'South' },
      ],
      rows: [
        {
          id: 'region_south',
          label: 'South',
          cells: [
            { banner_id: 'total', percent: 40.4 },
            { banner_id: 'south', percent: 100 },
          ],
        },
      ],
    });
    expect(grid[0]).toEqual(['', 'Total', 'South']);
    expect(grid[1]).toEqual(['South', '40.4%', '100%']);
    expect(JSON.stringify(grid)).not.toMatch(/Row one|Group A/);
  });
});

describe('ReportEditor formatting', () => {
  it('loads live table numbers instead of placeholder rows', async () => {
    renderEditor(<ReportEditor datasetId="ds-1" pins={[]} />);
    expect(await screen.findByText('62%')).toBeTruthy();
    expect(screen.getByText('71%')).toBeTruthy();
    expect(screen.queryByText('Row one')).toBeNull();
    expect(screen.queryByText('Group A')).toBeNull();
    // Question title + base caption on the canvas; house style stays in the inspector only.
    expect(screen.getAllByText('Prompted awareness').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/Base: all respondents \(1,204\) · Weighted · Letters: 95% vs column/)
    ).toBeTruthy();
    const page = screen.getByLabelText('Finding');
    expect(within(page).queryByText(/^House$/)).toBeNull();
  });

  it('formats selected text, paints styles, and renames default labels', async () => {
    renderEditor(<ReportEditor datasetId="ds-1" pins={[]} />);

    expect(await screen.findByRole('toolbar', { name: 'Report formatting' })).toBeTruthy();
    expect(screen.getByText('Awareness is up')).toBeTruthy();

    fireEvent.click(screen.getByText('Awareness is up'));
    fireEvent.click(screen.getByRole('button', { name: 'I' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'I' }).getAttribute('aria-pressed')).toBe('true')
    );

    fireEvent.click(screen.getByRole('button', { name: 'Format painter' }));
    fireEvent.click(screen.getByText('Second box'));
    fireEvent.click(screen.getByText('Second box'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'I' }).getAttribute('aria-pressed')).toBe('true')
    );

    const net = screen.getByDisplayValue('NET');
    fireEvent.change(net, { target: { value: 'Combined' } });
    expect(await screen.findByText(/Preview: Combined · Total/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Text' }));
    expect(await screen.findByDisplayValue('New text')).toBeTruthy();
  });

  it('styles a table, adds rules, and edits rows from the 9a chrome', async () => {
    renderEditor(<ReportEditor datasetId="ds-1" pins={[]} />);

    expect(await screen.findByRole('toolbar', { name: 'Report formatting' })).toBeTruthy();
    fireEvent.click(await screen.findByText('62%'));

    const inspector = screen.getByLabelText('Object inspector');
    expect(within(inspector).getByText('Table style')).toBeTruthy();
    fireEvent.click(within(inspector).getByRole('button', { name: 'House' }));

    fireEvent.click(within(inspector).getByRole('button', { name: 'Banded' }));
    await waitFor(() =>
      expect(
        within(inspector).getByRole('button', { name: 'Banded' }).getAttribute('data-active')
      ).toBe('true')
    );

    fireEvent.click(within(inspector).getByRole('button', { name: '+ Add rule' }));
    fireEvent.click(within(inspector).getByRole('option', { name: 'Amber when base under 50' }));
    expect(
      await within(inspector).findByRole('button', { name: 'Amber when base under 50' })
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Edit cells' }));
    const rowInput = within(inspector).getByPlaceholderText('Category to edit');
    fireEvent.change(rowInput, { target: { value: 'Prompted awareness' } });
    fireEvent.click(within(inspector).getByRole('button', { name: 'Rename' }));
    expect(await within(inspector).findByText('Prompted awareness')).toBeTruthy();

    fireEvent.click(within(inspector).getByRole('button', { name: 'Hide' }));
    expect(await within(inspector).findByText('Prompted awareness (hidden)')).toBeTruthy();
  });

  it('inserts a live value from the 9a toolbar and binds it in the inspector', async () => {
    renderEditor(<ReportEditor datasetId="ds-1" pins={[]} />);

    expect(await screen.findByRole('toolbar', { name: 'Report formatting' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '+ Live value' }));

    const inspector = screen.getByLabelText('Object inspector');
    expect(await within(inspector).findByText('Live value')).toBeTruthy();
    expect(
      within(inspector).getByRole('button', { name: 'Cell value' }).getAttribute('data-active')
    ).toBe('true');
    expect(within(inspector).getByText(/Updates when the data or wave changes/)).toBeTruthy();
    expect(within(inspector).getByLabelText('Row label')).toBeTruthy();
    expect(within(inspector).getByLabelText('Source table')).toBeTruthy();

    fireEvent.click(within(inspector).getByRole('button', { name: 'Page no.' }));
    await waitFor(() =>
      expect(
        within(inspector).getByRole('button', { name: 'Page no.' }).getAttribute('data-active')
      ).toBe('true')
    );
    expect(within(inspector).getByText('This report')).toBeTruthy();

    fireEvent.click(within(inspector).getByRole('button', { name: 'Base' }));
    await waitFor(() =>
      expect(
        within(inspector).getByRole('button', { name: 'Base' }).getAttribute('data-active')
      ).toBe('true')
    );
    expect(within(inspector).getByText('Sample size')).toBeTruthy();
  });
});
