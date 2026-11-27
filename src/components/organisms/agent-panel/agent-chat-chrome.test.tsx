import { render, screen } from '@testing-library/react';
import {
  AgentWorkingLabel,
  BuildingTableCard,
  CHAT_THREAD_CLOSE_BUTTON_CLASS,
  ChatThreadCloseButton,
  accumulateThinkingLines,
  isBuildingTableProgress,
  visibleThinkingLines,
} from './agent-chat-chrome';

describe('agent chat chrome', () => {
  it('shows Working as pulsed text, not a primary caret', () => {
    const { container } = render(<AgentWorkingLabel />);
    const label = screen.getByText('Working');
    expect(label).toHaveClass('animate-pulse', 'text-muted-foreground');
    expect(label).not.toHaveClass('bg-primary');
    expect(container.querySelector('[aria-hidden]')).toBeNull();
  });

  it('TEN-191: detects big-table building progress for Paper 14b', () => {
    expect(isBuildingTableProgress(['Reading the request'])).toBe(false);
    expect(isBuildingTableProgress(['Loaded 4 of 1,501 columns'])).toBe(true);
    expect(isBuildingTableProgress(['Building the table', 'Counting weighted reach'])).toBe(true);
  });

  it('TEN-191: building card shows Loaded N of M and keep-working copy', () => {
    render(
      <BuildingTableCard
        lines={[
          'Building the table',
          'Loaded 4 of 1,501 columns',
          'Counting weighted reach, index vs total',
        ]}
        isStreaming
      />
    );
    expect(screen.getByTestId('building-table-card')).toBeInTheDocument();
    expect(screen.getByText('Building the table')).toBeInTheDocument();
    expect(screen.getByText(/Loaded 4 of 1,501 columns/)).toBeInTheDocument();
    expect(
      screen.getByText(/You can keep working\. The answer is written here when the numbers land\./)
    ).toBeInTheDocument();
  });

  it('hides planning progress once the result is on screen', () => {
    const lines = ['Planning the next step…'];
    expect(visibleThinkingLines(lines, { hasResult: false, isStreaming: true })).toEqual(lines);
    expect(visibleThinkingLines(lines, { hasResult: true, isStreaming: false })).toEqual([]);
  });

  it('TEN-269: building card is for in-flight scans only (Paper 14b)', () => {
    expect(isBuildingTableProgress(['Building the table', '42s still working'])).toBe(true);
    expect(isBuildingTableProgress(['Building standout stats', 'Scanning questions'])).toBe(true);
    // Finished reply lines are not building progress.
    expect(
      isBuildingTableProgress([
        'Half of investors read the title, 2.7x the average',
        '28% are in the C-suite, 2.8x the average',
      ])
    ).toBe(false);
  });

  it('hides Working/schema progress after a chat-only answer finishes', () => {
    const lines = ['Working…', 'Reading dataset schema…', 'Computing the requested summary…'];
    expect(visibleThinkingLines(lines, { hasResult: false, isStreaming: true })).toEqual([
      'Reading dataset schema…',
      'Computing the requested summary…',
    ]);
    expect(visibleThinkingLines(lines, { hasResult: false, isStreaming: false })).toEqual([]);
  });

  it('drops the static Working… seed so only the pulse label remains', () => {
    expect(visibleThinkingLines(['Working…'], { hasResult: false, isStreaming: true })).toEqual([]);
    expect(visibleThinkingLines(['Working'], { hasResult: false, isStreaming: true })).toEqual([]);
  });

  it('accumulates distinct progress lines so the UI can paint each step', () => {
    const first = accumulateThinkingLines(undefined, 'Reading dataset schema…');
    const second = accumulateThinkingLines(first, 'Planning the next step…');
    const third = accumulateThinkingLines(second, 'Planning the next step…');
    expect(second).toEqual(['Reading dataset schema…', 'Planning the next step…']);
    expect(third).toEqual(second);
  });

  it('uses a pointer cursor on the chat-tab close control', () => {
    render(<ChatThreadCloseButton title="NBA recode" onClick={() => undefined} />);
    const button = screen.getByRole('button', { name: 'Close NBA recode' });
    expect(button).toHaveClass('cursor-pointer');
    expect(CHAT_THREAD_CLOSE_BUTTON_CLASS).toContain('cursor-pointer');
  });
});
