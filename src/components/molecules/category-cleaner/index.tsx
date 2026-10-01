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
  suggestions?: CategoryMapping[];
  /** Distinct labels that a model pass would see. Shown before any request. */
  modelLabels?: string[];
  /** Shown only after the user asks for model suggestions. */
  modelNotice?: string;
  onSuggest?: () => void;
  summary?: string;
  onApply: (mappings: CategoryMapping[]) => void;
  isLoading?: boolean;
}

export function CategoryCleaner({
  open,
  onOpenChange,
  mappings,
  suggestions = [],
  modelLabels = [],
  modelNotice,
  onSuggest,
  summary,
  onApply,
  isLoading = false,
}: CategoryCleanerProps) {
  const [editedMappings, setEditedMappings] = useState<CategoryMapping[]>(mappings);
  const [pendingSuggestions, setPendingSuggestions] = useState<CategoryMapping[]>(suggestions);

  React.useEffect(() => {
    setEditedMappings(mappings);
  }, [mappings]);

  React.useEffect(() => {
    setPendingSuggestions(suggestions);
  }, [suggestions]);

  const addSuggestion = (index: number) => {
    const suggestion = pendingSuggestions[index];
    if (!suggestion) return;
    setEditedMappings(prev => {
      const overlap = prev.findIndex(mapping =>
        mapping.from.some(value => suggestion.from.includes(value))
      );
      if (overlap === -1) return [...prev, suggestion];
      const current = prev[overlap];
      const from = [...current.from];
      for (const value of suggestion.from) {
        if (!from.includes(value)) from.push(value);
      }
      const next = [...prev];
      next[overlap] = {
        ...current,
        from,
        to: suggestion.to || current.to,
        reason: suggestion.reason || current.reason,
      };
      return next;
    });
    setPendingSuggestions(prev => prev.filter((_, itemIndex) => itemIndex !== index));
  };

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
      <DialogContent
        className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden"
        data-testid="clean-categories-dialog"
      >
        <DialogHeader>
          <DialogTitle>Clean Categories</DialogTitle>
          <DialogDescription>
            Trim and case matches are listed to edit. Other matches are suggestions and are not
            applied until you add them.
          </DialogDescription>
        </DialogHeader>

        {modelNotice && (
          <div
            className="bg-muted p-3 rounded-md text-sm"
            data-testid="clean-categories-model-notice"
          >
            {modelNotice}
          </div>
        )}

        {summary && (
          <div className="bg-muted p-3 rounded-md">
            <p className="text-sm">{summary}</p>
          </div>
        )}

        <ScrollArea className="min-h-0 flex-1 pr-4">
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

            {editedMappings.length === 0 && pendingSuggestions.length === 0 && !isLoading && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No category cleaning needed.
              </div>
            )}

            {modelLabels.length > 0 && (
              <div
                className="border rounded-md p-4 space-y-2"
                data-testid="clean-categories-model-labels"
              >
                <div className="text-sm font-medium">Suggest with AI</div>
                <p className="text-xs text-muted-foreground">
                  Only these distinct labels are sent. Respondent rows are not sent. Nothing is
                  applied until you add a suggestion.
                </p>
                <div className="flex flex-wrap gap-2">
                  {modelLabels.map(label => (
                    <Badge key={label} variant="outline">
                      {label}
                    </Badge>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid="clean-categories-suggest-ai"
                  onClick={onSuggest}
                  disabled={!onSuggest || isLoading}
                >
                  Suggest with AI
                </Button>
              </div>
            )}

            {pendingSuggestions.length > 0 && (
              <div className="space-y-3" data-testid="clean-categories-suggestions">
                <div className="text-sm font-medium">Suggestions</div>
                <p className="text-xs text-muted-foreground">
                  These are not applied until you add them.
                </p>
                {pendingSuggestions.map((suggestion, index) => (
                  <div
                    key={`${suggestion.to}-${index}`}
                    className="border rounded-md p-4 space-y-2"
                  >
                    <div className="flex flex-wrap gap-2">
                      {suggestion.from.map(value => (
                        <Badge key={value} variant="outline">
                          {value}
                        </Badge>
                      ))}
                      <span className="text-muted-foreground">→</span>
                      <Badge>{suggestion.to}</Badge>
                    </div>
                    {suggestion.reason && (
                      <div className="text-xs text-muted-foreground">{suggestion.reason}</div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-testid="clean-categories-suggestion-add"
                      onClick={() => addSuggestion(index)}
                    >
                      Add suggestion
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            data-testid="clean-categories-apply"
            onClick={handleApply}
            disabled={editedMappings.length === 0 || isLoading}
          >
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
