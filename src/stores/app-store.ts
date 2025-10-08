import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// Dialog types matching the current context
export enum DialogType {
  NEW_PROJECT = 'new-project',
  SETTINGS = 'settings',
  IMPORT_WIZARD = 'import-wizard',
}

interface AppState {
  // Sidebar state
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;

  // Modal states
  modals: {
    [key: string]: boolean;
  };

  // Loading states
  loadingStates: {
    [key: string]: boolean;
  };

  // Notifications
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    duration?: number;
  }>;

  // Global search
  searchOpen: boolean;
  searchQuery: string;

  // Dialog management (from App Context)
  activeDialog: DialogType | null;
  dialogProps: Record<string, unknown>;

  // View management (from App Context)
  currentView: string;
  previousView: string | null;

  // Global loading and error (from App Context)
  isLoading: boolean;
  error: string | null;
}

interface AppActions {
  // Sidebar actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Modal actions
  openModal: (key: string) => void;
  closeModal: (key: string) => void;
  closeAllModals: () => void;

  // Loading actions
  setLoading: (key: string, loading: boolean) => void;

  // Notification actions
  addNotification: (notification: Omit<AppState['notifications'][0], 'id'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;

  // Search actions
  setSearchOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;

  // Dialog actions (from App Context)
  showDialog: (dialog: DialogType, props?: Record<string, unknown>) => void;
  hideDialog: () => void;

  // View actions (from App Context)
  setView: (view: string) => void;

  // Global state actions (from App Context)
  setGlobalLoading: (loading: boolean) => void;
  setGlobalError: (error: string | null) => void;

  // Reset actions
  reset: () => void;
}

type AppStore = AppState & AppActions;

const initialState: AppState = {
  sidebarOpen: true,
  sidebarCollapsed: false,
  modals: {},
  loadingStates: {},
  notifications: [],
  searchOpen: false,
  searchQuery: '',
  activeDialog: null,
  dialogProps: {},
  currentView: 'projects',
  previousView: null,
  isLoading: false,
  error: null,
};

export const useAppStore = create<AppStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // Sidebar actions
      toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: open => set({ sidebarOpen: open }),
      setSidebarCollapsed: collapsed => set({ sidebarCollapsed: collapsed }),

      // Modal actions
      openModal: key =>
        set(state => ({
          modals: { ...state.modals, [key]: true },
        })),
      closeModal: key =>
        set(state => ({
          modals: { ...state.modals, [key]: false },
        })),
      closeAllModals: () => set({ modals: {} }),

      // Loading actions
      setLoading: (key, loading) =>
        set(state => ({
          loadingStates: { ...state.loadingStates, [key]: loading },
        })),

      // Notification actions
      addNotification: notification => {
        const id = Math.random().toString(36).substr(2, 9);
        const newNotification = { ...notification, id };

        set(state => ({
          notifications: [...state.notifications, newNotification],
        }));

        // Auto-remove notification after duration (default: 5000ms)
        const duration = notification.duration || 5000;
        setTimeout(() => {
          get().removeNotification(id);
        }, duration);
      },
      removeNotification: id =>
        set(state => ({
          notifications: state.notifications.filter(n => n.id !== id),
        })),
      clearNotifications: () => set({ notifications: [] }),

      // Search actions
      setSearchOpen: open => set({ searchOpen: open }),
      setSearchQuery: query => set({ searchQuery: query }),

      // Dialog actions (from App Context)
      showDialog: (dialog, props = {}) =>
        set({
          activeDialog: dialog,
          dialogProps: props,
        }),
      hideDialog: () =>
        set({
          activeDialog: null,
          dialogProps: {},
        }),

      // View actions (from App Context)
      setView: view =>
        set(state => ({
          previousView: state.currentView,
          currentView: view,
        })),

      // Global state actions (from App Context)
      setGlobalLoading: loading => set({ isLoading: loading }),
      setGlobalError: error => set({ error }),

      // Reset actions
      reset: () => set(initialState),
    }),
    {
      name: 'app-store',
    }
  )
);
