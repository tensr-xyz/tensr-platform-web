import { isNotebookRunChord, presentCellError } from '@/lib/notebook-cell';

describe('notebook run chord and errors', () => {
  it('runs on Shift+Enter and Cmd/Ctrl+Enter', () => {
    expect(
      isNotebookRunChord({ key: 'Enter', shiftKey: true, metaKey: false, ctrlKey: false })
    ).toBe(true);
    expect(
      isNotebookRunChord({ key: 'Enter', shiftKey: false, metaKey: true, ctrlKey: false })
    ).toBe(true);
    expect(
      isNotebookRunChord({ key: 'Enter', shiftKey: false, metaKey: false, ctrlKey: true })
    ).toBe(true);
    expect(
      isNotebookRunChord({ key: 'Enter', shiftKey: false, metaKey: false, ctrlKey: false })
    ).toBe(false);
  });

  it('shows the last line and keeps the traceback for Details', () => {
    const view = presentCellError(
      "Traceback (most recent call last):\nKeyError: 'Gendr'",
      "Traceback (most recent call last):\nKeyError: 'Gendr'",
      'Did you mean Gender?'
    );
    expect(view.error).toBe("KeyError: 'Gendr' Did you mean Gender?");
    expect(view.errorDetail).toContain('Traceback');
  });

  it('does not show a raw API body', () => {
    const view = presentCellError(
      'API Error: 422 - {"detail":"string_too_long","input":"secret rows"}'
    );
    expect(view.error).toBe('That cell failed.');
    expect(view.error).not.toContain('{');
    expect(view.error).not.toContain('secret rows');
  });
});
