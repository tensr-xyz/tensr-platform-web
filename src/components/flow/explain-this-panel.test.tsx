import { fireEvent, render, screen } from '@testing-library/react';
import { ExplainThisPanel } from './explain-this-panel';

const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

describe('ExplainThisPanel', () => {
  beforeEach(() => {
    push.mockReset();
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: { setItem: jest.fn(), getItem: jest.fn(), removeItem: jest.fn() },
    });
  });

  it('opens the Paper 10g explanation card from Explain this', () => {
    render(
      <ExplainThisPanel
        title="T7 · Satisfaction by region"
        lead="London (63%) is significantly lower than the total (71%)."
        checks={['Low base on Wales']}
        footnote="weighted data · 95% confidence"
        projectId="proj-1"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Explain this' }));

    expect(screen.getByText('T7 · Satisfaction by region')).toBeInTheDocument();
    expect(screen.getByText(/What stands out:/)).toBeInTheDocument();
    expect(screen.getByText(/London \(63%\)/)).toBeInTheDocument();
    expect(screen.getByText(/Low base on Wales/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to report as a note' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask a follow-up in chat' })).toBeInTheDocument();
  });

  it('seeds chat when Ask a follow-up is chosen', () => {
    render(<ExplainThisPanel title="Banner" lead="East leads at 54%." projectId="proj-9" />);
    fireEvent.click(screen.getByRole('button', { name: 'Explain this' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ask a follow-up in chat' }));
    expect(push).toHaveBeenCalledWith('/flow/p/proj-9/chat');
    expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
      'tensr-chat-draft:proj-9',
      expect.stringContaining('Banner')
    );
  });
});
