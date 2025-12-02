import React from 'react';
import { useTabsStore } from '@/stores/tabs-store';
import PluginPanel from '@/components/organisms/plugin-panel';
import { ColumnType } from '@tensr/sdk';
import { SidebarContent, SidebarGroupContent } from '@/components/organisms/sidebar';

export const PluginsPanel: React.FC = () => {
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = tabs.find(tab => tab.id === activeTabId);

  // First ensure we have valid data
  if (!activeTab?.data?.initialData || !activeTab?.data?.initialColumns) {
    return (
      <SidebarContent>
        <SidebarGroupContent className="px-3 py-2">
          <PluginPanel />
        </SidebarGroupContent>
      </SidebarContent>
    );
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
      columns: activeTab.data.initialColumns.map((col: { id: any; header: any; type: string }) => ({
        id: col.id,
        name: col.header,
        type: col.type as ColumnType,
      })),
      totalRows: activeTab.data.totalRows,
      totalColumns: activeTab.data.totalColumns,
    },
  };

  return (
    <SidebarContent>
      <SidebarGroupContent className="px-3 py-2">
        <PluginPanel activeData={dataSet} />
      </SidebarGroupContent>
    </SidebarContent>
  );
};
