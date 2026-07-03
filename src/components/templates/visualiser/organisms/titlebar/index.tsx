'use client';

import React from 'react';
import { ScrollArea, ScrollBar } from '@/components/templates/visualiser/molecules/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/templates/visualiser/molecules/tabs';
import { useTabsStore, Tab } from '@/stores/visualiser/tabs-store';

interface TitlebarProps {
  tabs?: Tab[];
  activeTab?: Tab;
  onTabClose?: (id: string) => void;
}

const Titlebar = ({ tabs = [], activeTab, onTabClose }: TitlebarProps) => {
  const { setActiveTab } = useTabsStore();

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  const handleTabClose = (id: string) => {
    if (onTabClose) {
      onTabClose(id);
    }
  };

  return (
    <div className="h-10 bg-accent border-b border-border flex items-stretch relative">
      <div className="flex-1 flex justify-between items-center">
        <div className="flex-1 flex items-center overflow-hidden">
          {tabs && tabs.length > 0 && (
            <Tabs value={activeTab?.id} onValueChange={handleTabChange} className="flex-1">
              <ScrollArea className="w-full h-10">
                <TabsList className="h-10 inline-flex border-none p-0 rounded-none">
                  {tabs.map(tab => (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      onClose={() => handleTabClose(tab.id)}
                      isClosable
                      className="shrink-0 h-10 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:mb-0 text-xs"
                    >
                      {tab.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
};

export default Titlebar;
