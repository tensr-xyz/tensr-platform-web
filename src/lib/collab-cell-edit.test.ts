import { collabOpRejectedToast, sendCollabCellEdit } from './collab-cell-edit';

const op = {
  kind: 'update_cell' as const,
  row: 0,
  column: 'score',
  oldValue: '1',
  newValue: '1000',
};

describe('sendCollabCellEdit', () => {
  it('leaves edits outside a session to the local grid', async () => {
    const applyOperation = jest.fn();
    await expect(
      sendCollabCellEdit({ sheetId: null, sheetReady: false, applyOperation, op })
    ).resolves.toBe('local');
    expect(applyOperation).not.toHaveBeenCalled();
  });

  it('refuses an edit while the shared copy is loading', async () => {
    const applyOperation = jest.fn();
    await expect(
      sendCollabCellEdit({ sheetId: 'session:s1', sheetReady: false, applyOperation, op })
    ).resolves.toBe('loading');
    expect(applyOperation).not.toHaveBeenCalled();
  });

  it('sends the edit when the shared copy is ready', async () => {
    const applyOperation = jest.fn().mockResolvedValue(true);
    await expect(
      sendCollabCellEdit({ sheetId: 'session:s1', sheetReady: true, applyOperation, op })
    ).resolves.toBe('sent');
    expect(applyOperation).toHaveBeenCalledWith(op);
  });

  it('reports a failed send instead of keeping the edit locally', async () => {
    const closedSocket = jest.fn().mockResolvedValue(false);
    await expect(
      sendCollabCellEdit({
        sheetId: 'session:s1',
        sheetReady: true,
        applyOperation: closedSocket,
        op,
      })
    ).resolves.toBe('failed');

    const throws = jest.fn().mockRejectedValue(new Error('socket closed'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      sendCollabCellEdit({ sheetId: 'session:s1', sheetReady: true, applyOperation: throws, op })
    ).resolves.toBe('failed');
  });
});

describe('collabOpRejectedToast', () => {
  it('explains a clash with another user plainly', () => {
    expect(collabOpRejectedToast('Version conflict').description).toMatch(
      /Someone else changed the sheet/
    );
  });

  it('passes other refusal reasons through', () => {
    expect(collabOpRejectedToast('Viewers cannot edit').description).toMatch(/Viewers cannot edit/);
  });
});
