import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FeedbackDialog } from './index';
import { FeedbackTopic } from '@/types/feedback';

const toast = jest.fn();

jest.mock('@/hooks/ui/use-toast', () => ({ toast: (...a: unknown[]) => toast(...a) }));
jest.mock('@/hooks/api/use-auth', () => ({
  __esModule: true,
  default: () => ({ user: { userId: 'user-1' } }),
}));
jest.mock('@/utils/auth', () => ({ getStytchBearerForTensrApi: () => 'test-token' }));
jest.mock('@/components/atoms/select', () => ({
  Select: ({
    onValueChange,
    value,
    children,
  }: {
    onValueChange: (v: string) => void;
    value: string;
    children: React.ReactNode;
  }) => (
    <select aria-label="Topic" value={value} onChange={e => onValueChange(e.target.value)}>
      <option value="" />
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

describe('FeedbackDialog', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  function fillAndSend() {
    render(<FeedbackDialog open onOpenChange={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: FeedbackTopic.BUG } });
    fireEvent.change(screen.getByPlaceholderText('Your feedback...'), {
      target: { value: '  The export button does nothing  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rate 2 out of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  }

  it('sends the text as `message`, the field the API stores', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'f1' }) });
    fillAndSend();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      topic: FeedbackTopic.BUG,
      rating: 2,
      message: 'The export button does nothing',
    });
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Feedback Submitted' }))
    );
  });

  it('does not thank the user when the API rejects the feedback', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ detail: [{ msg: 'bad' }] }),
    });
    fillAndSend();

    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(toast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Feedback Submitted' })
    );
  });
});
