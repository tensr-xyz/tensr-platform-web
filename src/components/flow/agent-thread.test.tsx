import { render, screen } from '@testing-library/react';
import { AgentThread } from './agent-thread';

jest.mock('@/lib/flow-api', () => ({
  flowJson: jest.fn(() => Promise.resolve({ sessions: [] })),
}));

jest.mock('@/lib/run-agent-loop', () => ({
  runAgentLoop: jest.fn(),
}));

describe('shared agent thread', () => {
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
});
