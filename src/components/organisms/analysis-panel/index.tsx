import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/atoms/input';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/molecules/accordion';
import { ScrollArea } from '@/components/atoms/scroll-area';
import { SidebarContent, SidebarGroupContent } from '@/components/organisms/sidebar';
import {
  getAllAnalysisItems,
  filterAnalysisItems,
  groupAnalysisItems,
  type AnalysisItem,
} from '@/configs/analysis-config/utils';
import { PALETTE_TAB_LABELS } from '@/configs/analysis-config/utils';

interface AnalysisItemComponentProps {
  item: AnalysisItem;
}

const AnalysisItemComponent = ({ item }: AnalysisItemComponentProps) => {
  const AnalysisComponent = item.component;

  if (!AnalysisComponent) {
    return null;
  }

  return (
    <AnalysisComponent>
      <button
        type="button"
        className="w-full px-2 py-1 text-left text-sm rounded-sm hover:bg-accent cursor-pointer"
      >
        {item.name}
      </button>
    </AnalysisComponent>
  );
};

export const AnalysisPanel: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const allItems = useMemo(() => getAllAnalysisItems(), []);

  const filteredItems = useMemo(() => {
    return filterAnalysisItems(allItems, searchTerm);
  }, [allItems, searchTerm]);

  const groupedItems = useMemo(() => {
    return groupAnalysisItems(filteredItems);
  }, [filteredItems]);

  return (
    <SidebarContent>
      <SidebarGroupContent className="px-3 py-2">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search analyses..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 h-9"
              variant="default"
            />
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-120px)]">
          {Object.keys(groupedItems).length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              {searchTerm ? 'No results found' : 'No analyses available'}
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedItems).map(([category, sections]) => (
                <div key={category}>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                    {PALETTE_TAB_LABELS[category] || category}
                  </h3>
                  {Object.entries(sections).map(([sectionName, items], sectionIndex) => {
                    const accordionKey = `${category}-${sectionName}`;
                    return (
                      <Accordion
                        key={accordionKey}
                        type="single"
                        collapsible
                        defaultValue={
                          searchTerm ? 'item-1' : sectionIndex === 0 ? 'item-1' : undefined
                        }
                        className="mb-2"
                      >
                        <AccordionItem value="item-1" className="border-none">
                          <AccordionTrigger className="text-sm font-medium py-2 px-2 hover:no-underline">
                            {sectionName}
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-1">
                              {items.map((item, index) => (
                                <AnalysisItemComponent key={`${item.name}-${index}`} item={item} />
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SidebarGroupContent>
    </SidebarContent>
  );
};
