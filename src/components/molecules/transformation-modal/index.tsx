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
import { Checkbox } from '@/components/atoms/checkbox';
import { ScrollArea } from '@/components/atoms/scroll-area';
import { Badge } from '@/components/atoms/badge';
import { Loader2 } from 'lucide-react';

export interface Transformation {
  type: string;
  name: string;
  description: string;
  formula: string;
  reason: string;
}

interface TransformationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transformations: Transformation[];
  onApply: (selectedTransformations: Transformation[]) => void;
  isLoading?: boolean;
}

export function TransformationModal({
  open,
  onOpenChange,
  transformations,
  onApply,
  isLoading = false,
}: TransformationModalProps) {
  const [selectedTransformations, setSelectedTransformations] = useState<Set<number>>(new Set());

  const handleToggleTransformation = (index: number) => {
    setSelectedTransformations(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleApply = () => {
    const transformationsToApply = transformations.filter((_, index) => selectedTransformations.has(index));
    onApply(transformationsToApply);
    setSelectedTransformations(new Set());
  };

  const handleSelectAll = () => {
    if (selectedTransformations.size === transformations.length) {
      setSelectedTransformations(new Set());
    } else {
      setSelectedTransformations(new Set(transformations.map((_, index) => index)));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Suggested Transformations</DialogTitle>
          <DialogDescription>
            Review and apply suggested transformations for this column.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Available Transformations ({transformations.length})</h4>
              {transformations.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                  {selectedTransformations.size === transformations.length ? 'Deselect All' : 'Select All'}
                </Button>
              )}
            </div>

            {transformations.map((transformation, index) => (
              <div key={index} className="border rounded-md p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selectedTransformations.has(index)}
                    onCheckedChange={() => handleToggleTransformation(index)}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{transformation.name}</span>
                        <Badge variant="outline">{transformation.type}</Badge>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground">{transformation.description}</p>

                    <div className="text-sm">
                      <span className="text-muted-foreground">Formula: </span>
                      <code className="bg-muted px-2 py-0.5 rounded text-xs">{transformation.formula}</code>
                    </div>

                    {transformation.reason && (
                      <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                        {transformation.reason}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {transformations.length === 0 && !isLoading && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No transformations suggested for this column.
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={selectedTransformations.size === 0 || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              `Create ${selectedTransformations.size} Column${selectedTransformations.size !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}





