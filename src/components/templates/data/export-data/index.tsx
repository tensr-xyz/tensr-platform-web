import { useState } from 'react';
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

const EXPORT_FORMATS = [
  { id: 'csv', label: 'CSV (.csv)', extension: 'csv' },
  { id: 'json', label: 'JSON (.json)', extension: 'json' },
];

export const ExportDialog = ({ children }) => {
  const { state } = useTabs();
  const [selectedFormat, setSelectedFormat] = useState('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');

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
      const defaultPath = `export.${format.extension}`;

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

      await invoke('export_data', {
        request: {
          path: savePath,
          source_path: activeTab.data.filePath, // Add this line
          format: selectedFormat,
        },
      });
    } catch (err) {
      setError(err?.message || (typeof err === 'string' ? err : 'Failed to export data'));
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
