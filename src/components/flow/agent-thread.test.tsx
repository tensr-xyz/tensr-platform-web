import { render, screen, waitFor } from '@testing-library/react';
import { AgentThread } from './agent-thread';
import { publishLiveChatRun } from './chat-live-run';
import { runAgentLoop } from '@/lib/run-agent-loop';

jest.mock('@/lib/flow-api', () => ({
  flowJson: jest.fn(() => Promise.resolve({ sessions: [] })),
}));

jest.mock('@/lib/run-agent-loop', () => ({
  runAgentLoop: jest.fn(),
}));

const send = runAgentLoop as jest.Mock;

describe('shared agent thread', () => {
  afterEach(() => {
    publishLiveChatRun(null);
    send.mockReset();
  });

  it('shows the same composer and empty thread in a side panel', async () => {
    render(
      <AgentThread
        projectId="project"
        datasetId="file"
        columnNames={['region']}
        columnLabels={[{ name: 'region', label: 'Region' }]}
        placeholder="Ask about this table…"
        projectHref="/flow/p/project"
        emptyTitle="Ask about this table"
        emptyDescription="The question is kept in the project chat."
      />
    );
    expect(await screen.findByText('Ask about this table')).toBeTruthy();
    expect(screen.getByText('The question is kept in the project chat.')).toBeTruthy();
    expect(screen.getByPlaceholderText('Ask about this table…')).toBeTruthy();
  });

  it('sends a queued question once, even after the chat list reloads', async () => {
    send.mockResolvedValue({ status: 'ok', answer_markdown: 'Done', session_id: 's1' });
    render(
      <AgentThread
        projectId="project"
        datasetId="file"
        columnNames={['region']}
        columnLabels={[{ name: 'region', label: 'Region' }]}
        placeholder="Ask a follow-up..."
        projectHref="/flow/p/project"
        pendingAsk="How many answered?"
      />
    );
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send.mock.calls[0][0].message).toBe('How many answered?');
  });
});
