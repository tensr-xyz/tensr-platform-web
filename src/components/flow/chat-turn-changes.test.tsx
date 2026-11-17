import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChatTurnChangesPanel } from './chat-turn-changes';
import { useDatasetVersion } from '@/lib/dataset-version-undo';

jest.mock('@/lib/dataset-version-undo', () => ({
  useDatasetVersion: jest.fn(() => Promise.resolve('v0')),
  setProjectActiveDataset: jest.fn(() => Promise.resolve('v0')),
}));

jest.mock('@/hooks/ui/use-toast', () => ({
  toast: jest.fn(),
}));

const restore = useDatasetVersion as jest.Mock;

describe('ChatTurnChangesPanel', () => {
  beforeEach(() => {
    restore.mockClear();
  });

  it('shows the change list with Undo all and per-row Undo', async () => {
    const onRestored = jest.fn();
    render(
      <ChatTurnChangesPanel
        projectId="proj"
        changes={[
          {
            label: 'New question: Age band (3 groups)',
            previousDatasetId: 'v0',
            currentDatasetId: 'v1',
          },
          {
            label: 'Removed 12 respondents',
            previousDatasetId: 'v1',
            currentDatasetId: 'v2',
          },
        ]}
        onRestored={onRestored}
      />
    );

    expect(screen.getByText('2 changes · saved as a new version')).toBeTruthy();
    expect(screen.getByText('New question: Age band (3 groups)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Undo all' })).toBeTruthy();
    const rowUndos = screen.getAllByRole('button', { name: 'Undo' });
    expect(rowUndos).toHaveLength(2);

    fireEvent.click(rowUndos[0]!);
    await waitFor(() => expect(restore).toHaveBeenCalled());
    expect(restore).toHaveBeenCalledWith({
      projectId: 'proj',
      tipDatasetId: 'v1',
      versionId: 'v0',
    });
    await waitFor(() => expect(onRestored).toHaveBeenCalledWith('v0'));
    expect(await screen.findByText('Undone')).toBeTruthy();
  });
});
