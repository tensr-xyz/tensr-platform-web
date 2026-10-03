import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HomeTemplate from './index';
import { apiClient } from '@/lib/api-client';
import { ApiRequestError } from '@/lib/api-error';

const toast = jest.fn();
const invalidateQueries = jest.fn();
let rows: Record<string, unknown>[] = [];

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries }),
}));
jest.mock('@/hooks/ui/use-toast', () => ({ useToast: () => ({ toast }) }));
jest.mock('@/hooks/api/use-projects', () => ({
  useProjects: () => ({ data: rows, isLoading: false, error: null }),
  projectKeys: { lists: () => ['projects', 'list'] },
}));
jest.mock('@/hooks/api/use-dataset-upload', () => ({
  useDatasetUpload: () => ({ uploadFile: jest.fn(), isLoading: false }),
}));
jest.mock('@/hooks/api/use-auth', () => ({
  __esModule: true,
  default: () => ({ user: { email: 'ada@example.com' } }),
}));
jest.mock('@/contexts/organisation-context', () => ({
  useOrganizationContext: () => ({
    activeOrganization: { id: 'org-1', name: 'Prolific' },
    isPersonalAccount: false,
    userOrganizations: [{ id: 'org-1', name: 'Prolific' }],
  }),
}));
jest.mock('@/components/molecules/dataset-file-picker', () => ({
  DatasetFilePicker: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/components/templates/home/projects-table', () => ({
  ProjectsTable: ({
    data,
    onShare,
    onDelete,
  }: {
    data: { projectId: string; projectName: string }[];
    onShare: (id: string) => void;
    onDelete: (id: string) => void;
  }) => (
    <div>
      {data.map(p => (
        <div key={p.projectId}>
          <button type="button" onClick={() => onShare(p.projectId)}>
            Share {p.projectName}
          </button>
          <button type="button" onClick={() => onDelete(p.projectId)}>
            Delete {p.projectName}
          </button>
        </div>
      ))}
    </div>
  ),
}));
jest.mock('@/lib/api-client', () => ({
  apiClient: { datasets: { delete: jest.fn(), rename: jest.fn() } },
}));

const deleteDataset = apiClient.datasets.delete as jest.Mock;

function row(projectId: string, projectName: string, ownerType: string, ownerId: string) {
  return {
    projectId,
    projectName,
    id: projectId,
    name: projectName,
    updatedAt: '2026-10-01T00:00:00Z',
    createdAt: '2026-10-01T00:00:00Z',
    status: 'ready',
    files: [],
    ownerType,
    ownerId,
  };
}

describe('HomeTemplate dataset actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rows = [
      row('ds-personal', 'mine.csv', 'user', 'user-1'),
      row('ds-team', 'team.csv', 'organization', 'org-1'),
    ];
    Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } });
    jest.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('says only the owner can open a shared personal dataset', async () => {
    render(<HomeTemplate />);
    fireEvent.click(screen.getByRole('button', { name: 'Share mine.csv' }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        title: 'Link copied',
        description: 'Only you can open this dataset.',
      })
    );
  });

  it('names the organisation whose members can open a shared org dataset', async () => {
    render(<HomeTemplate />);
    fireEvent.click(screen.getByRole('button', { name: 'Share team.csv' }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        title: 'Link copied',
        description: 'Members of Prolific can open this dataset.',
      })
    );
  });

  it('shows the API detail and never "Dataset deleted" when delete fails', async () => {
    deleteDataset.mockRejectedValue(
      new ApiRequestError(502, JSON.stringify({ detail: 'Could not remove the stored files.' }))
    );
    render(<HomeTemplate />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete mine.csv' }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        title: 'Could not delete dataset',
        description: 'Could not remove the stored files.',
        variant: 'destructive',
      })
    );
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Dataset deleted' }));
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('toasts "Dataset deleted" after a successful delete', async () => {
    deleteDataset.mockResolvedValue({ deleted: true, dataset_id: 'ds-personal' });
    render(<HomeTemplate />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete mine.csv' }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Dataset deleted' }))
    );
  });
});
