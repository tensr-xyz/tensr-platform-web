import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TabManager from './index';
import { ViewType, type Tab } from '@/stores/tabs-store';

const toast = jest.fn();
const saveFile = jest.fn();

jest.mock('@/hooks/ui/use-toast', () => ({ toast: (...a: unknown[]) => toast(...a) }));
jest.mock('@/hooks/api/use-file', () => ({
  useFileHandler: () => ({
    saveFile: (...a: unknown[]) => saveFile(...a),
    isSaving: false,
    lastSavedTime: null,
    getFileVersions: jest.fn(),
    getFileVersion: jest.fn(),
    revertToVersion: jest.fn(),
    setupAutoSave: jest.fn(),
  }),
}));
jest.mock('@/lib/workspace-dataset', () => ({ getDatasetIdFromTab: () => 'ds-1' }));
jest.mock('@/lib/adopt-derived-dataset', () => ({ adoptDerivedDataset: jest.fn() }));
let spreadsheetOnChange: ((rows: Record<string, unknown>[]) => void) | undefined;
jest.mock('@/components/templates/spreadsheet', () => ({
  __esModule: true,
  default: ({ onChange }: { onChange?: (rows: Record<string, unknown>[]) => void }) => {
    spreadsheetOnChange = onChange;
    return null;
  },
}));
jest.mock('@/components/templates/notebook', () => ({ Notebook: () => null }));
jest.mock('@/components/organisms/markdown-viewer', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/organisms/analysis-report-layout', () => ({
  AnalysisReportLayout: () => null,
}));
jest.mock('@/components/organisms/analysis-result-placeholder', () => ({
  AnalysisResultPlaceholder: () => null,
}));
jest.mock('@/components/organisms/left-panel', () => ({ LeftPanel: () => null }));

const dirtySheet = {
  id: 'sheet-1',
  name: 'survey.csv',
  type: ViewType.SPREADSHEET,
  isDirty: true,
  data: { datasetId: 'ds-1', initialData: [{ q1: 'edited' }] },
} as unknown as Tab;

function renderSheet() {
  render(
    <TabManager
      activeTab={dirtySheet}
      tabs={[dirtySheet]}
      onTabClose={jest.fn()}
      onToggleSidebar={jest.fn()}
    />
  );
}

const unavailableToast = expect.objectContaining({
  title: 'Changes not saved',
  description: expect.stringContaining("Saving edits to a dataset isn't available yet"),
  variant: 'destructive',
});

describe('TabManager save', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stops saving and shows an error toast when saveFile returns false', async () => {
    saveFile.mockResolvedValue(false);
    renderSheet();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith(unavailableToast));
    expect(screen.queryByText('Saving...')).not.toBeInTheDocument();
    expect(screen.getByText('Save failed')).toBeInTheDocument();
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'File saved' }));
  });

  it('shows the same error toast when saveFile throws', async () => {
    saveFile.mockRejectedValue(new Error('404 Not Found'));
    renderSheet();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith(unavailableToast));
    expect(screen.queryByText('Saving...')).not.toBeInTheDocument();
  });

  it('clears the failed status after three seconds', async () => {
    jest.useFakeTimers();
    saveFile.mockResolvedValue(false);
    renderSheet();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('Save failed')).toBeInTheDocument());

    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.queryByText('Save failed')).not.toBeInTheDocument();
  });

  it('does not auto-save edits, since every save would fail', () => {
    jest.useFakeTimers();
    renderSheet();

    act(() => {
      spreadsheetOnChange?.([{ q1: 'edited again' }]);
      jest.advanceTimersByTime(31_000);
    });
    expect(saveFile).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });
});
