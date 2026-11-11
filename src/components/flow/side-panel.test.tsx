import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FlowComposer } from './chat-composer';
import { SidePanel, clampPanelWidth, panelWidthKey } from './side-panel';

describe('side panel width', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('keeps a width between the edges', () => {
    expect(clampPanelWidth(10)).toBe(220);
    expect(clampPanelWidth(9000)).toBe(720);
    expect(clampPanelWidth(400)).toBe(400);
  });

  it('remembers a dragged width and expands over the page', async () => {
    window.localStorage.setItem(panelWidthKey('tables'), '360');
    render(
      <SidePanel id="tables" defaultWidth={320}>
        <p>Table chat</p>
      </SidePanel>
    );
    const panel = screen.getByRole('complementary');
    await waitFor(() => expect(panel.style.width).toBe('360px'));

    const handle = screen.getByRole('button', { name: 'Resize panel' });
    fireEvent.mouseDown(handle, { clientX: 500 });
    fireEvent.mouseMove(window, { clientX: 450 });
    expect(panel.style.width).toBe('410px');
    expect(window.localStorage.getItem(panelWidthKey('tables'))).toBe('410');

    fireEvent.click(screen.getByRole('button', { name: 'Expand panel' }));
    expect(panel.getAttribute('data-expanded')).toBe('true');
    expect(panel.style.width).toBe('');
    expect(screen.getByRole('button', { name: 'Restore panel' })).toBeTruthy();
  });
});

describe('composer shell', () => {
  it('wraps the field and its controls for a thread and a hero', () => {
    const props = {
      value: '',
      onChange: () => undefined,
      onSend: () => undefined,
      placeholder: 'Ask a question',
      mode: 'ask' as const,
      onMode: () => undefined,
      columns: [],
      attachments: [],
      onAttach: () => undefined,
      onRemoveAttachment: () => undefined,
    };
    const { unmount } = render(<FlowComposer {...props} layout="thread" />);
    const field = screen.getByPlaceholderText('Ask a question');
    const shell = field.closest('.composer-shell');
    expect(shell).toBeTruthy();
    expect(shell?.className).not.toContain('focus-visible:ring');
    expect(field.className).toContain('focus-visible:ring-0');
    unmount();
    render(<FlowComposer {...props} layout="hero" />);
    expect(screen.getByPlaceholderText('Ask a question').closest('.composer-shell')).toBeTruthy();
  });
});
