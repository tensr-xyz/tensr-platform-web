import { render, screen } from '@testing-library/react';
import {
  AgentWorkingLabel,
  CHAT_THREAD_CLOSE_BUTTON_CLASS,
  ChatThreadCloseButton,
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

  it('uses a pointer cursor on the chat-tab close control', () => {
    render(<ChatThreadCloseButton title="NBA recode" onClick={() => undefined} />);
    const button = screen.getByRole('button', { name: 'Close NBA recode' });
    expect(button).toHaveClass('cursor-pointer');
    expect(CHAT_THREAD_CLOSE_BUTTON_CLASS).toContain('cursor-pointer');
  });
});
