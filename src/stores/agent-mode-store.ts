import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AgentMode = 'ask' | 'plan' | 'agent';

const DEFAULT_MODE: AgentMode = 'agent';

interface AgentModeState {
  modes: Record<string, AgentMode>;
}

interface AgentModeActions {
  getMode: (projectId: string) => AgentMode;
  setMode: (projectId: string, mode: AgentMode) => void;
}

type AgentModeStore = AgentModeState & AgentModeActions;

export const useAgentModeStore = create<AgentModeStore>()(
  persist(
    (set, get) => ({
      modes: {},

      getMode: (projectId: string) => get().modes[projectId] ?? DEFAULT_MODE,

      setMode: (projectId: string, mode: AgentMode) => {
        set(state => ({
          modes: { ...state.modes, [projectId]: mode },
        }));
      },
    }),
    { name: 'tensr-agent-mode' }
  )
);
