import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/molecules/dialog';
import { Button } from '@/components/atoms/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/molecules/tabs';
import { LuFileSpreadsheet, LuTable, LuSettings } from 'react-icons/lu';
import { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/molecules/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { Checkbox } from '@/components/atoms/checkbox';
import { Label } from '@/components/atoms/label';
import { Input } from '@/components/atoms/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/card';
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from '@/components/atoms/resizable';
import { ColumnSummary } from '@/types/file';

export interface ImportSettings {
  delimiter: string;
  customDelimiter?: string;
  textQualifier: string;
  hasHeaders: boolean;
  trimSpaces: boolean;
  skipEmptyRows: boolean;
  columnTypes: Record<string, string>;
  columnNames: string[];
}

interface ImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  previewData: any[][];
  columnNames: string[];
  detectedDelimiter?: string;
  totalRows: number;
  totalColumns: number;
  columnSummaries: Record<string, ColumnSummary>;
  onImport: (settings: ImportSettings, initialData: any[]) => void;
}

const formatPreviewValue = (value: any, type: string) => {
  if (value === null || value === undefined || value === '') return '';

  switch (type) {
    case 'number':
      // Handle values that might be formatted with currency/unit symbols
      const numericValue = String(value)
        .replace(/[^-\d.]/g, '') // Remove non-numeric chars except decimal and minus
        .trim();
      const num = parseFloat(numericValue);
      return isNaN(num) ? value : num.toLocaleString();

    case 'string':
      return value;

    default:
      return value;
  }
};

const PreviewTable = ({
  columnNames,
  data,
  columnTypes,
}: {
  columnNames: string[];
  data: any[];
  columnTypes: Record<string, string>;
}) => {
  return (
    <div className="overflow-auto border">
      <Table className="w-full border-collapse">
        <TableHeader>
          <TableRow>
            {columnNames.map((name, index) => (
              <TableHead
                key={index}
                className="sticky top-0 h-7 border-b border-r border-border last:border-r-0 bg-background text-left align-middle whitespace-nowrap px-2"
                style={{
                  width: 150,
                  minWidth: 150,
                }}
              >
                <div className="flex items-center h-full">{name}</div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, rowIndex) => (
            <TableRow key={rowIndex} className="border-b border-border hover:bg-muted/50">
              {columnNames.map((col, colIndex) => (
                <TableCell
                  key={colIndex}
                  className="h-7 border-r border-border last:border-r-0 whitespace-nowrap px-2"
                  style={{
                    width: 150,
                    minWidth: 150,
                  }}
                >
                  {formatPreviewValue(row[col], columnTypes[col] || 'string')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

const ImportSettingsForm = ({
  settings,
  onSettingsChange,
  columnNames,
  detectedDelimiter,
}: {
  settings: ImportSettings;
  onSettingsChange: (settings: ImportSettings) => void;
  columnNames: string[];
  detectedDelimiter?: string;
}) => {
  const handleSettingChange = (key: keyof ImportSettings, value: any) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <div className="space-y-6 overflow-auto px-1">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={50}>
          <div className="space-y-6 p-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>
                  Delimiter
                  {detectedDelimiter && (
                    <span className="text-sm text-muted-foreground ml-2">
                      (Detected:{' '}
                      {detectedDelimiter === ','
                        ? 'Comma'
                        : detectedDelimiter === ';'
                          ? 'Semicolon'
                          : detectedDelimiter === '\t'
                            ? 'Tab'
                            : detectedDelimiter}
                      )
                    </span>
                  )}
                </Label>
                <Select
                  value={settings.delimiter}
                  onValueChange={value => handleSettingChange('delimiter', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=";">Semicolon (;)</SelectItem>
                    <SelectItem value=",">Comma (,)</SelectItem>
                    <SelectItem value="\t">Tab</SelectItem>
                    <SelectItem value="custom">Custom...</SelectItem>
                  </SelectContent>
                </Select>
                {settings.delimiter === 'custom' && (
                  <Input
                    placeholder="Enter custom delimiter"
                    value={settings.customDelimiter || ''}
                    onChange={e => handleSettingChange('customDelimiter', e.target.value)}
                    className="mt-2"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>Text Qualifier</Label>
                <Select
                  value={settings.textQualifier}
                  onValueChange={value => handleSettingChange('textQualifier', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="double">Double Quote (")</SelectItem>
                    <SelectItem value="single">Single Quote (')</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasHeaders"
                    checked={settings.hasHeaders}
                    onCheckedChange={checked => handleSettingChange('hasHeaders', checked)}
                  />
                  <Label htmlFor="hasHeaders">First row contains headers</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="trimSpaces"
                    checked={settings.trimSpaces}
                    onCheckedChange={checked => handleSettingChange('trimSpaces', checked)}
                  />
                  <Label htmlFor="trimSpaces">Trim leading/trailing spaces</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="skipEmptyRows"
                    checked={settings.skipEmptyRows}
                    onCheckedChange={checked => handleSettingChange('skipEmptyRows', checked)}
                  />
                  <Label htmlFor="skipEmptyRows">Skip empty rows</Label>
                </div>
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel defaultSize={50}>
          <div className="p-4">
            <Card>
              <CardHeader>
                <CardTitle>Column Settings</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10">
                      <TableRow>
                        <TableHead>Column Name</TableHead>
                        <TableHead>Data Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {columnNames.map((name, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Input
                              value={settings.columnNames[index]}
                              onChange={e => {
                                const newNames = [...settings.columnNames];
                                newNames[index] = e.target.value;
                                handleSettingChange('columnNames', newNames);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={settings.columnTypes[name] || 'string'}
                              onValueChange={value => {
                                handleSettingChange('columnTypes', {
                                  ...settings.columnTypes,
                                  [name]: value,
                                });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="string">Text</SelectItem>
                                <SelectItem value="number">Number</SelectItem>
                                <SelectItem value="date">Date</SelectItem>
                                <SelectItem value="boolean">Boolean</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export const ImportWizard = ({
  isOpen,
  onClose,
  previewData,
  columnNames,
  onImport,
  detectedDelimiter,
  totalRows,
}: ImportWizardProps) => {
  const [settings, setSettings] = useState<ImportSettings>({
    delimiter: detectedDelimiter || ',',
    textQualifier: 'double',
    hasHeaders: true,
    trimSpaces: false,
    skipEmptyRows: true,
    columnTypes: {},
    columnNames: columnNames || [],
  });

  useEffect(() => {
    if (detectedDelimiter) {
      setSettings(prev => ({
        ...prev,
        delimiter: detectedDelimiter,
      }));
    }
  }, [detectedDelimiter]);

  useEffect(() => {
    if (columnNames?.length) {
      setSettings(prev => ({
        ...prev,
        columnNames: columnNames,
        columnTypes: columnNames.reduce(
          (acc, name) => ({
            ...acc,
            [name]: 'string',
          }),
          {}
        ),
      }));
    }
  }, [columnNames]);

  const [processedData, setProcessedData] = useState<any[]>([]);

  useEffect(() => {
    async function processPreviewData() {
      try {
        if (!previewData?.length || !columnNames?.length) {
          setProcessedData([]);
          return;
        }

        // Transform the preview data into row objects
        const rows = Array.from({ length: previewData[0]?.length || 0 }, (_, rowIndex) => {
          return columnNames.reduce(
            (acc, colName, colIndex) => ({
              ...acc,
              [colName]: previewData[colIndex]?.[rowIndex] || '',
            }),
            {}
          );
        });

        setProcessedData(rows);
      } catch (e) {
      }
    }

    processPreviewData();
  }, [previewData, columnNames]);

  const textQualifierMap = {
    double: '"',
    single: "'",
    none: '',
  };

  const handleImport = async (e: React.MouseEvent<HTMLButtonElement>) => {
    try {
      e.preventDefault();
      if (!settings.columnNames.length) {
        throw new Error('No columns defined');
      }

      // We only pass the preview data now since we'll fetch more data as needed
      const transformedData = processedData.map(row => {
        // Apply any transformations based on column types
        const transformedRow = { ...row };
        for (const [colName, type] of Object.entries(settings.columnTypes)) {
          const value = transformedRow[colName];
          if (type === 'number' && value !== '') {
            transformedRow[colName] = parseFloat(value) || 0;
          } else if (type === 'boolean') {
            transformedRow[colName] = Boolean(value);
          }
          // Add more type conversions as needed
        }
        return transformedRow;
      });

      // Create the final import settings with mapped text qualifier
      const importSettings = {
        ...settings,
        textQualifier: textQualifierMap[settings.textQualifier as keyof typeof textQualifierMap],
      };

      onImport(importSettings, transformedData);
      onClose();
    } catch (e) {
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[80vw] h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <LuFileSpreadsheet className="h-5 w-5" />
            Import Data
            {totalRows > 0 && (
              <span className="text-sm text-muted-foreground ml-2">
                ({totalRows.toLocaleString()} rows)
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="preview" className="flex-1 flex flex-col min-h-0">
          <div className="bg-foreground">
            <TabsList>
              <TabsTrigger value="preview" className="flex items-center gap-2">
                <LuTable className="h-4 w-4" />
                Data Preview
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <LuSettings className="h-4 w-4" />
                Import Settings
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden p-6">
            <TabsContent value="preview" className="h-full mt-0">
              <PreviewTable
                columnNames={columnNames}
                columnTypes={settings.columnTypes}
                data={processedData}
              />
            </TabsContent>
            <TabsContent value="settings" className="h-full mt-0">
              <ImportSettingsForm
                settings={settings}
                onSettingsChange={setSettings}
                columnNames={columnNames}
                detectedDelimiter={detectedDelimiter}
              />
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="p-6 pt-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleImport}>Import Data</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
