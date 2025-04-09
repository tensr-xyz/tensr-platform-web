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
import { useTabs } from '@/contexts/tabs-context';

import { ANALYSIS_COMPONENTS, MENU_ITEMS, type MenuItems } from '@/configs/analysis-config';
import PluginPanel from '@/components/organisms/plugin-panel';
import { ColumnType } from '@tensr/sdk';

interface AnalysisItemProps {
  item: string;
}

interface AnalysisSidebarProps {
  onToggleSidebar: () => void;
}

const AnalysisItem = ({ item }: AnalysisItemProps) => {
  const AnalysisComponent = ANALYSIS_COMPONENTS[item];

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
  const { state } = useTabs();
  const activeTab = state.tabs.find(tab => tab.id === state.activeTabId);
  // const [activeFilters, setActiveFilters] = useState<Record<string, Set<string>>>({});
  //
  // const handleFilterChange = (columnName: string, values: Set<string>) => {
  //   setActiveFilters(prev => ({
  //     ...prev,
  //     [columnName]: values,
  //   }));
  // };
  const handleFilterChange = (columnName: string, values: Set<string>) => {
    // You can implement the filter logic here when needed
    console.log('Filter changed:', columnName, values);
  };

  const getVisibleMenuItems = (): MenuItems => {
    return Object.entries(MENU_ITEMS).reduce((acc, [key, value]) => {
      if (
        (key === 'actions' || key === 'graph_options' || key === 'plugins') &&
        activeTab !== undefined
      ) {
        acc[key] = value;
      } else if (key !== 'actions' && key !== 'graph_options' && key !== 'plugins') {
        acc[key] = value;
      }
      return acc;
    }, {} as MenuItems);
  };

  const renderSpreadsheetContent = (key: string) => {
    // First check if activeTab exists
    if (!activeTab) return null;

    // Then check if it's a spreadsheet type
    if (activeTab.type !== 'spreadsheet') return null;

    // Now check if we have data
    if (!activeTab.data) return null;

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

      // Transform the data into a format plugins can understand
      // The data is already in object form, we just need to handle number conversion
      const processedData = activeTab.data.initialData.map((row: any) => {
        const processedRow: Record<string, any> = {};
        activeTab.data.initialColumns.forEach((col: any) => {
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

    return Object.entries(MENU_ITEMS[key].sections).map(([sectionName, items], index) => (
      <Accordion key={`${key}-${index}`} type="single" collapsible defaultValue="item-1">
        <AccordionItem value="item-1">
          <AccordionTrigger>{sectionName}</AccordionTrigger>
          {items.map((item, itemIndex) => (
            <AnalysisItem key={`${sectionName}-${itemIndex}`} item={item} />
          ))}
        </AccordionItem>
      </Accordion>
    ));
  };

  const visibleMenuItems = getVisibleMenuItems();
  const defaultTab = Object.keys(visibleMenuItems)[0] || 'data';

  return (
    <Tabs defaultValue={defaultTab}>
      <div className="flex items-center bg-background">
        <Button onClick={onToggleSidebar} size="icon" variant="ghost" className="mx-1">
          <LuMinus className="h-4 w-4" />
        </Button>
        <ScrollArea className="flex-1">
          <TabsList className="bg-transparent">
            {Object.entries(visibleMenuItems).map(([key, { icon }]) => (
              <TabsTrigger
                key={key}
                value={key}
                className="flex flex-1 flex-row gap-2 px-3 items-center justify-center data-[state=active]:border-b data-[state=inactive]:bg-background"
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

      {Object.entries(MENU_ITEMS).map(([key]) => (
        <TabsContent key={key} value={key} className="p-0 border-0 h-full overflow-auto">
          {renderMenuSections(key)}
        </TabsContent>
      ))}
    </Tabs>
  );
};

export default AnalysisSidebar;
