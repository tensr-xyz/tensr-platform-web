import { render, screen } from '@testing-library/react';
import {
  AgentWorkingLabel,
  CHAT_THREAD_CLOSE_BUTTON_CLASS,
  ChatThreadCloseButton,
  accumulateThinkingLines,
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

  it('hides planning progress once the result is on screen', () => {
    const lines = ['Planning the next step…'];
    expect(visibleThinkingLines(lines, { hasResult: false, isStreaming: true })).toEqual(lines);
    expect(visibleThinkingLines(lines, { hasResult: true, isStreaming: false })).toEqual([]);
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
