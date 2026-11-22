import type { ReactElement } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  AgentThread,
  liveRunShouldReplaceChat,
  replyLines,
  stepLines,
  stepRowKey,
  stepsAfterReply,
} from './agent-thread';
import { livePublishMatches, publishLiveChatRun } from './chat-live-run';
import { runAgentLoop } from '@/lib/run-agent-loop';

jest.mock('@/lib/flow-api', () => ({
  flowJson: jest.fn(() => Promise.resolve({ sessions: [] })),
}));

jest.mock('@/lib/run-agent-loop', () => ({
  runAgentLoop: jest.fn(),
}));

const send = runAgentLoop as jest.Mock;

function renderThread(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('shared agent thread', () => {
  it('restores a readable step and hides a tool name', () => {
    expect(stepLines([{ name: 'data_edit', message: '' }])).toEqual(['Edited the data']);
    expect(stepLines([{ name: 'compute', message: '' }])).toEqual(['Computed a new column']);
    expect(stepLines([{ name: 'finish', message: '' }])).toEqual([]);
    expect(
      stepLines([
        { name: 'model', message: 'Reading the request' },
        { name: 'run_operations', message: 'Coding the open answers' },
      ])
    ).toEqual(['Reading the request', 'Coding the open answers']);
    expect(stepRowKey(0, 'Ran the analysis')).not.toBe(stepRowKey(1, 'Ran the analysis'));
  });

  it('keeps live step names instead of collapsing the finished tool_trace', () => {
    const live = ['Reading the request', 'Coding the open answers'];
    const traced = replyLines({
      status: 'ok',
      mode: 'agent',
      answer_markdown: 'Done',
      tool_trace: [
        { name: 'run_analysis', args: { analysis_type: 'code_open_text' }, result: { ok: true } },
        { name: 'run_analysis', args: { analysis_type: 'frequencies' }, result: { ok: true } },
      ],
    });
    expect(traced).toEqual(['Coded the open answers', 'Counted the values']);
    expect(stepsAfterReply(live, traced)).toEqual(live);
    expect(stepsAfterReply([], traced)).toEqual(traced);
    expect(stepRowKey(0, traced[0]!)).not.toBe(stepRowKey(1, traced[1]!));
  });

  it('keeps the open chat when another finished run is still in memory', () => {
    expect(liveRunShouldReplaceChat('current', 'older')).toBe(false);
    expect(liveRunShouldReplaceChat('current', 'current')).toBe(true);
    expect(liveRunShouldReplaceChat('', 'older')).toBe(true);
  });

  it('does not write a finished funnel onto the next question', () => {
    const run = {
      projectId: 'p1',
      sessionId: 'funnel',
      question: 'Build a funnel',
      answer: 'Aware is 75%.',
      steps: [],
      status: null,
      running: false,
    };
    expect(livePublishMatches(run, 'p1', 'funnel', 'Build a funnel')).toBe(true);
    expect(livePublishMatches(run, 'p1', 'rake', 'Rake the sample')).toBe(false);
    expect(livePublishMatches(run, 'p1', 'funnel', 'Rake the sample')).toBe(false);
  });

  afterEach(() => {
    publishLiveChatRun(null);
    send.mockReset();
  });

  it('shows the same composer and empty thread in a side panel', async () => {
    renderThread(
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

  it('shows first-run suggestion chips and sends one on click', async () => {
    send.mockResolvedValue({ status: 'ok', answer_markdown: 'Done', session_id: 's1' });
    renderThread(
      <AgentThread
        projectId="project"
        datasetId="file"
        columnNames={['region']}
        columnLabels={[{ name: 'region', label: 'Region' }]}
        placeholder="Ask, or describe a table to build…"
        projectHref="/flow/p/project"
        emptyTitle="Not sure where to start?"
        emptyDescription="Tell the agent what you want to know and it builds the table for you."
        emptySuggestions={['Region by age', 'What should I look at first?']}
      />
    );
    expect(await screen.findByText('Not sure where to start?')).toBeTruthy();
    expect(screen.getByTestId('tables-agent-empty')).toBeTruthy();
    screen.getByRole('button', { name: 'Region by age' }).click();
    await waitFor(() => expect(send).toHaveBeenCalled());
    expect(send.mock.calls[0][0].message).toBe('Region by age');
  });

  it('sends a queued question once, even after the chat list reloads', async () => {
    send.mockResolvedValue({ status: 'ok', answer_markdown: 'Done', session_id: 's1' });
    renderThread(
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

  it('sends a queued question after the run already on screen finishes', async () => {
    send.mockResolvedValue({ status: 'ok', answer_markdown: 'Done', session_id: 's1' });
    publishLiveChatRun({
      projectId: 'project',
      sessionId: 's0',
      question: 'Earlier',
      answer: '',
      steps: [],
      status: 'Thinking…',
      running: true,
    });
    renderThread(
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
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });
    expect(send).not.toHaveBeenCalled();
    publishLiveChatRun({
      projectId: 'project',
      sessionId: 's0',
      question: 'Earlier',
      answer: 'Done earlier',
      steps: [],
      status: null,
      running: false,
    });
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send.mock.calls[0][0].message).toBe('How many answered?');
  });
});
