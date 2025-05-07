import { ReactNode, useState } from 'react';
import { useTabs } from '@/contexts/tabs-context';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/molecules/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { Button } from '@/components/atoms/button';
import { Alert, AlertDescription } from '@/components/atoms/alert';

// Define types for the export formats
interface ExportFormat {
  id: string;
  label: string;
  extension: string;
}

// Define interface for save dialog options
interface SaveDialogOptions {
  defaultPath: string;
  filters: {
    name: string;
    extensions: string[];
  }[];
}

// Define the interface for the component props
interface ExportDialogProps {
  children: ReactNode;
}

// Define the interface for the export request
interface ExportRequest {
  path: string;
  source_path: string;
  format: string;
}

const EXPORT_FORMATS: ExportFormat[] = [
  { id: 'csv', label: 'CSV (.csv)', extension: 'csv' },
  { id: 'json', label: 'JSON (.json)', extension: 'json' },
];

export const ExportDialog = ({ children }: ExportDialogProps) => {
  const { state } = useTabs();
  const [selectedFormat, setSelectedFormat] = useState('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string>('');

  const activeTab = state.tabs.find(tab => tab.id === state.activeTabId);

  const handleExport = async () => {
    if (!activeTab?.data?.filePath) {
      setError('No active file to export');
      return;
    }

    try {
      setIsExporting(true);
      setError('');

      const format = EXPORT_FORMATS.find(f => f.id === selectedFormat);

      if (!format) {
        setError('Invalid export format selected');
        return;
      }

      const defaultPath = `export.${format.extension}`;

      // Define a mock function for 'save' until the actual implementation is added
      // This would typically be imported from a file dialog library
      const save = async (options: SaveDialogOptions): Promise<string | null> => {
        // Mock implementation - in real code, this would show a file save dialog
        console.log('Save dialog with options:', options);
        return `C:/path/to/exports/${options.defaultPath}`;
        // Return null to simulate user cancellation:
        // return null;
      };

      const savePath = await save({
        defaultPath,
        filters: [
          {
            name: format.label,
            extensions: [format.extension],
          },
        ],
      });

      if (!savePath) {
        return; // User cancelled
      }

      // Mock implementation of 'invoke' until the actual API call is implemented
      const invoke = async (method: string, params: { request: ExportRequest }): Promise<void> => {
        // In real code, this would be an API call or electron invoke
        console.log(`Invoking ${method} with:`, params);
        // Simulate a delay
        await new Promise(resolve => setTimeout(resolve, 500));
        return;
      };

      await invoke('export_data', {
        request: {
          path: savePath,
          source_path: activeTab.data.filePath,
          format: selectedFormat,
        },
      });
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else if (typeof err === 'string') {
        setError(err);
      } else {
        setError('Failed to export data');
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog>
      {children}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Data</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Export Format</label>
            <Select value={selectedFormat} onValueChange={setSelectedFormat}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                {EXPORT_FORMATS.map(format => (
                  <SelectItem key={format.id} value={format.id}>
                    {format.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleExport} disabled={isExporting || !activeTab}>
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
