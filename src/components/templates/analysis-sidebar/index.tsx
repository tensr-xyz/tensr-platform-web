import { useTabsStore } from '@/stores/tabs-store';
import { AgentPanel } from '@/components/organisms/agent-panel';
const AnalysisSidebar = () => {
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = tabs.find(tab => tab.id === activeTabId);

  if (!activeTab || activeTab.type !== 'spreadsheet' || !activeTab.data) {
    return null;
  }

  return (
    <div className="h-full w-full overflow-hidden">
      <AgentPanel />
    </div>
  );
};

export default AnalysisSidebar;
