import { fireEvent, render, screen } from '@testing-library/react';
import { StudyShell } from './shell';

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: async () =>
      JSON.stringify({ rows: [], variable_names: [], findings: [], specs: [], books: [] }),
  }) as unknown as typeof fetch;
});

describe('StudyShell', () => {
  it('keeps Chat, Sources, and Report as coming next, and opens Responses', () => {
    render(
      <StudyShell
        project={{ id: 'p1', name: 'Brand tracker' }}
        datasets={[{ id: 'ds', original_filename: 'w4.sav' }]}
        onBack={() => undefined}
      />
    );
    expect(screen.getByRole('heading', { name: 'Brand tracker' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    expect(screen.getByText('Coming next.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sources' }));
    expect(screen.getByText('Coming next.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Report' }));
    expect(screen.getByText('Coming next.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Responses' }));
    expect(screen.queryByText('Coming next.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Weighting' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tables' }));
    expect(screen.getByRole('heading', { name: 'Ask about this table' })).toBeTruthy();
  });
});
