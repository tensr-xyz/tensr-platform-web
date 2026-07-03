import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

import type { AnalysisReportChart } from '@/lib/analysis-report-types';
import type { ChatPendingAction } from '@/lib/chat-pending-action';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  /** Inline chart(s) rendered in the agent panel (not the Charts tab). */
  charts?: AnalysisReportChart[];
  /** Inline approve / skip / manage for suggested analyses. */
  pendingAction?: ChatPendingAction;
  /** Assistant reply is still streaming from the API. */
  isStreaming?: boolean;
  /** Muted inline thinking lines shown while analysis runs. */
  thinkingLines?: string[];
  /** Result markdown appended after thinking lines (typewriter + final render). */
  resultMarkdown?: string;
}

export interface ChatThread {
  id: string;
  title: string;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
}

interface ProjectChats {
  activeThreadId: string;
  threads: Record<string, ChatThread>;
}

interface ChatState {
  projects: Record<string, ProjectChats>;
}

interface ChatActions {
  initializeSession: (projectId: string) => void;
  createThread: (projectId: string) => string;
  setActiveThread: (projectId: string, threadId: string) => void;
  closeThread: (projectId: string, threadId: string) => void;
  getThreads: (projectId: string) => ChatThread[];
  getActiveThreadId: (projectId: string) => string | null;
  addMessage: (projectId: string, message: Omit<ChatMessage, 'id'>) => string;
  updateMessage: (
    projectId: string,
    messageId: string,
    patch: Partial<Omit<ChatMessage, 'id'>>
  ) => void;
  /** Mark unaccepted analysis_plan suggestion cards as expired (single-line collapsed UI). */
  expirePendingSuggestionCards: (projectId: string, excludeMessageId?: string) => void;
  setLoading: (projectId: string, loading: boolean) => void;
  setError: (projectId: string, error: string | null) => void;
  clearMessages: (projectId: string) => void;
  getMessages: (projectId: string) => ChatMessage[];
  getLoading: (projectId: string) => boolean;
  getError: (projectId: string) => string | null;
}

type ChatStore = ChatState & ChatActions;

const DEFAULT_THREAD_TITLE = 'New chat';

function threadTitleFromMessage(content: string): string {
  const plain = content.replace(/\*\*/g, '').replace(/\n/g, ' ').trim();
  if (!plain) return DEFAULT_THREAD_TITLE;
  return plain.length > 28 ? `${plain.slice(0, 28)}…` : plain;
}

function createEmptyThread(id?: string): ChatThread {
  return {
    id: id ?? uuidv4(),
    title: DEFAULT_THREAD_TITLE,
    messages: [],
    isLoading: false,
    error: null,
  };
}

function ensureProject(state: ChatState, projectId: string): ProjectChats {
  const existing = state.projects[projectId];
  if (existing) return existing;

  const thread = createEmptyThread();
  return {
    activeThreadId: thread.id,
    threads: { [thread.id]: thread },
  };
}

function getActiveThread(project: ProjectChats): ChatThread {
  return project.threads[project.activeThreadId] ?? Object.values(project.threads)[0];
}

const initialState: ChatState = {
  projects: {},
};

export const useChatStore = create<ChatStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      initializeSession: (projectId: string) => {
        set(state => {
          if (state.projects[projectId]) return state;
          const project = ensureProject(state, projectId);
          return {
            projects: {
              ...state.projects,
              [projectId]: project,
            },
          };
        });
      },

      createThread: (projectId: string) => {
        const thread = createEmptyThread();
        set(state => {
          const project = ensureProject(state, projectId);
          return {
            projects: {
              ...state.projects,
              [projectId]: {
                activeThreadId: thread.id,
                threads: {
                  ...project.threads,
                  [thread.id]: thread,
                },
              },
            },
          };
        });
        return thread.id;
      },

      setActiveThread: (projectId: string, threadId: string) => {
        set(state => {
          const project = state.projects[projectId];
          if (!project?.threads[threadId]) return state;
          return {
            projects: {
              ...state.projects,
              [projectId]: {
                ...project,
                activeThreadId: threadId,
              },
            },
          };
        });
      },

      closeThread: (projectId: string, threadId: string) => {
        set(state => {
          const project = state.projects[projectId];
          if (!project) return state;

          const ids = Object.keys(project.threads);
          if (ids.length <= 1) return state;

          const { [threadId]: _removed, ...remaining } = project.threads;
          const nextIds = Object.keys(remaining);
          const activeThreadId =
            project.activeThreadId === threadId ? nextIds[0] : project.activeThreadId;

          return {
            projects: {
              ...state.projects,
              [projectId]: {
                activeThreadId,
                threads: remaining,
              },
            },
          };
        });
      },

      getThreads: (projectId: string) => {
        const project = get().projects[projectId];
        if (!project) return [];
        return Object.values(project.threads);
      },

      getActiveThreadId: (projectId: string) => {
        return get().projects[projectId]?.activeThreadId ?? null;
      },

      addMessage: (projectId: string, message: Omit<ChatMessage, 'id'>) => {
        const chatMessage: ChatMessage = {
          ...message,
          id: uuidv4(),
        };

        set(state => {
          const project = ensureProject(state, projectId);
          const active = getActiveThread(project);
          const shouldTitle =
            message.role === 'user' &&
            active.title === DEFAULT_THREAD_TITLE &&
            typeof message.content === 'string';

          const updatedThread: ChatThread = {
            ...active,
            messages: [...active.messages, chatMessage],
            error: null,
            title: shouldTitle ? threadTitleFromMessage(message.content) : active.title,
          };

          return {
            projects: {
              ...state.projects,
              [projectId]: {
                ...project,
                threads: {
                  ...project.threads,
                  [active.id]: updatedThread,
                },
              },
            },
          };
        });

        return chatMessage.id;
      },

      updateMessage: (projectId, messageId, patch) => {
        set(state => {
          const project = state.projects[projectId];
          if (!project) return state;
          const active = getActiveThread(project);
          const idx = active.messages.findIndex(m => m.id === messageId);
          if (idx < 0) return state;

          const nextMessages = [...active.messages];
          nextMessages[idx] = { ...nextMessages[idx], ...patch };

          return {
            projects: {
              ...state.projects,
              [projectId]: {
                ...project,
                threads: {
                  ...project.threads,
                  [active.id]: { ...active, messages: nextMessages },
                },
              },
            },
          };
        });
      },

      expirePendingSuggestionCards: (projectId, excludeMessageId) => {
        set(state => {
          const project = state.projects[projectId];
          if (!project) return state;
          const active = getActiveThread(project);
          let changed = false;
          const nextMessages = active.messages.map(m => {
            if (m.id === excludeMessageId) return m;
            const pa = m.pendingAction;
            if (pa?.kind === 'analysis_plan' && pa.status === 'pending') {
              changed = true;
              return {
                ...m,
                pendingAction: { ...pa, status: 'expired' as const },
              };
            }
            return m;
          });
          if (!changed) return state;
          return {
            projects: {
              ...state.projects,
              [projectId]: {
                ...project,
                threads: {
                  ...project.threads,
                  [active.id]: { ...active, messages: nextMessages },
                },
              },
            },
          };
        });
      },

      setLoading: (projectId: string, loading: boolean) => {
        set(state => {
          const project = state.projects[projectId];
          if (!project) return state;
          const active = getActiveThread(project);
          return {
            projects: {
              ...state.projects,
              [projectId]: {
                ...project,
                threads: {
                  ...project.threads,
                  [active.id]: { ...active, isLoading: loading },
                },
              },
            },
          };
        });
      },

      setError: (projectId: string, error: string | null) => {
        set(state => {
          const project = state.projects[projectId];
          if (!project) return state;
          const active = getActiveThread(project);
          return {
            projects: {
              ...state.projects,
              [projectId]: {
                ...project,
                threads: {
                  ...project.threads,
                  [active.id]: { ...active, error, isLoading: false },
                },
              },
            },
          };
        });
      },

      clearMessages: (projectId: string) => {
        set(state => {
          const project = state.projects[projectId];
          if (!project) return state;
          const active = getActiveThread(project);
          return {
            projects: {
              ...state.projects,
              [projectId]: {
                ...project,
                threads: {
                  ...project.threads,
                  [active.id]: {
                    ...active,
                    messages: [],
                    error: null,
                    title: DEFAULT_THREAD_TITLE,
                  },
                },
              },
            },
          };
        });
      },

      getMessages: (projectId: string) => {
        const project = get().projects[projectId];
        if (!project) return [];
        return getActiveThread(project).messages;
      },

      getLoading: (projectId: string) => {
        const project = get().projects[projectId];
        if (!project) return false;
        return getActiveThread(project).isLoading;
      },

      getError: (projectId: string) => {
        const project = get().projects[projectId];
        if (!project) return null;
        return getActiveThread(project).error;
      },
    }),
    {
      name: 'chat-store',
    }
  )
);
