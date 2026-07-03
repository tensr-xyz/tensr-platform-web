import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Notebook } from './index';
import { useTabsStore } from '@/stores/tabs-store';
import { useNotebookWorkspaceStore } from '@/stores/notebook-workspace-store';
import { apiClient } from '@/lib/api-client';
import { ViewType } from '@/stores/tabs-store';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: ({
    value,
    onChange,
    defaultLanguage,
  }: {
    value: string;
    onChange: (v: string) => void;
    defaultLanguage: string;
  }) => (
    <textarea
      data-testid={`monaco-editor-${defaultLanguage}`}
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  ),
}));

jest.mock('@/contexts/theme-context', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

jest.mock('@/components/organisms/markdown-viewer', () => ({
  __esModule: true,
  default: ({ content }: { content: string }) => <div data-testid="markdown-viewer">{content}</div>,
}));

jest.mock('@/lib/tensr-api-url', () => ({
  getTensrApiBaseUrl: () => 'http://localhost:8000',
}));

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    execute: {
      python: jest.fn(),
      r: jest.fn(),
    },
  },
}));

jest.mock('@/lib/workspace-dataset', () => ({
  getDatasetIdFromTab: jest.fn(() => null),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

function seedTab() {
  useTabsStore.getState().addTab({
    name: 'Test Sheet',
    content: '',
    isDirty: false,
    type: ViewType.SPREADSHEET,
    data: {
      initialData: [
        { id: 1, value: 'a' },
        { id: 2, value: 'b' },
      ],
    },
  });
}

function resetStores() {
  useTabsStore.getState().reset();
  useNotebookWorkspaceStore.getState().reset();
}

/** Returns the run button (no title attribute, distinct from the convert buttons). */
function getRunButton() {
  return screen
    .getAllByRole('button')
    .find(
      b =>
        b.getAttribute('title') !== 'Convert to markdown cell' &&
        b.getAttribute('title') !== 'Convert to code cell'
    );
}

/** Runs the selected cell via the Zustand controls (avoids button selection fragility). */
async function runSelectedCell() {
  await act(async () => {
    await useNotebookWorkspaceStore.getState().controls.runSelected();
  });
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('Notebook component', () => {
  beforeEach(() => {
    resetStores();
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Basic rendering
  // -------------------------------------------------------------------------

  describe('initial render', () => {
    it('renders with no active tab', () => {
      render(<Notebook />);
      expect(screen.getByTestId('monaco-editor-python')).toBeInTheDocument();
    });

    it('renders default code cell content when no active tab', () => {
      render(<Notebook />);
      expect(screen.getByTestId('monaco-editor-python')).toHaveValue(
        '# Access the active tab data using "df" variable\nprint(df.head())'
      );
    });

    it('renders when an active tab with data is present', () => {
      seedTab();
      render(<Notebook />);
      expect(screen.getByTestId('monaco-editor-python')).toBeInTheDocument();
    });

    it('shows the initial execution count placeholder', () => {
      render(<Notebook />);
      expect(screen.getByText('[ ]')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Cell execution
  // -------------------------------------------------------------------------

  describe('cell execution', () => {
    it('executes a cell and displays stdout', async () => {
      seedTab();
      mockApiClient.execute.python.mockResolvedValueOnce({
        stdout: 'hello world',
        output: null,
        error: null,
      });

      render(<Notebook />);
      await runSelectedCell();

      await waitFor(() => {
        expect(screen.getByText('hello world')).toBeInTheDocument();
      });
    });

    it('increments execution count after running a cell', async () => {
      seedTab();
      mockApiClient.execute.python.mockResolvedValueOnce({
        stdout: null,
        output: null,
        error: null,
      });

      render(<Notebook />);
      await runSelectedCell();

      await waitFor(() => {
        expect(screen.getByText('[1]')).toBeInTheDocument();
      });
    });

    it('displays error output when execution fails', async () => {
      seedTab();
      mockApiClient.execute.python.mockResolvedValueOnce({
        stdout: null,
        output: null,
        error: 'NameError: name "x" is not defined',
      });

      render(<Notebook />);
      await runSelectedCell();

      await waitFor(() => {
        expect(screen.getByText('NameError: name "x" is not defined')).toBeInTheDocument();
      });
    });

    it('surfaces error when apiClient.execute.python throws', async () => {
      seedTab();
      mockApiClient.execute.python.mockRejectedValueOnce(new Error('Network error'));

      render(<Notebook />);
      await runSelectedCell();

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('does not call execute API when there is no active tab data (canRun = false)', () => {
      render(<Notebook />);
      expect(useNotebookWorkspaceStore.getState().controls.canRun).toBe(false);
    });

    it('calls apiClient.execute.r when language is r', async () => {
      seedTab();
      mockApiClient.execute.r.mockResolvedValueOnce({
        stdout: 'r output',
        output: null,
        error: null,
      });

      render(<Notebook />);

      await act(async () => {
        useNotebookWorkspaceStore.getState().controls.setLanguage('r');
      });

      await waitFor(() => {
        expect(useNotebookWorkspaceStore.getState().controls.language).toBe('r');
      });

      await runSelectedCell();

      await waitFor(() => {
        expect(mockApiClient.execute.r).toHaveBeenCalled();
      });
    });

    it('renders text output type', async () => {
      seedTab();
      mockApiClient.execute.python.mockResolvedValueOnce({
        stdout: null,
        output: { type_: 'text', data: 'some text output' },
        error: null,
      });

      render(<Notebook />);
      await runSelectedCell();

      await waitFor(() => {
        expect(screen.getByText('some text output')).toBeInTheDocument();
      });
    });

    it('renders table output type', async () => {
      seedTab();
      mockApiClient.execute.python.mockResolvedValueOnce({
        stdout: null,
        output: {
          type_: 'table',
          data: [
            { col1: 'A', col2: '1' },
            { col1: 'B', col2: '2' },
          ],
        },
        error: null,
      });

      render(<Notebook />);
      await runSelectedCell();

      await waitFor(() => {
        expect(screen.getByText('col1')).toBeInTheDocument();
        expect(screen.getByText('col2')).toBeInTheDocument();
        expect(screen.getByText('A')).toBeInTheDocument();
      });
    });

    it('renders plot output type as an img', async () => {
      seedTab();
      mockApiClient.execute.python.mockResolvedValueOnce({
        stdout: null,
        output: { type_: 'plot', data: { data: 'base64encodedimage' } },
        error: null,
      });

      render(<Notebook />);
      await runSelectedCell();

      await waitFor(() => {
        const img = screen.getByRole('img', { name: 'Plot' });
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', 'data:image/png;base64,base64encodedimage');
      });
    });

    it('parses JSON from stdout when output is null', async () => {
      seedTab();
      mockApiClient.execute.python.mockResolvedValueOnce({
        stdout: '{"type": "text", "data": "parsed from stdout"}',
        output: null,
        error: null,
      });

      render(<Notebook />);
      await runSelectedCell();

      await waitFor(() => {
        expect(screen.getByText('parsed from stdout')).toBeInTheDocument();
      });
    });

    it('normalises backend output.type to output.type_', async () => {
      seedTab();
      mockApiClient.execute.python.mockResolvedValueOnce({
        stdout: null,
        output: { type: 'text', data: 'normalised output' } as any,
        error: null,
      });

      render(<Notebook />);
      await runSelectedCell();

      await waitFor(() => {
        expect(screen.getByText('normalised output')).toBeInTheDocument();
      });
    });

    it('run button triggers cell execution', async () => {
      seedTab();
      mockApiClient.execute.python.mockResolvedValueOnce({
        stdout: 'clicked',
        output: null,
        error: null,
      });

      render(<Notebook />);

      const runBtn = getRunButton();
      expect(runBtn).toBeTruthy();

      await act(async () => {
        fireEvent.click(runBtn!);
      });

      await waitFor(() => {
        expect(screen.getByText('clicked')).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Cell management
  // -------------------------------------------------------------------------

  describe('cell management', () => {
    it('adds a new code cell via the store control', () => {
      render(<Notebook />);

      act(() => {
        useNotebookWorkspaceStore.getState().controls.addCell();
      });

      expect(screen.getAllByTestId('monaco-editor-python')).toHaveLength(2);
    });

    it('adds a new markdown cell when newCellType is markdown', () => {
      render(<Notebook />);

      act(() => {
        useNotebookWorkspaceStore.getState().controls.setNewCellType('markdown');
      });
      act(() => {
        useNotebookWorkspaceStore.getState().controls.addCell();
      });

      expect(screen.getByTestId('monaco-editor-markdown')).toBeInTheDocument();
    });

    it('converting a code cell to markdown shows the markdown viewer for cells with content', () => {
      render(<Notebook />);

      const convertBtn = screen.getByTitle('Convert to markdown cell');
      fireEvent.click(convertBtn);

      // The default cell has non-empty content, so the markdown cell renders the viewer
      expect(screen.getByTestId('markdown-viewer')).toBeInTheDocument();
    });

    it('converting a markdown cell to code shows code editor', () => {
      render(<Notebook />);

      // First add a blank markdown cell (no content → shows Monaco editor)
      act(() => {
        useNotebookWorkspaceStore.getState().controls.setNewCellType('markdown');
      });
      act(() => {
        useNotebookWorkspaceStore.getState().controls.addCell();
      });

      // Verify the blank markdown cell shows the editor
      expect(screen.getByTestId('monaco-editor-markdown')).toBeInTheDocument();

      // Convert it back to code
      const convertToCode = screen.getByTitle('Convert to code cell');
      fireEvent.click(convertToCode);

      expect(screen.queryByTestId('monaco-editor-markdown')).not.toBeInTheDocument();
      expect(screen.getAllByTestId('monaco-editor-python')).toHaveLength(2);
    });

    it('does not execute markdown cells', async () => {
      render(<Notebook />);

      // Convert existing cell to markdown
      const convertBtn = screen.getByTitle('Convert to markdown cell');
      fireEvent.click(convertBtn);

      await runSelectedCell();

      expect(mockApiClient.execute.python).not.toHaveBeenCalled();
    });

    it('selects a cell on click', () => {
      render(<Notebook />);

      act(() => {
        useNotebookWorkspaceStore.getState().controls.addCell();
      });

      // Click the first cell's wrapper
      const editors = screen.getAllByTestId('monaco-editor-python');
      const cellWrapper = editors[0].closest('[class*="group"]');
      expect(cellWrapper).toBeTruthy();
      fireEvent.click(cellWrapper!);

      // After clicking, runSelected should target cell 1
      // (verified indirectly; no error thrown)
    });
  });

  // -------------------------------------------------------------------------
  // Notebook workspace store integration
  // -------------------------------------------------------------------------

  describe('workspace store controls', () => {
    it('registers controls with the workspace store on mount', () => {
      render(<Notebook />);

      const controls = useNotebookWorkspaceStore.getState().controls;
      expect(typeof controls.runAll).toBe('function');
      expect(typeof controls.runSelected).toBe('function');
      expect(typeof controls.addCell).toBe('function');
      expect(typeof controls.setLanguage).toBe('function');
      expect(typeof controls.setNewCellType).toBe('function');
    });

    it('resets workspace store controls on unmount', () => {
      const { unmount } = render(<Notebook />);

      unmount();

      const resetControls = useNotebookWorkspaceStore.getState().controls;
      expect(resetControls.canRun).toBe(false);
      expect(resetControls.isExecuting).toBe(false);
    });

    it('canRun is true when active tab has initialData', () => {
      seedTab();
      render(<Notebook />);

      expect(useNotebookWorkspaceStore.getState().controls.canRun).toBe(true);
    });

    it('canRun is false when no active tab', () => {
      render(<Notebook />);

      expect(useNotebookWorkspaceStore.getState().controls.canRun).toBe(false);
    });

    it('runAll runs all code cells sequentially', async () => {
      seedTab();
      mockApiClient.execute.python.mockResolvedValue({
        stdout: null,
        output: null,
        error: null,
      });

      render(<Notebook />);

      act(() => {
        useNotebookWorkspaceStore.getState().controls.addCell();
      });

      await act(async () => {
        await useNotebookWorkspaceStore.getState().controls.runAll();
      });

      expect(mockApiClient.execute.python).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // Setup code generation (verified via the code sent to the API)
  // -------------------------------------------------------------------------

  describe('setup code generation', () => {
    it('includes pandas setup when language is python', async () => {
      seedTab();
      mockApiClient.execute.python.mockResolvedValueOnce({
        stdout: null,
        output: null,
        error: null,
      });

      render(<Notebook />);
      await runSelectedCell();

      await waitFor(() => {
        expect(mockApiClient.execute.python).toHaveBeenCalledWith(
          expect.objectContaining({
            code: expect.stringContaining('import pandas as pd'),
          })
        );
      });
    });

    it('includes R library setup when language is r', async () => {
      seedTab();
      mockApiClient.execute.r.mockResolvedValueOnce({
        stdout: null,
        output: null,
        error: null,
      });

      render(<Notebook />);

      await act(async () => {
        useNotebookWorkspaceStore.getState().controls.setLanguage('r');
      });

      await waitFor(() => {
        expect(useNotebookWorkspaceStore.getState().controls.language).toBe('r');
      });

      await runSelectedCell();

      await waitFor(() => {
        expect(mockApiClient.execute.r).toHaveBeenCalledWith(
          expect.objectContaining({
            code: expect.stringContaining('library(jsonlite)'),
          })
        );
      });
    });

    it('truncates inline data to 200 rows to avoid exceeding the API char limit', async () => {
      // Seed a tab with 250 rows (no UUID path → no dataset_id bypass)
      const store = useTabsStore.getState();
      store.addTab({
        name: 'Big Sheet',
        content: '',
        isDirty: false,
        type: ViewType.SPREADSHEET,
        data: {
          initialData: Array.from({ length: 250 }, (_, i) => ({ id: i, val: 'x' })),
        },
      });

      mockApiClient.execute.python.mockResolvedValueOnce({
        stdout: null,
        output: null,
        error: null,
      });

      render(<Notebook />);
      await runSelectedCell();

      await waitFor(() => {
        const code: string = mockApiClient.execute.python.mock.calls[0][0].code;
        // Should reference 200 rows truncation note
        expect(code).toContain('first 200 of 250 rows');
        // The JSON should only have 200 entries
        const jsonMatch = code.match(/data_dict = (\[.*?\])/s);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1]);
          expect(parsed).toHaveLength(200);
        }
      });
    });

    it('does not add truncation note when data fits within 200 rows', async () => {
      seedTab(); // seedTab adds 2 rows
      mockApiClient.execute.python.mockResolvedValueOnce({
        stdout: null,
        output: null,
        error: null,
      });

      render(<Notebook />);
      await runSelectedCell();

      await waitFor(() => {
        const code: string = mockApiClient.execute.python.mock.calls[0][0].code;
        expect(code).not.toContain('first 200 of');
      });
    });

    it('omits inline data from python setup when dataset_id is available', async () => {
      const { getDatasetIdFromTab } = require('@/lib/workspace-dataset');
      getDatasetIdFromTab.mockReturnValue('11111111-1111-1111-8111-111111111111');

      seedTab();
      mockApiClient.execute.python.mockResolvedValueOnce({
        stdout: null,
        output: null,
        error: null,
      });

      render(<Notebook />);
      await runSelectedCell();

      await waitFor(() => {
        const call = mockApiClient.execute.python.mock.calls[0][0];
        expect(call.code).not.toContain('data_dict =');
        expect(call.code).toContain('import pandas as pd');
        expect(call.code).toContain('pre-loaded by the backend');
      });
    });

    it('produces empty setup code when there is no active tab data', async () => {
      mockApiClient.execute.python.mockResolvedValueOnce({
        stdout: null,
        output: null,
        error: null,
      });

      render(<Notebook />);
      await runSelectedCell();

      await waitFor(() => {
        expect(mockApiClient.execute.python).toHaveBeenCalledWith(
          expect.objectContaining({
            code: expect.not.stringContaining('import pandas as pd'),
          })
        );
      });
    });
  });

  // -------------------------------------------------------------------------
  // Markdown cell rendering
  // -------------------------------------------------------------------------

  describe('markdown cells', () => {
    it('shows Monaco editor for a new blank markdown cell', () => {
      render(<Notebook />);

      act(() => {
        useNotebookWorkspaceStore.getState().controls.setNewCellType('markdown');
      });
      act(() => {
        useNotebookWorkspaceStore.getState().controls.addCell();
      });

      // Empty markdown cell opens in edit mode
      expect(screen.getByTestId('monaco-editor-markdown')).toBeInTheDocument();
    });

    it('shows MarkdownViewer for a markdown cell with content', () => {
      render(<Notebook />);

      // Convert the default code cell (which has content) to markdown
      const convertBtn = screen.getByTitle('Convert to markdown cell');
      fireEvent.click(convertBtn);

      expect(screen.getByTestId('markdown-viewer')).toBeInTheDocument();
    });

    it('displays the cell content inside the MarkdownViewer', () => {
      render(<Notebook />);

      const convertBtn = screen.getByTitle('Convert to markdown cell');
      fireEvent.click(convertBtn);

      const viewer = screen.getByTestId('markdown-viewer');
      expect(viewer.textContent).toContain('print(df.head())');
    });

    it('updates markdown cell content via the editor', () => {
      render(<Notebook />);

      // Add a new blank markdown cell so it starts in edit mode
      act(() => {
        useNotebookWorkspaceStore.getState().controls.setNewCellType('markdown');
      });
      act(() => {
        useNotebookWorkspaceStore.getState().controls.addCell();
      });

      const mdEditor = screen.getByTestId('monaco-editor-markdown');
      fireEvent.change(mdEditor, { target: { value: '## Hello' } });

      expect(screen.getByTestId('monaco-editor-markdown')).toHaveValue('## Hello');
    });
  });
});
