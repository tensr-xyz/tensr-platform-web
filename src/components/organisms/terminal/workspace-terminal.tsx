'use client';

import { useCallback } from 'react';
import { useTabsStore } from '@/stores/tabs-store';
import { runWorkspaceTerminalCommand } from '@/lib/workspace-terminal-command';
import Terminal from '@/components/organisms/terminal';

/** Terminal with built-in workspace commands (kept out of project-layout for stable HMR). */
export default function WorkspaceTerminal({ className }: { className?: string }) {
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = tabs.find(t => t.id === activeTabId);

  const onCommand = useCallback(
    (command: string) => runWorkspaceTerminalCommand(command, activeTab),
    [activeTab]
  );

  return <Terminal className={className} onCommand={onCommand} />;
}
