import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReportEditor } from './report-editor';

jest.mock('@/lib/flow-api', () => ({
  flowJson: jest.fn(async (path: string, init?: { method?: string; body?: string }) => {
    if (String(path).includes('/report/document') && (!init || init.method === 'GET')) {
      return {
        ok: true,
        has_document: true,
        document: {
          pages: [
            {
              id: 'page-a',
              title: 'Finding',
              layout_id: 'title_and_content',
              objects: [
                {
                  id: 'text-a',
                  kind: 'text',
                  frame: { x: 0.1, y: 0.1, w: 0.6, h: 0.2 },
                  text: 'Awareness is up',
                  text_style: { font_size_pt: 22, bold: true },
                  z_index: 1,
                },
                {
                  id: 'text-b',
                  kind: 'text',
                  frame: { x: 0.1, y: 0.4, w: 0.6, h: 0.2 },
                  text: 'Second box',
                  text_style: { font_size_pt: 14, bold: false },
                  z_index: 2,
                },
              ],
            },
          ],
          default_labels: { net: 'NET', total: 'Total' },
        },
      };
    }
    if (init?.method === 'PUT') {
      return { ok: true, document: JSON.parse(String(init.body || '{}')).document, n_pages: 1 };
    }
    return { ok: true };
  }),
}));

describe('ReportEditor text formatting', () => {
  it('formats selected text, paints styles, and renames default labels', async () => {
    render(<ReportEditor datasetId="ds-1" pins={[]} />);

    expect(await screen.findByRole('toolbar', { name: 'Text formatting' })).toBeTruthy();
    expect(screen.getByText('Awareness is up')).toBeTruthy();

    fireEvent.click(screen.getByText('Awareness is up'));
    fireEvent.click(screen.getByRole('button', { name: 'I' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'I' }).getAttribute('aria-pressed')).toBe('true')
    );

    fireEvent.click(screen.getByRole('button', { name: 'Format painter' }));
    fireEvent.click(screen.getByText('Second box'));
    fireEvent.click(screen.getByText('Second box'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'I' }).getAttribute('aria-pressed')).toBe('true')
    );

    const net = screen.getByDisplayValue('NET');
    fireEvent.change(net, { target: { value: 'Combined' } });
    expect(await screen.findByText(/Preview: Combined · Total/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Text' }));
    expect(await screen.findByDisplayValue('New text')).toBeTruthy();
  });
});
