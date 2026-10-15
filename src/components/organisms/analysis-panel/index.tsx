import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/atoms/empty';
import { Button } from '@/components/atoms/button';
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
      <Button
        size="compact"
        type="button"
        variant="ghost"
        className="h-auto w-full justify-start rounded-sm px-2 py-1 text-left text-sm"
      >
        {item.name}
      </Button>
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
            <Empty className="min-h-0 border-0 p-4 md:p-4">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Search />
                </EmptyMedia>
                <EmptyTitle className="text-sm">
                  {searchTerm ? 'No matching analyses' : 'No analyses available'}
                </EmptyTitle>
                <EmptyDescription className="text-xs">
                  {searchTerm
                    ? 'Try a different search.'
                    : 'Analyses for this dataset will show up here.'}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
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
