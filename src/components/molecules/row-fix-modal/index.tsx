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
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export interface RowFixIssue {
  columnId: string;
  currentValue: string;
  issue: string;
  suggestedValue: string;
  confidence: number;
  reason: string;
}

interface RowFixModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issues: RowFixIssue[];
  summary?: string;
  onApply: (selectedFixes: RowFixIssue[]) => void;
  isLoading?: boolean;
}

export function RowFixModal({
  open,
  onOpenChange,
  issues,
  summary,
  onApply,
  isLoading = false,
}: RowFixModalProps) {
  const [selectedFixes, setSelectedFixes] = useState<Set<string>>(new Set());

  const handleToggleFix = (columnId: string) => {
    setSelectedFixes(prev => {
      const next = new Set(prev);
      if (next.has(columnId)) {
        next.delete(columnId);
      } else {
        next.add(columnId);
      }
      return next;
    });
  };

  const handleApply = () => {
    const fixesToApply = issues.filter(issue => selectedFixes.has(issue.columnId));
    onApply(fixesToApply);
  };

  const handleSelectAll = () => {
    if (selectedFixes.size === issues.length) {
      setSelectedFixes(new Set());
    } else {
      setSelectedFixes(new Set(issues.map(issue => issue.columnId)));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Fix Row Issues</DialogTitle>
          <DialogDescription>
            Review and apply suggested fixes for data quality issues in this row.
          </DialogDescription>
        </DialogHeader>

        {summary && (
          <div className="bg-muted p-3 rounded-md">
            <p className="text-sm">{summary}</p>
          </div>
        )}

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Issues Found ({issues.length})</h4>
              <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                {selectedFixes.size === issues.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            {issues.map((issue, index) => (
              <div
                key={`${issue.columnId}-${index}`}
                className="border rounded-md p-4 space-y-2"
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selectedFixes.has(issue.columnId)}
                    onCheckedChange={() => handleToggleFix(issue.columnId)}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{issue.columnId}</span>
                        <Badge variant={issue.confidence > 0.8 ? 'default' : 'secondary'}>
                          {Math.round(issue.confidence * 100)}% confidence
                        </Badge>
                      </div>
                    </div>

                    <div className="text-sm text-muted-foreground">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>{issue.issue}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Current:</span>
                      <code className="bg-muted px-2 py-0.5 rounded">
                        {String(issue.currentValue || '(empty)')}
                      </code>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-muted-foreground">Suggested:</span>
                      <code className="bg-green-100 dark:bg-green-900 px-2 py-0.5 rounded">
                        {issue.suggestedValue}
                      </code>
                    </div>

                    {issue.reason && (
                      <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                        {issue.reason}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {issues.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mb-2" />
                <p className="text-sm text-muted-foreground">No issues found in this row.</p>
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
            disabled={selectedFixes.size === 0 || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Applying...
              </>
            ) : (
              `Apply ${selectedFixes.size} Fix${selectedFixes.size !== 1 ? 'es' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}





