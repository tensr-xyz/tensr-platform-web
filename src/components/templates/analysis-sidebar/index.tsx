import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/molecules/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/molecules/accordion';
import { DialogTrigger } from '@/components/molecules/dialog';
import { ScrollArea, ScrollBar } from '@/components/atoms/scroll-area';
import FilterPanel from '@/components/organisms/filter-panel';
import ChartPanel from '@/components/organisms/chart-panel';
import { useTabsStore } from '@/stores/tabs-store';

import { ANALYSIS_COMPONENTS, MENU_ITEMS, type MenuItems } from '@/configs/analysis-config';
import { AgentPanel } from '@/components/organisms/agent-panel';

interface AnalysisItemProps {
  item: string;
}

interface AnalysisSidebarProps {}

const AnalysisItem = ({ item }: AnalysisItemProps) => {
  const AnalysisComponent = ANALYSIS_COMPONENTS[item];

  // Debug logging
  console.log(`Looking for component for: "${item}"`, {
    found: !!AnalysisComponent,
    component: AnalysisComponent,
    availableKeys: Object.keys(ANALYSIS_COMPONENTS),
  });

  if (!AnalysisComponent) {
    return (
      <AccordionContent className="cursor-not-allowed">
        <div className="px-2 py-1 opacity-50">{item} (Coming Soon)</div>
      </AccordionContent>
    );
  }

  return (
    <AccordionContent className="hover:bg-accent">
      <AnalysisComponent>
        <DialogTrigger asChild>
          <div className="px-2 py-1 cursor-pointer">{item}</div>
        </DialogTrigger>
      </AnalysisComponent>
    </AccordionContent>
  );
};

const AnalysisSidebar = ({}: AnalysisSidebarProps) => {
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = tabs.find(tab => tab.id === activeTabId);

  const handleFilterChange = (columnName: string, values: Set<string>) => {
    // You can implement the filter logic here when needed
    console.log('Filter changed:', columnName, values);
  };

  const getVisibleMenuItems = (): MenuItems => {
    // Only show agent, actions, and graph_options
    // The other tabs (transform, analyze, visualization, time_series, ml_ai, syntax, utilities)
    // have been moved to the left panel Analysis tab
    // Plugins has been moved to the left panel Plugins tab
    const visibleKeys = ['agent', 'actions', 'graph_options'] as const;
    const filteredItems: MenuItems = {};

    visibleKeys.forEach(key => {
      if (MENU_ITEMS[key]) {
        filteredItems[key] = MENU_ITEMS[key];
      }
    });

    return filteredItems;
  };

  const renderSpreadsheetContent = (key: string) => {
    // First check if activeTab exists
    if (!activeTab) return null;

    // Then check if it's a spreadsheet type
    if (activeTab.type !== 'spreadsheet') return null;

    // Now check if we have data
    if (!activeTab.data) return null;

    if (key === 'agent') {
      return (
        <div
          className="w-full h-full flex flex-col overflow-hidden"
          style={{ maxWidth: '100%', width: '100%' }}
        >
          <AgentPanel />
        </div>
      );
    }

    if (key === 'actions') {
      return (
        <FilterPanel
          filePath={activeTab.data.filePath}
          columnNames={activeTab.data.initialColumns?.map((col: any) => col.id) || []}
          onFilterChange={handleFilterChange}
        />
      );
    }

    if (key === 'graph_options') {
      const columns =
        activeTab.data.initialColumns?.map((col: any) => ({
          id: col.id,
          type: col.type || 'string',
        })) || [];

      return <ChartPanel columns={columns} />;
    }

    return null;
  };

  const renderMenuSections = (key: string) => {
    const spreadsheetContent = renderSpreadsheetContent(key);
    if (spreadsheetContent) return spreadsheetContent;

    // For the remaining tabs (agent, actions, graph_options, plugins),
    // they don't have sections, so return null or empty content
    // The actual content is handled by renderSpreadsheetContent
    return null;
  };

  const visibleMenuItems = getVisibleMenuItems();
  const defaultTab = Object.keys(visibleMenuItems)[0] || 'data';

  return (
    <Tabs defaultValue={defaultTab} className="flex flex-col h-full">
      <div className="flex items-center bg-background border-b border-border !min-h-10">
        <ScrollArea className="flex-1">
          <TabsList className="p-0 rounded-none bg-transparent h-10">
            {Object.entries(visibleMenuItems).map(([key, { icon }]) => (
              <TabsTrigger
                key={key}
                value={key}
                className="flex flex-1 flex-row gap-2 items-center justify-center data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:rounded-none data-[state=active]:h-full"
                isClosable={false}
              >
                {icon}
                <span className="text-xs capitalize">{key}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <div className="flex-1 overflow-hidden">
        {Object.entries(visibleMenuItems).map(([key]) => (
          <TabsContent
            key={key}
            value={key}
            className="p-0 border-0 h-full overflow-hidden flex flex-col"
            style={{ maxWidth: '100%', width: '100%' }}
          >
            <div className="h-full w-full overflow-hidden">{renderMenuSections(key)}</div>
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
};

export default AnalysisSidebar;
