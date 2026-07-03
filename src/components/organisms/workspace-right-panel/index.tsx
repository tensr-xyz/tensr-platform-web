'use client';

import React from 'react';
import { useTabsStore, ViewType } from '@/stores/tabs-store';
import { useProjectStore, ViewType as ProjectViewType } from '@/stores/project-store';
import { AgentPanel } from '@/components/organisms/agent-panel';
import { getDatasetIdFromTab } from '@/lib/workspace-dataset';

/** Right panel is agent only — chart configuration lives in the left panel. */
const WorkspaceRightPanel = () => {
  const { tabs, activeTabId } = useTabsStore();
  const { activeView } = useProjectStore();
  const activeTab = tabs.find(tab => tab.id === activeTabId);

  const canShowAgent =
    !!activeTab &&
    (activeTab.type === ViewType.SPREADSHEET || activeTab.type === ViewType.ANALYSIS_RESULT) &&
    !!getDatasetIdFromTab(activeTab);

  if (!canShowAgent) {
    return null;
  }

  const agentVariant = activeView === ProjectViewType.NOTEBOOK ? 'notebook' : 'default';

  return (
    <div className="h-full w-full overflow-hidden">
      <AgentPanel variant={agentVariant} />
    </div>
  );
};

export default WorkspaceRightPanel;
