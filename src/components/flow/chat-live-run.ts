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
