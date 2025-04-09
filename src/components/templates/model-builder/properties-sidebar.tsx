import { useState } from 'react';
import { Sidebar, SidebarContent } from '@/components/organisms/sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/molecules/tabs';
import { PROPERTIES_SECTIONS } from '@/configs/properties-config';

export interface ModelNode {
  id: string;
  label: string;
  type: 'observed' | 'latent';
  x: number;
  y: number;
  variableName?: string;
  dataType?: string;
  missingHandling?: string;
  statistics?: Record<string, number>;
}

interface ModelFitIndices {
  cfi: number;
  rmsea: number;
  srmr: number;
}

interface PropertiesSidebarProps {
  selectedNode: ModelNode | null;
  modelFitIndices: ModelFitIndices | null;
  availableVariables: Array<{
    name: string;
    statistics: {
      mean: number;
      sd: number;
      n: number;
    };
  }>;
  onNodeUpdate: (node: ModelNode) => void;
}

export function PropertiesSidebar({
  selectedNode,
  modelFitIndices,
  availableVariables,
  onNodeUpdate,
}: PropertiesSidebarProps) {
  const [activeSection, setActiveSection] = useState('properties');

  return (
    <Sidebar
      variant="floating"
      className="fixed h-full max-h-screen"
      style={{
        position: 'absolute',
        height: 'calc(100vh - 112px)',
        maxHeight: 'calc(100vh - 112px)',
      }}
    >
      <Tabs
        value={activeSection}
        onValueChange={setActiveSection}
        className="bg-background rounded-lg"
      >
        <TabsList className="grid w-full grid-cols-2">
          {Object.entries(PROPERTIES_SECTIONS).map(([key, { icon, title }]) => (
            <TabsTrigger key={key} value={key} className="px-2" title={title}>
              {icon}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(PROPERTIES_SECTIONS).map(([key, section]) => {
          const Component = section.component;
          return (
            <TabsContent key={key} value={key} className="bg-background rounded-lg">
              <SidebarContent>
                {Component ? (
                  <Component
                    selectedNode={selectedNode}
                    modelFitIndices={modelFitIndices}
                    availableVariables={availableVariables}
                    onNodeUpdate={onNodeUpdate}
                  />
                ) : (
                  <div className="p-4 text-sm text-muted-foreground">
                    No content for this section
                  </div>
                )}
              </SidebarContent>
            </TabsContent>
          );
        })}
      </Tabs>
    </Sidebar>
  );
}
