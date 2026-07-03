import { useCallback } from 'react';
import { useTabsStore } from '@/stores/tabs-store';
import { runWorkspaceTerminalCommand } from '@/lib/workspace-terminal-command';

/** @deprecated Prefer `<WorkspaceTerminal />`; kept for Turbopack/HMR compatibility. */
export function useWorkspaceTerminal() {
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = tabs.find(t => t.id === activeTabId);

  return useCallback(
    (command: string) => runWorkspaceTerminalCommand(command, activeTab),
    [activeTab]
  );
}
