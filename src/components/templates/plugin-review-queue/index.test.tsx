import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PluginReviewQueue from './index';
import { apiClient } from '@/lib/api-client';
import type { PluginRecord } from '@/types/plugin';

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    plugins: {
      reviewQueue: jest.fn(),
      review: jest.fn(),
    },
  },
}));

const reviewQueue = apiClient.plugins.reviewQueue as jest.Mock;
const review = apiClient.plugins.review as jest.Mock;

const pendingRow = {
  pluginId: 'plug-1',
  name: 'Weighted crosstab',
  version: '1.2.0',
  description: 'Pending upload',
  authorId: 'author-1',
  entryPoint: 'main.py',
  capabilities: {},
  s3Key: 'plugins/plug-1/1.2.0.zip',
} as unknown as PluginRecord;

describe('PluginReviewQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    reviewQueue.mockResolvedValue({ items: [pendingRow] });
    review.mockResolvedValue({ message: 'ok', plugin: pendingRow });
  });

  it.each([
    ['Approve', 'APPROVED'],
    ['Reject', 'REJECTED'],
  ])('%s sends the version of the pending row shown', async (label, status) => {
    render(<PluginReviewQueue />);
    fireEvent.click(await screen.findByRole('button', { name: label }));

    await waitFor(() => expect(review).toHaveBeenCalledTimes(1));
    expect(review).toHaveBeenCalledWith('plug-1', {
      status,
      notes: undefined,
      version: '1.2.0',
    });
  });
});
