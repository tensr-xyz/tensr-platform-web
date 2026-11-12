/** A chat run that outlives the Chat screen. Leaving the tab unmounts the screen; this does not. */

export type LiveChatRun = {
  projectId: string;
  sessionId: string | null;
  question: string;
  answer: string;
  steps: string[];
  status: string | null;
  running: boolean;
};

let current: LiveChatRun | null = null;
const listeners = new Set<() => void>();

export function liveChatRun(): LiveChatRun | null {
  return current;
}

export function publishLiveChatRun(next: LiveChatRun | null) {
  current = next;
  listeners.forEach(listener => listener());
}

export function subscribeLiveChatRun(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function chatRunInFlight(projectId: string): boolean {
  return Boolean(current?.running && current.projectId === projectId);
}

/** A finished turn may update only the question that started it. */
export function livePublishMatches(
  run: LiveChatRun | null,
  projectId: string,
  sessionId: string | null,
  question: string
): boolean {
  if (!run || run.projectId !== projectId) return false;
  if ((run.sessionId || '') !== (sessionId || '')) return false;
  return run.question.trim() === question.trim();
}
