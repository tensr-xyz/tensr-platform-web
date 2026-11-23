import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  AskerQuestionsScreen,
  askerQuestionsTabLabel,
  type AskerTurn,
} from './asker-questions-screen';

jest.mock('@/lib/flow-api', () => ({
  flowJson: jest.fn(),
}));

const turns: AskerTurn[] = [
  {
    turn_id: 't1',
    user_id: 'priya',
    question: 'How many institutional investors do we reach in the US?',
    answer: 'Northwind Post reaches 41.2%.',
    status: 'check_requested',
    audience: 'Institutional investors, US',
    base: '171 respondents',
    weight: 'Projection weight',
    wave: 'Wave 2',
    source: 'audience_w2.sav',
    test: 'Paired test between titles',
    table_note: 'Title read × Institutional investors, US',
    run_id: 'run-reach-1',
    created_at: '2026-11-21T10:42:00Z',
  },
  {
    turn_id: 't2',
    user_id: 'priya',
    question: 'And how many of them are hedge fund managers?',
    answer: 'Not in this data. The survey records investor type but not fund type.',
    status: 'not_in_data',
    created_at: '2026-11-21T10:44:00Z',
  },
  {
    turn_id: 't3',
    user_id: 'james',
    question: 'Age profile of our digital readers vs total',
    answer: 'Digital readers skew younger.',
    status: 'checked',
    checked: true,
    audience: 'Total sample',
    base: '3,104',
    wave: 'Wave 2',
    created_at: '2026-11-20T09:00:00Z',
  },
];

describe('AskerQuestionsScreen', () => {
  it('labels the tab with how many still need a check', () => {
    expect(askerQuestionsTabLabel(turns)).toBe('Asker questions · 1 to check');
    expect(askerQuestionsTabLabel([])).toBe('Asker questions');
  });

  it('shows how the open answer was worked out and can mark it checked', async () => {
    const { flowJson } = jest.requireMock('@/lib/flow-api') as { flowJson: jest.Mock };
    flowJson.mockImplementation((path: string, init?: { method?: string; body?: string }) => {
      if (path.endsWith('/asker-log') && !init?.method) {
        return Promise.resolve({ turns });
      }
      if (path.includes('/asker-log/t1') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body || '{}')) as { status?: string };
        return Promise.resolve({
          turn: {
            ...turns[0],
            status: body.status || 'checked',
            checked: body.status === 'checked',
          },
        });
      }
      return Promise.resolve({});
    });

    render(<AskerQuestionsScreen projectId="study-1" />);
    expect(await screen.findByRole('heading', { level: 2 })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2 }).textContent).toMatch(
      /institutional investors/i
    );
    expect(screen.getByText('How it was worked out')).toBeTruthy();
    expect(screen.getAllByText(/Institutional investors, US/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/171 respondents/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Projection weight/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark as checked' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Flag a problem' })).toBeTruthy();
    const openTable = screen.getByRole('link', { name: 'Open as table' });
    expect(openTable.getAttribute('href')).toBe(
      '/flow/p/study-1/report?pane=outputs&run=run-reach-1'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mark as checked' }));
    await waitFor(() =>
      expect(flowJson).toHaveBeenCalledWith(
        '/api/projects/study-1/asker-log/t1',
        expect.objectContaining({ method: 'POST' })
      )
    );
  });
});
