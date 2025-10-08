import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatSession {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
}

interface ChatState {
  // Key by projectId to maintain separate chat sessions per project
  sessions: Record<string, ChatSession>;
}

interface ChatActions {
  // Initialize a chat session for a project
  initializeSession: (projectId: string) => void;

  // Add a message to a project's chat session
  addMessage: (projectId: string, message: Omit<ChatMessage, 'id'>) => void;

  // Set loading state for a project's chat session
  setLoading: (projectId: string, loading: boolean) => void;

  // Set error state for a project's chat session
  setError: (projectId: string, error: string | null) => void;

  // Clear messages for a project's chat session
  clearMessages: (projectId: string) => void;

  // Get messages for a project's chat session
  getMessages: (projectId: string) => ChatMessage[];

  // Get loading state for a project's chat session
  getLoading: (projectId: string) => boolean;

  // Get error state for a project's chat session
  getError: (projectId: string) => string | null;
}

type ChatStore = ChatState & ChatActions;

const initialState: ChatState = {
  sessions: {},
};

export const useChatStore = create<ChatStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      initializeSession: (projectId: string) => {
        set(state => ({
          sessions: {
            ...state.sessions,
            [projectId]: {
              messages: [],
              isLoading: false,
              error: null,
            },
          },
        }));
      },

      addMessage: (projectId: string, message: Omit<ChatMessage, 'id'>) => {
        const chatMessage: ChatMessage = {
          ...message,
          id: uuidv4(),
        };

        set(state => {
          const currentSession = state.sessions[projectId] || {
            messages: [],
            isLoading: false,
            error: null,
          };

          return {
            sessions: {
              ...state.sessions,
              [projectId]: {
                ...currentSession,
                messages: [...currentSession.messages, chatMessage],
                error: null, // Clear error when adding a message
              },
            },
          };
        });
      },

      setLoading: (projectId: string, loading: boolean) => {
        set(state => {
          const currentSession = state.sessions[projectId] || {
            messages: [],
            isLoading: false,
            error: null,
          };

          return {
            sessions: {
              ...state.sessions,
              [projectId]: {
                ...currentSession,
                isLoading: loading,
              },
            },
          };
        });
      },

      setError: (projectId: string, error: string | null) => {
        set(state => {
          const currentSession = state.sessions[projectId] || {
            messages: [],
            isLoading: false,
            error: null,
          };

          return {
            sessions: {
              ...state.sessions,
              [projectId]: {
                ...currentSession,
                error,
                isLoading: false, // Clear loading when setting error
              },
            },
          };
        });
      },

      clearMessages: (projectId: string) => {
        set(state => {
          const currentSession = state.sessions[projectId] || {
            messages: [],
            isLoading: false,
            error: null,
          };

          return {
            sessions: {
              ...state.sessions,
              [projectId]: {
                ...currentSession,
                messages: [],
                error: null,
              },
            },
          };
        });
      },

      getMessages: (projectId: string) => {
        const session = get().sessions[projectId];
        return session?.messages || [];
      },

      getLoading: (projectId: string) => {
        const session = get().sessions[projectId];
        return session?.isLoading || false;
      },

      getError: (projectId: string) => {
        const session = get().sessions[projectId];
        return session?.error || null;
      },
    }),
    {
      name: 'chat-store',
    }
  )
);
