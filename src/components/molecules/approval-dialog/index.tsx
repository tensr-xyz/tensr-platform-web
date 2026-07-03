import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/molecules/dialog';
import { Button } from '@/components/atoms/button';
import { Badge } from '@/components/atoms/badge';
import { Clock, Play, X, CheckCircle } from 'lucide-react';

interface PendingCommand {
  tool: string;
  params: any;
  description: string;
  variables?: string[];
  estimatedTime?: string;
}

interface ApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  command: PendingCommand | null;
  onApprove: () => void;
  onReject: () => void;
  isExecuting?: boolean;
}

export function ApprovalDialog({
  open,
  onOpenChange,
  command,
  onApprove,
  onReject,
  isExecuting = false,
}: ApprovalDialogProps) {
  if (!command) return null;

  const getToolDisplayName = (tool: string) => {
    const toolNames: Record<string, string> = {
      run_analysis: 'Run analysis',
      descriptive_stats: 'Descriptive Statistics',
      t_test: 'T-Test',
      correlation: 'Correlation Analysis',
      regression: 'Linear Regression',
      transform_data: 'Data Transformation',
      edit_table: 'Edit Table',
      update_cells: 'Update Cells',
      add_rows: 'Add Rows',
      delete_rows: 'Delete Rows',
      update_column: 'Update Column',
    };
    return toolNames[tool] || tool;
  };

  const getToolIcon = (tool: string) => {
    return <CheckCircle className="h-4 w-4" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getToolIcon(command.tool)}
            {getToolDisplayName(command.tool)}
          </DialogTitle>
          <DialogDescription>{command.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Variables */}
          {(command.variables?.length ?? 0) > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Variables to analyze:</h4>
              <div className="flex flex-wrap gap-1">
                {(command.variables ?? []).map((variable, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {variable}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Table edits preview */}
          {command.tool === 'edit_table' && command.params?.edits && (
            <div>
              <h4 className="text-sm font-medium mb-2">Proposed Changes:</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {(command.params.edits || []).slice(0, 10).map((edit: any, idx: number) => (
                  <div key={idx} className="bg-muted p-2 rounded-md text-xs">
                    <div className="font-medium">{edit.type || 'Edit'}:</div>
                    {edit.rowIndex !== undefined && <div>Row: {edit.rowIndex}</div>}
                    {edit.columnId && <div>Column: {edit.columnId}</div>}
                    {edit.oldValue !== undefined && <div>From: {String(edit.oldValue)}</div>}
                    {edit.newValue !== undefined && <div>To: {String(edit.newValue)}</div>}
                  </div>
                ))}
                {(command.params.edits || []).length > 10 && (
                  <div className="text-xs text-muted-foreground">
                    ... and {(command.params.edits || []).length - 10} more changes
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Parameters */}
          {command.params && Object.keys(command.params).length > 0 && !command.params.edits && (
            <div>
              <h4 className="text-sm font-medium mb-2">Parameters:</h4>
              <div className="bg-muted p-3 rounded-md text-sm">
                <pre className="whitespace-pre-wrap">{JSON.stringify(command.params, null, 2)}</pre>
              </div>
            </div>
          )}

          {/* Estimated time */}
          {command.estimatedTime && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Estimated time: {command.estimatedTime}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onReject}
            disabled={isExecuting}
            className="flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={onApprove} disabled={isExecuting} className="flex items-center gap-2">
            <Play className="h-4 w-4" />
            {isExecuting ? 'Executing...' : 'Execute'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
