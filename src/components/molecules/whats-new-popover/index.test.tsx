import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { CHANGELOG_SEEN_STORAGE_KEY } from '@/lib/changelog';
import { WhatsNewPopover } from './index';

const feed = {
  success: true,
  data: [
    {
      title: 'ARIMA matches auto.arima; trees default to pruned',
      date: '2026-09-28',
      version: '0.4.1',
      tags: ['fix', 'improvement'],
      url: 'https://www.tensr.xyz/changelog#0-4-1',
      summary: 'Automatic ARIMA now picks the order the same way as R’s forecast::auto.arima.',
    },
  ],
  error: null,
};

function memoryStorage(initial: Record<string, string> = {}) {
  const store = { ...initial };
  return {
    getItem(key: string) {
      return store[key] ?? null;
    },
    setItem(key: string, value: string) {
      store[key] = value;
    },
    store,
  };
}

describe('WhatsNewPopover', () => {
  it('shows an unread mark until the latest version has been opened', async () => {
    const storage = memoryStorage();
    const fetchFeed = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => feed,
    });

    render(<WhatsNewPopover fetchFeed={fetchFeed} storage={storage} />);

    const trigger = await screen.findByRole('button', { name: /what's new/i });
    await waitFor(() => expect(trigger).toHaveAttribute('data-unread', 'true'));
    expect(trigger).toHaveAccessibleName("What's new, unread");

    fireEvent.click(trigger);

    expect(
      await screen.findByText('ARIMA matches auto.arima; trees default to pruned')
    ).toBeInTheDocument();
    expect(screen.getByText('v0.4.1')).toBeInTheDocument();

    await waitFor(() => {
      expect(storage.store[CHANGELOG_SEEN_STORAGE_KEY]).toBe('0.4.1');
      expect(trigger).toHaveAttribute('data-unread', 'false');
    });
  });

  it('shows the loader while the changelog is still loading', async () => {
    const fetchFeed = jest.fn().mockReturnValue(new Promise(() => undefined));

    render(<WhatsNewPopover fetchFeed={fetchFeed} storage={memoryStorage()} />);
    fireEvent.click(await screen.findByRole('button', { name: /what's new/i }));

    expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });

  it('says the changelog is unavailable when the feed fails', async () => {
    const fetchFeed = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({}),
    });

    render(<WhatsNewPopover fetchFeed={fetchFeed} storage={memoryStorage()} />);
    fireEvent.click(await screen.findByRole('button', { name: /what's new/i }));

    expect(await screen.findByText(/unavailable/i)).toBeInTheDocument();
  });
});
