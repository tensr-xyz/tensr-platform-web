import type { SheetOp } from '@/types/sheet';

export type CollabCellEditOutcome = 'local' | 'sent' | 'loading' | 'failed';

type CellEditOp = Omit<Extract<SheetOp, { kind: 'update_cell' }>, 'actor' | 'timestamp'>;

/**
 * During a collaboration session an edit is only real once it reaches the server copy,
 * because save-back writes that copy. An edit that cannot be sent must be refused,
 * never kept on screen as a local-only change.
 */
export async function sendCollabCellEdit({
  sheetId,
  sheetReady,
  applyOperation,
  op,
}: {
  sheetId: string | null | undefined;
  sheetReady: boolean;
  applyOperation: ((op: Omit<SheetOp, 'actor' | 'timestamp'>) => Promise<boolean>) | undefined;
  op: CellEditOp;
}): Promise<CollabCellEditOutcome> {
  if (!sheetId) return 'local';
  if (!sheetReady || !applyOperation) return 'loading';
  try {
    return (await applyOperation(op)) ? 'sent' : 'failed';
  } catch (error) {
    console.error('Failed to apply sheet operation:', error);
    return 'failed';
  }
}

export const COLLAB_EDIT_REFUSED: Record<
  'loading' | 'failed',
  { title: string; description: string }
> = {
  loading: {
    title: 'Edit not made',
    description: 'The shared copy is still loading. Try the edit again in a moment.',
  },
  failed: {
    title: 'Edit not made',
    description:
      'The edit could not be sent to the session, so it was not saved. Check your connection and try again.',
  },
};

export function collabOpRejectedToast(reason: string): { title: string; description: string } {
  const conflict = /version conflict/i.test(reason);
  return {
    title: 'Edit not saved',
    description: conflict
      ? 'Someone else changed the sheet at the same time. The grid now shows the latest shared copy; make the edit again if it is still needed.'
      : `The session refused the edit (${reason}). The grid now shows the latest shared copy.`,
  };
}
