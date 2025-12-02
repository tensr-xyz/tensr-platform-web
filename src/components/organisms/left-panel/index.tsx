import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/molecules/tabs';
import { FolderComponent } from '@/components/organisms/file-tree';
import { AnalysisPanel } from '@/components/organisms/analysis-panel';
import { PluginsPanel } from '@/components/organisms/plugins-panel';
import { Folder, Calculator, Blocks } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/atoms/scroll-area';

export const LeftPanel: React.FC = () => {
  return (
    <Tabs defaultValue="files" className="flex flex-col h-full">
      <div className="flex items-center bg-background border-b border-border !min-h-10">
        <ScrollArea className="flex-1">
          <TabsList className="p-0 rounded-none bg-transparent h-10">
            <TabsTrigger
              value="files"
              className="flex flex-1 flex-row gap-2 items-center justify-center data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:rounded-none data-[state=active]:h-full"
              isClosable={false}
            >
              <Folder className="h-4 w-4" />
              <span className="text-xs capitalize">Files</span>
            </TabsTrigger>
            <TabsTrigger
              value="analysis"
              className="flex flex-1 flex-row gap-2 items-center justify-center data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:rounded-none data-[state=active]:h-full"
              isClosable={false}
            >
              <Calculator className="h-4 w-4" />
              <span className="text-xs capitalize">Analysis</span>
            </TabsTrigger>
            <TabsTrigger
              value="plugins"
              className="flex flex-1 flex-row gap-2 items-center justify-center data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:rounded-none data-[state=active]:h-full"
              isClosable={false}
            >
              <Blocks className="h-4 w-4" />
              <span className="text-xs capitalize">Plugins</span>
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <div className="flex-1 overflow-hidden">
        <TabsContent value="files" className="p-0 border-0 h-full overflow-hidden m-0">
          <FolderComponent />
        </TabsContent>
        <TabsContent value="analysis" className="p-0 border-0 h-full overflow-hidden m-0">
          <AnalysisPanel />
        </TabsContent>
        <TabsContent value="plugins" className="p-0 border-0 h-full overflow-hidden m-0">
          <PluginsPanel />
        </TabsContent>
      </div>
    </Tabs>
  );
};
