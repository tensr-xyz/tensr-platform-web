import { LuMinus } from 'react-icons/lu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/molecules/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/molecules/accordion';
import { DialogTrigger } from '@/components/molecules/dialog';
import { ScrollArea, ScrollBar } from '@/components/atoms/scroll-area';
import { Button } from '@/components/atoms/button';
import FilterPanel from '@/components/organisms/filter-panel';
import ChartPanel from '@/components/organisms/chart-panel';
import { useTabsStore } from '@/stores/tabs-store';

import { ANALYSIS_COMPONENTS, MENU_ITEMS, type MenuItems } from '@/configs/analysis-config';
import PluginPanel from '@/components/organisms/plugin-panel';
import { ColumnType } from '@tensr/sdk';
import { AgentPanel } from '@/components/organisms/agent-panel';

interface AnalysisItemProps {
  item: string;
}

interface AnalysisSidebarProps {
  onToggleSidebar: () => void;
}

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

const AnalysisSidebar = ({ onToggleSidebar }: AnalysisSidebarProps) => {
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = tabs.find(tab => tab.id === activeTabId);

  const handleFilterChange = (columnName: string, values: Set<string>) => {
    // You can implement the filter logic here when needed
    console.log('Filter changed:', columnName, values);
  };

  const getVisibleMenuItems = (): MenuItems => {
    // Remove 'data' from the menu items since we've moved it to folder component
    const filteredItems = { ...MENU_ITEMS };
    delete filteredItems.data;

    // Show all menu items regardless of whether tabs are open
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

    if (key === 'plugins') {
      // First ensure we have valid data
      if (!activeTab?.data?.initialData || !activeTab?.data?.initialColumns) {
        return <PluginPanel activeFileType={'csv'} />;
      }

      const { initialData, initialColumns } = activeTab.data;

      // Transform the data into a format plugins can understand
      // The data is already in object form, we just need to handle number conversion
      const processedData = initialData.map((row: any) => {
        const processedRow: Record<string, any> = {};
        initialColumns.forEach((col: any) => {
          const value = row[col.id];
          // Convert numeric strings to numbers if appropriate
          if (typeof value === 'string' && !isNaN(Number(value)) && value !== '') {
            processedRow[col.id] = Number(value);
          } else {
            processedRow[col.id] = value;
          }
        });
        return processedRow;
      });

      const dataSet = {
        data: processedData,
        metadata: {
          columns: activeTab.data.initialColumns.map(
            (col: { id: any; header: any; type: string }) => ({
              id: col.id,
              name: col.header,
              type: col.type as ColumnType,
            })
          ),
          totalRows: activeTab.data.totalRows,
          totalColumns: activeTab.data.totalColumns,
          fileType: 'csv',
        },
      };

      return <PluginPanel activeFileType={'csv'} activeData={dataSet} />;
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

    // Handle special cases for new menu items
    if (key === 'visualization' || key === 'time_series' || key === 'ml_ai' || key === 'syntax') {
      return (
        <div className="space-y-4">
          {Object.entries(MENU_ITEMS[key].sections).map(([sectionName, items], index) => (
            <Accordion key={`${key}-${index}`} type="single" collapsible defaultValue="item-1">
              <AccordionItem value="item-1">
                <AccordionTrigger className="text-sm font-medium">{sectionName}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-1">
                    {items.map((item, itemIndex) => (
                      <AnalysisItem key={`${sectionName}-${itemIndex}`} item={item} />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {Object.entries(MENU_ITEMS[key].sections).map(([sectionName, items], index) => (
          <Accordion key={`${key}-${index}`} type="single" collapsible defaultValue="item-1">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-sm font-medium">{sectionName}</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1">
                  {items.map((item, itemIndex) => (
                    <AnalysisItem key={`${sectionName}-${itemIndex}`} item={item} />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ))}
      </div>
    );
  };

  const visibleMenuItems = getVisibleMenuItems();
  const defaultTab = Object.keys(visibleMenuItems)[0] || 'data';

  return (
    <Tabs defaultValue={defaultTab} className="flex flex-col h-full">
      <div className="flex items-center bg-background border-b border-border !min-h-10">
        <Button onClick={onToggleSidebar} size="icon" variant="ghost" className="mx-1">
          <LuMinus className="h-4 w-4" />
        </Button>
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
