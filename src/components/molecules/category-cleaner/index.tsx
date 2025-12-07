'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/molecules/dialog';
import { Button } from '@/components/atoms/button';
import { ScrollArea } from '@/components/atoms/scroll-area';
import { Input } from '@/components/atoms/input';
import { Badge } from '@/components/atoms/badge';
import { Loader2 } from 'lucide-react';

export interface CategoryMapping {
  from: string[];
  to: string;
  reason?: string;
}

interface CategoryCleanerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mappings: CategoryMapping[];
  summary?: string;
  onApply: (mappings: CategoryMapping[]) => void;
  isLoading?: boolean;
}

export function CategoryCleaner({
  open,
  onOpenChange,
  mappings,
  summary,
  onApply,
  isLoading = false,
}: CategoryCleanerProps) {
  const [editedMappings, setEditedMappings] = useState<CategoryMapping[]>(mappings);

  React.useEffect(() => {
    setEditedMappings(mappings);
  }, [mappings]);

  const handleMappingChange = (index: number, field: 'to', value: string) => {
    setEditedMappings(prev => {
      const newMappings = [...prev];
      newMappings[index] = { ...newMappings[index], [field]: value };
      return newMappings;
    });
  };

  const handleApply = () => {
    onApply(editedMappings);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Clean Categories</DialogTitle>
          <DialogDescription>
            Review and adjust the proposed category mappings. Similar values will be standardized.
          </DialogDescription>
        </DialogHeader>

        {summary && (
          <div className="bg-muted p-3 rounded-md">
            <p className="text-sm">{summary}</p>
          </div>
        )}

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-4">
            {editedMappings.map((mapping, index) => (
              <div key={index} className="border rounded-md p-4 space-y-2">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="text-sm font-medium mb-2">From:</div>
                    <div className="flex flex-wrap gap-2">
                      {mapping.from.map((value, idx) => (
                        <Badge key={idx} variant="secondary">
                          {value}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-muted-foreground">→</div>
                  <div className="flex-1">
                    <div className="text-sm font-medium mb-2">To:</div>
                    <Input
                      value={mapping.to}
                      onChange={e => handleMappingChange(index, 'to', e.target.value)}
                      placeholder="Standardized value"
                    />
                  </div>
                </div>
                {mapping.reason && (
                  <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                    {mapping.reason}
                  </div>
                )}
              </div>
            ))}

            {editedMappings.length === 0 && !isLoading && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No category cleaning needed.
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={editedMappings.length === 0 || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              'Apply Mapping'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
