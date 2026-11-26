import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { flowJson } from '@/lib/flow-api';
import {
  labelledPageTableFromRunTables,
  preferAffirmativeRowFirst,
  previewGridFromBannerBook,
  ReportEditor,
  shareBarsFromBannerBook,
} from './report-editor';
import { tablePreviewTitle } from '@/lib/report-document';

jest.mock('@/lib/flow-api', () => ({
  flowJson: jest.fn(),
}));

const mockedFlowJson = flowJson as jest.MockedFunction<typeof flowJson>;

const defaultDocument = {
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

async function defaultFlowJson(path: string, init?: { method?: string; body?: string }) {
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
  if (String(path).includes('/report/document') && (!init?.method || init.method === 'GET')) {
    return defaultDocument;
  }
  if (init?.method === 'PUT') {
    return { ok: true, document: JSON.parse(String(init.body || '{}')).document, n_pages: 1 };
  }
  return { ok: true };
}

function renderEditor(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  mockedFlowJson.mockImplementation(defaultFlowJson as typeof flowJson);
});

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

  it('leads yes/no rows with Yes and builds chart bars from the book', () => {
    const book = {
      banner_columns: [{ id: 'total', label: 'Total' }],
      rows: [
        {
          id: 'n',
          kind: 'value',
          label: 'No',
          cells: [{ banner_id: 'total', percent: 22.9 }],
        },
        {
          id: 'y',
          kind: 'value',
          label: 'Yes',
          cells: [{ banner_id: 'total', percent: 77.1 }],
        },
      ],
    };
    expect(preferAffirmativeRowFirst(book.rows).map(row => row.label)).toEqual(['Yes', 'No']);
    const grid = previewGridFromBannerBook(book);
    expect(grid[1]?.[0]).toBe('Yes');
    expect(grid[2]?.[0]).toBe('No');
    expect(shareBarsFromBannerBook(book).map(bar => bar.label)).toEqual(['Yes', 'No']);
  });
});

describe('labelledPageTableFromRunTables', () => {
  it('keeps long Spearman axis labels instead of indexes', () => {
    const labelled = labelledPageTableFromRunTables([
      {
        title: 'Spearman correlations',
        columns: [
          'Variable',
          'How often do you brew coffee at home on a weekday morning?',
          'How important is aroma when choosing a bag of beans?',
        ],
        rows: [
          ['How often do you brew coffee at home on a weekday morning?', '1.000', '0.610'],
          ['How important is aroma when choosing a bag of beans?', '0.610', '1.000'],
        ],
      },
    ]);
    expect(labelled?.title).toBe('Spearman correlations');
    expect(labelled?.rows[0]).toEqual([
      'Variable',
      'How often do you brew coffee at home on a weekday morning?',
      'How important is aroma when choosing a bag of beans?',
    ]);
    expect(labelled?.rows[1]?.[0]).toContain('brew coffee');
    expect(JSON.stringify(labelled?.rows)).not.toMatch(/"1"|"2"/);
  });

  it('expands a legacy Columns key onto both axes for Pearson matrices', () => {
    const labelled = labelledPageTableFromRunTables([
      {
        title: 'Pearson correlations',
        columns: ['Variable', '1', '2'],
        rows: [
          ['1', '1.000', '0.768*** (n=500)'],
          ['2', '0.768*** (n=500)', '1.000'],
        ],
      },
      {
        title: 'Columns',
        columns: ['Column', 'Label'],
        rows: [
          ['1', 'Overall satisfaction with your most recent visit'],
          ['2', 'Likelihood to recommend this brand to a friend'],
        ],
      },
    ]);
    expect(labelled?.title).toBe('Pearson correlations');
    expect(labelled?.rows[0]).toEqual([
      'Variable',
      'Overall satisfaction with your most recent visit',
      'Likelihood to recommend this brand to a friend',
    ]);
    expect(labelled?.rows[1]?.[0]).toBe('Overall satisfaction with your most recent visit');
    expect(labelled?.rows[2]?.[0]).toBe('Likelihood to recommend this brand to a friend');
    expect(labelled?.rows.flat().some(cell => cell === '1' || cell === '2')).toBe(false);
  });

  it('keeps short Kendall labels and weighted pair wording without inventing codes', () => {
    const labelled = labelledPageTableFromRunTables([
      {
        title: 'Kendall correlation',
        columns: ['Variables', 'τ', 'p', 'n'],
        rows: [['Price paid with Taste', '0.20', '0.040', '1,204 (weighted)']],
      },
    ]);
    expect(labelled?.title).toBe('Kendall correlation');
    expect(labelled?.rows[0]).toEqual(['Variables', 'τ', 'p', 'n']);
    expect(labelled?.rows[1]?.[0]).toBe('Price paid with Taste');
    expect(labelled?.rows[1]?.[3]).toContain('weighted');
    expect(labelled?.rows.flat().some(cell => /^[0-9]+$/.test(cell))).toBe(false);
  });

  it('page tables carry the question label above the grid, never a frequency code', () => {
    expect(tablePreviewTitle({ title: 'Frequency Table: Prompted awareness by age' })).toBe(
      'Prompted awareness by age'
    );
    expect(tablePreviewTitle({ title: 'Does culture shape advice?' })).toBe(
      'Does culture shape advice?'
    );
    const grid = previewGridFromBannerBook({
      title: 'Which materials do you prefer for patient education?',
      banner_columns: [
        { id: 'total', label: 'Total' },
        { id: 'print', label: 'Print' },
      ],
      rows: [
        {
          id: 'prefer',
          label: 'Prefer this channel',
          cells: [
            { banner_id: 'total', percent: 54.2 },
            { banner_id: 'print', percent: 61 },
          ],
        },
      ],
    });
    expect(grid[0]).toEqual(['', 'Total', 'Print']);
    expect(grid[1]?.[0]).toBe('Prefer this channel');
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

  it('shows an empty state instead of Loading pages… when no document is stored', async () => {
    mockedFlowJson.mockImplementation(async (path: string) => {
      if (String(path).includes('/report/document')) {
        return { ok: true, has_document: false, document: null };
      }
      return { ok: true };
    });
    renderEditor(<ReportEditor datasetId="ds-empty" pins={[]} />);
    expect(await screen.findByTestId('report-editor-empty')).toBeTruthy();
    expect(screen.getByText('No pages yet')).toBeTruthy();
    expect(screen.queryByText('Loading pages…')).toBeNull();
  });

  it('opens a layout picker on Add page and exposes report theme controls', async () => {
    renderEditor(<ReportEditor datasetId="ds-1" pins={[]} />);
    expect(await screen.findByRole('toolbar', { name: 'Report formatting' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Add page' }));
    expect(await screen.findByRole('dialog', { name: 'Add a page' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Title page/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Headline \+ chart/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Blank$/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Headline \+ chart/i }));
    await waitFor(() => expect(screen.getByLabelText('Page 2: Page 2')).toBeTruthy());
    // Layout mounts headline + empty chart placeholders (not a blank page).
    const slide = screen.getByLabelText(/^Page 2$/);
    expect(within(slide).getByText('Page 2')).toBeTruthy();
    expect(within(slide).getByText('Chart')).toBeTruthy();
    expect(slide.querySelector('.report-editor-object[data-kind="chart"]')).toBeTruthy();
    expect(slide.querySelector('.report-editor-object[data-kind="text"]')).toBeTruthy();

    const inspector = screen.getByLabelText('Object inspector');
    fireEvent.click(within(inspector).getByRole('button', { name: 'Report theme' }));
    expect(await within(inspector).findByLabelText('Report theme')).toBeTruthy();
    expect(within(inspector).getByText(/Applies to every page/)).toBeTruthy();
    expect(within(inspector).getByRole('button', { name: 'Save as team theme' })).toBeTruthy();
    expect(within(inspector).getByRole('button', { name: 'From a .pptx' })).toBeTruthy();

    fireEvent.contextMenu(screen.getByLabelText('Page 1: Finding'));
    expect(await screen.findByRole('menu', { name: 'Page actions' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Save page as template' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Hide from export' })).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate page' }));
    await waitFor(() => expect(screen.getByLabelText(/Page 2: Finding \(copy\)/)).toBeTruthy());
  });
});
