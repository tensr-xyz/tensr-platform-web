import { useTabsStore } from '@/stores/tabs-store';
import { ReactNode, useMemo, useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/molecules/dialog';
import { Button } from '@/components/atoms/button';
import {
  Loader2 as Loader,
  Download,
  Info,
  FileText,
  Image,
  FileSpreadsheet,
  Copy,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/atoms/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/molecules/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/card';
import useAuth from '@/hooks/api/use-auth';
import { ViewType } from '@/contexts/project-context/types';
import MarkdownViewer from '@/components/organisms/markdown-viewer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/molecules/dropdown';
import { exportTable, copyTableToClipboard } from '@/utils/table-export';
import { toast } from '@/hooks/ui/use-toast';

const API_BASE_URL = process.env.NEXT_PUBLIC_FARGATE_API_URL;

interface AnovaProps {
  children: ReactNode;
}

interface Variable {
  name: string;
  type: string;
}

interface AnovaRequest {
  groups: Record<string, number[]>;
}

interface GroupDescriptives {
  group_name: string;
  n: number;
  mean: number;
  std_dev: number;
  std_error: number;
  confidence_interval_95: [number, number];
  min: number;
  max: number;
}

interface AnovaResult {
  f_statistic: number;
  p_value: number;
  df_between: number;
  df_within: number;
  sum_squares_between: number;
  sum_squares_within: number;
  mean_square_between: number;
  mean_square_within: number;
  effect_size: number;
  group_descriptives: GroupDescriptives[];
  total_n: number;
  grand_mean: number;
  interpretation: string;
  report_content: string;
  report_timestamp: string;
}

interface AnovaResponse {
  results: AnovaResult;
}

export const OneWayAnova = ({ children }: AnovaProps) => {
  const { tabs, activeTabId, addTab } = useTabsStore();
  const [groupingVariable, setGroupingVariable] = useState<string>('');
  const [dependentVariable, setDependentVariable] = useState<string>('');
  const [results, setResults] = useState<AnovaResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('setup');
  const { tokens } = useAuth();

  // Refs for table export
  const anovaTableRef = useRef<HTMLTableElement>(null);
  const groupStatsTableRef = useRef<HTMLTableElement>(null);

  const token = tokens?.accessToken;

  const activeDataTab = useMemo(
    () => tabs.find(tab => tab.id === activeTabId),
    [tabs, activeTabId]
  );

  const variables = useMemo(() => {
    if (!activeDataTab?.data?.initialData?.[0]) return [];

    const columnNames = Object.keys(activeDataTab.data.initialData[0]).filter(key => key !== 'id');

    return columnNames.map(colName => {
      const sampleValues = activeDataTab.data.initialData
        .slice(0, 5)
        .map((row: { [x: string]: any }) => row[colName])
        .filter((val: string | null) => val != null && val !== '');

      const numericValues = sampleValues.map((val: { toString: () => string }) =>
        parseFloat(val.toString())
      );
      const isNumeric = numericValues.every((val: number) => !isNaN(val));

      return {
        name: colName,
        type: isNumeric ? 'number' : 'string',
      };
    });
  }, [activeDataTab?.data?.initialData]);

  const numericVariables = useMemo(() => {
    return variables.filter(v => v.type === 'number');
  }, [variables]);

  const categoricalVariables = useMemo(() => {
    return variables.filter(v => v.type === 'string');
  }, [variables]);

  const prepareData = () => {
    if (!activeDataTab?.data?.initialData || !groupingVariable || !dependentVariable) return {};

    const groupedData: Record<string, number[]> = {};
    const dataDiagnostics: Record<string, { total: number; valid: number; invalid: number }> = {};

    activeDataTab.data.initialData.forEach((row: any) => {
      const group = row[groupingVariable]?.toString()?.trim();
      const rawValue = row[dependentVariable];

      // Initialize diagnostics for this group
      if (group && !dataDiagnostics[group]) {
        dataDiagnostics[group] = { total: 0, valid: 0, invalid: 0 };
      }

      if (group) {
        dataDiagnostics[group].total++;

        // Try to parse the value
        let value: number;
        if (typeof rawValue === 'number') {
          value = rawValue;
        } else if (rawValue === null || rawValue === undefined || rawValue === '') {
          value = NaN;
        } else {
          // Remove any whitespace and try parsing
          const cleanedValue = String(rawValue).trim();
          value = parseFloat(cleanedValue);
        }

        if (!isNaN(value) && isFinite(value)) {
          if (!groupedData[group]) {
            groupedData[group] = [];
          }
          groupedData[group].push(value);
          dataDiagnostics[group].valid++;
        } else {
          dataDiagnostics[group].invalid++;
        }
      }
    });

    // Log diagnostics for debugging
    console.log('ANOVA Data Diagnostics:', dataDiagnostics);
    console.log(
      'Grouped Data Summary:',
      Object.entries(groupedData).map(([group, values]) => ({
        group,
        count: values.length,
        values: values.slice(0, 5), // Show first 5 values
      }))
    );

    return groupedData;
  };

  const validateData = (groupedData: Record<string, number[]>) => {
    if (Object.keys(groupedData).length < 2) {
      return 'ANOVA requires at least two groups.';
    }

    for (const [group, values] of Object.entries(groupedData)) {
      if (values.length < 2) {
        // Provide more helpful error message with diagnostic info
        const totalRows = activeDataTab?.data?.initialData?.length || 0;
        const groupRows =
          activeDataTab?.data?.initialData?.filter(
            (row: any) => row[groupingVariable]?.toString()?.trim() === group
          ).length || 0;

        return `Group '${group}' has only ${values.length} valid observation(s) out of ${groupRows} total row(s) for this group. ANOVA requires at least 2 valid numeric values per group. This usually means some age values are missing, empty, or non-numeric for this player.`;
      }
    }

    return null;
  };

  const calculateAnova = async () => {
    try {
      setError(null);
      setIsLoading(true);

      const groupedData = prepareData();
      const validationError = validateData(groupedData);
      if (validationError) {
        setError(validationError);
        setIsLoading(false);
        return;
      }

      const request: AnovaRequest = {
        groups: groupedData,
      };

      const response = await fetch(`${API_BASE_URL}/api/statistics/calculate-anova`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to calculate ANOVA');
      }

      const result: AnovaResponse = await response.json();
      setResults(result.results);
      setActiveTab('results'); // Switch to results tab after calculation
    } catch (error) {
      console.error('Error calculating ANOVA:', error);
      setError(error instanceof Error ? error.message : 'Failed to calculate ANOVA');
    } finally {
      setIsLoading(false);
    }
  };

  const createReportTab = () => {
    if (!results?.report_content) return;

    // Generate a unique ID for the tab
    const tabId = `anova-report-${Date.now()}`;

    const reportTab = {
      name: `ANOVA Report - ${dependentVariable} by ${groupingVariable}`,
      type: ViewType.MARKDOWN,
      content: results.report_content, // This is required by your Tab interface
      path: `anova-report-${Date.now()}.md`, // Optional path for markdown tabs
      isDirty: false,
    };

    // Add the tab - the store will generate an ID and set it as active automatically
    addTab(reportTab);

    // Note: The store automatically sets the new tab as active when adding,
    // so we don't need to call setActiveTab separately
  };

  const downloadReport = () => {
    if (!results?.report_content) return;

    const blob = new Blob([results.report_content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `anova_report_${results.report_timestamp.replace(/[:\s]/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportTable = async (
    tableRef: React.RefObject<HTMLTableElement>,
    tableName: string,
    format: 'png' | 'svg' | 'csv' | 'text' | 'html'
  ) => {
    if (!tableRef.current) {
      toast({
        title: 'Export failed',
        description: 'Table not found',
        variant: 'destructive',
      });
      return;
    }

    try {
      const filename = `anova_${tableName}_${dependentVariable}_by_${groupingVariable}`.replace(
        /[^a-z0-9]/gi,
        '_'
      );

      if (format === 'png') {
        await exportTable(tableRef.current, { filename, format: 'png' });
      } else {
        exportTable(tableRef.current, { filename, format });
      }

      toast({
        title: 'Export successful',
        description: `Table exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Failed to export table',
        variant: 'destructive',
      });
    }
  };

  const handleCopyTable = async (tableRef: React.RefObject<HTMLTableElement>) => {
    if (!tableRef.current) {
      toast({
        title: 'Copy failed',
        description: 'Table not found',
        variant: 'destructive',
      });
      return;
    }

    try {
      await copyTableToClipboard(tableRef.current);
      toast({
        title: 'Copied to clipboard',
        description: 'Table copied. You can paste it into Word, Excel, or other applications.',
      });
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: 'Failed to copy table to clipboard',
        variant: 'destructive',
      });
    }
  };

  const isSignificant = results && results.p_value < 0.05;
  const effectSizeInterpretation = (eta: number) => {
    if (eta < 0.01) return 'very small';
    if (eta < 0.06) return 'small';
    if (eta < 0.14) return 'medium';
    return 'large';
  };

  return (
    <Dialog>
      {children}
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>One-Way ANOVA Analysis</DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex flex-col flex-1 min-h-0"
        >
          <TabsList className="flex w-full h-9 items-center justify-center bg-muted p-1 text-muted-foreground mx-6">
            <TabsTrigger value="setup" isClosable={false} className="flex-1">
              Setup
            </TabsTrigger>
            <TabsTrigger value="results" disabled={!results} isClosable={false} className="flex-1">
              Results
            </TabsTrigger>
            <TabsTrigger value="report" disabled={!results} isClosable={false} className="flex-1">
              Report
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto py-4 px-6 min-h-0">
            <TabsContent value="setup" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Grouping Variable</CardTitle>
                    <CardDescription>Select the categorical variable to group by</CardDescription>
                  </CardHeader>
                  <CardContent className="max-h-60 overflow-y-auto">
                    {categoricalVariables.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">No categorical variables found</p>
                    ) : (
                      categoricalVariables.map(variable => (
                        <div
                          key={variable.name}
                          onClick={() => setGroupingVariable(variable.name)}
                          className={`p-2 cursor-pointer rounded transition-colors ${
                            groupingVariable === variable.name
                              ? 'bg-primary/20 border-primary'
                              : 'hover:bg-accent'
                          }`}
                        >
                          {variable.name}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Dependent Variable</CardTitle>
                    <CardDescription>Select the numeric variable to analyze</CardDescription>
                  </CardHeader>
                  <CardContent className="max-h-60 overflow-y-auto">
                    {numericVariables.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">No numeric variables found</p>
                    ) : (
                      numericVariables.map(variable => (
                        <div
                          key={variable.name}
                          onClick={() => setDependentVariable(variable.name)}
                          className={`p-2 cursor-pointer rounded transition-colors ${
                            dependentVariable === variable.name
                              ? 'bg-primary/20 border-primary'
                              : 'hover:bg-accent'
                          }`}
                        >
                          {variable.name}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Data Preview */}
              {groupingVariable && dependentVariable && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Data Preview</CardTitle>
                    <CardDescription>
                      Preview of how your data will be grouped (shows first 10 groups)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const previewData = prepareData();
                      const previewEntries = Object.entries(previewData).slice(0, 10);
                      const totalGroups = Object.keys(previewData).length;
                      const totalObservations = Object.values(previewData).reduce(
                        (sum, arr) => sum + arr.length,
                        0
                      );
                      const groupsWithEnoughData = Object.values(previewData).filter(
                        arr => arr.length >= 2
                      ).length;
                      const avgObservationsPerGroup = totalObservations / totalGroups;

                      if (previewEntries.length === 0) {
                        return (
                          <Alert>
                            <AlertDescription>
                              No valid data found. Please check that:
                              <ul className="list-disc list-inside mt-2 space-y-1">
                                <li>Your grouping variable ({groupingVariable}) has values</li>
                                <li>
                                  Your dependent variable ({dependentVariable}) contains numeric
                                  values
                                </li>
                                <li>
                                  There are no missing or non-numeric values in the dependent
                                  variable
                                </li>
                              </ul>
                            </AlertDescription>
                          </Alert>
                        );
                      }

                      // Check if this is a data structure issue
                      const isDataStructureIssue =
                        avgObservationsPerGroup < 1.5 && totalGroups > totalObservations * 0.8;

                      return (
                        <div className="space-y-3">
                          {isDataStructureIssue && (
                            <Alert variant="destructive">
                              <AlertDescription>
                                <strong>Data Structure Issue Detected:</strong>
                                <p className="mt-2">
                                  You have {totalGroups} groups but only {totalObservations} total
                                  observations (average of {avgObservationsPerGroup.toFixed(2)} per
                                  group). Only {groupsWithEnoughData} groups have 2+ observations.
                                </p>
                                <p className="mt-2 font-semibold">
                                  ANOVA requires multiple observations per group to calculate
                                  variance within groups.
                                </p>
                                <p className="mt-2">
                                  <strong>Your data appears to have only 1 row per player.</strong>{' '}
                                  For ANOVA, you need:
                                </p>
                                <ul className="list-disc list-inside mt-2 space-y-1">
                                  <li>
                                    Multiple rows per player (e.g., multiple seasons, games, or
                                    measurements)
                                  </li>
                                  <li>
                                    Or use a different analysis like{' '}
                                    <strong>Descriptive Statistics</strong> or{' '}
                                    <strong>Independent Samples T-Test</strong> if comparing just 2
                                    groups
                                  </li>
                                </ul>
                              </AlertDescription>
                            </Alert>
                          )}

                          <div className="text-sm text-muted-foreground mb-2">
                            Total groups: {totalGroups} | Total valid observations:{' '}
                            {totalObservations} | Groups with 2+ observations:{' '}
                            {groupsWithEnoughData} | Avg per group:{' '}
                            {avgObservationsPerGroup.toFixed(2)}
                          </div>
                          <div className="max-h-60 overflow-y-auto border rounded-md">
                            <table className="w-full text-sm">
                              <thead className="sticky top-0 bg-background border-b">
                                <tr>
                                  <th className="text-left p-2">Group ({groupingVariable})</th>
                                  <th className="text-right p-2">Valid Observations</th>
                                  <th className="text-right p-2">Mean</th>
                                  <th className="text-right p-2">Sample Values</th>
                                </tr>
                              </thead>
                              <tbody>
                                {previewEntries.map(([group, values]) => {
                                  const mean = values.reduce((a, b) => a + b, 0) / values.length;
                                  const sampleValues = values
                                    .slice(0, 3)
                                    .map(v => v.toFixed(1))
                                    .join(', ');
                                  const isWarning = values.length < 2;

                                  return (
                                    <tr
                                      key={group}
                                      className={`border-b ${isWarning ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}`}
                                    >
                                      <td
                                        className={`p-2 ${isWarning ? 'font-semibold text-yellow-700 dark:text-yellow-400' : ''}`}
                                      >
                                        {group}
                                        {isWarning && (
                                          <span className="ml-2 text-xs">⚠ Needs 2+ values</span>
                                        )}
                                      </td>
                                      <td className="text-right p-2">{values.length}</td>
                                      <td className="text-right p-2">{mean.toFixed(2)}</td>
                                      <td className="text-right p-2 text-xs text-muted-foreground">
                                        {sampleValues}
                                        {values.length > 3 && '...'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          {Object.keys(previewData).length > 10 && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Showing first 10 of {Object.keys(previewData).length} groups
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="results" className="space-y-4">
              {results && (
                <>
                  {/* Main Results Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        ANOVA Results
                      </CardTitle>
                      <CardDescription>
                        Analysis of {dependentVariable} by {groupingVariable}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="text-center p-3 bg-accent rounded-lg">
                          <p className="text-sm font-medium text-muted-foreground">F-statistic</p>
                          <p className="text-2xl font-bold">{results.f_statistic.toFixed(3)}</p>
                        </div>
                        <div className="text-center p-3 bg-accent rounded-lg">
                          <p className="text-sm font-medium text-muted-foreground">p-value</p>
                          <p
                            className={`text-2xl font-bold ${isSignificant ? 'text-green-600' : 'text-red-600'}`}
                          >
                            {results.p_value < 0.001 ? '< 0.001' : results.p_value.toFixed(3)}
                          </p>
                        </div>
                        <div className="text-center p-3 bg-accent rounded-lg">
                          <p className="text-sm font-medium text-muted-foreground">
                            Effect Size (η²)
                          </p>
                          <p className="text-2xl font-bold">{results.effect_size.toFixed(3)}</p>
                          <p className="text-xs text-muted-foreground">
                            ({effectSizeInterpretation(results.effect_size)})
                          </p>
                        </div>
                        <div className="text-center p-3 bg-accent rounded-lg">
                          <p className="text-sm font-medium text-muted-foreground">Total N</p>
                          <p className="text-2xl font-bold">{results.total_n}</p>
                        </div>
                      </div>

                      {/* Interpretation */}
                      <Alert
                        className={
                          isSignificant
                            ? 'border-green-200 bg-green-50'
                            : 'border-blue-200 bg-blue-50'
                        }
                      >
                        <AlertDescription className="font-medium">
                          {results.interpretation}
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                  </Card>

                  {/* Group Descriptives */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Group Statistics</CardTitle>
                          <CardDescription>Descriptive statistics for each group</CardDescription>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Download className="h-4 w-4 mr-2" />
                              Export Table
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                handleExportTable(groupStatsTableRef, 'group_stats', 'png')
                              }
                            >
                              <Image className="h-4 w-4 mr-2" />
                              Export as PNG Image
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleExportTable(groupStatsTableRef, 'group_stats', 'svg')
                              }
                            >
                              <Image className="h-4 w-4 mr-2" />
                              Export as SVG
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleExportTable(groupStatsTableRef, 'group_stats', 'csv')
                              }
                            >
                              <FileSpreadsheet className="h-4 w-4 mr-2" />
                              Export as CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleExportTable(groupStatsTableRef, 'group_stats', 'text')
                              }
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              Export as Text (for Word)
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleExportTable(groupStatsTableRef, 'group_stats', 'html')
                              }
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              Export as HTML
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCopyTable(groupStatsTableRef)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy to Clipboard
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table ref={groupStatsTableRef} className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2">Group</th>
                              <th className="text-right p-2">N</th>
                              <th className="text-right p-2">Mean</th>
                              <th className="text-right p-2">Std Dev</th>
                              <th className="text-right p-2">Std Error</th>
                              <th className="text-right p-2">95% CI</th>
                              <th className="text-right p-2">Min</th>
                              <th className="text-right p-2">Max</th>
                            </tr>
                          </thead>
                          <tbody>
                            {results.group_descriptives.map((group, index) => (
                              <tr key={index} className="border-b">
                                <td className="font-medium p-2">{group.group_name}</td>
                                <td className="text-right p-2">{group.n}</td>
                                <td className="text-right p-2">{group.mean.toFixed(3)}</td>
                                <td className="text-right p-2">{group.std_dev.toFixed(3)}</td>
                                <td className="text-right p-2">{group.std_error.toFixed(3)}</td>
                                <td className="text-right p-2">
                                  [{group.confidence_interval_95[0].toFixed(3)},{' '}
                                  {group.confidence_interval_95[1].toFixed(3)}]
                                </td>
                                <td className="text-right p-2">{group.min.toFixed(3)}</td>
                                <td className="text-right p-2">{group.max.toFixed(3)}</td>
                              </tr>
                            ))}
                            <tr className="border-b-2 border-primary bg-accent/50">
                              <td className="font-bold p-2">Overall</td>
                              <td className="text-right font-bold p-2">{results.total_n}</td>
                              <td className="text-right font-bold p-2">
                                {results.grand_mean.toFixed(3)}
                              </td>
                              <td className="text-right p-2">—</td>
                              <td className="text-right p-2">—</td>
                              <td className="text-right p-2">—</td>
                              <td className="text-right p-2">—</td>
                              <td className="text-right p-2">—</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* ANOVA Table */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>ANOVA Table</CardTitle>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Download className="h-4 w-4 mr-2" />
                              Export Table
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleExportTable(anovaTableRef, 'anova_table', 'png')}
                            >
                              <Image className="h-4 w-4 mr-2" />
                              Export as PNG Image
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleExportTable(anovaTableRef, 'anova_table', 'svg')}
                            >
                              <Image className="h-4 w-4 mr-2" />
                              Export as SVG
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleExportTable(anovaTableRef, 'anova_table', 'csv')}
                            >
                              <FileSpreadsheet className="h-4 w-4 mr-2" />
                              Export as CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleExportTable(anovaTableRef, 'anova_table', 'text')
                              }
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              Export as Text (for Word)
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleExportTable(anovaTableRef, 'anova_table', 'html')
                              }
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              Export as HTML
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCopyTable(anovaTableRef)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy to Clipboard
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table ref={anovaTableRef} className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2">Source</th>
                              <th className="text-right p-2">df</th>
                              <th className="text-right p-2">Sum of Squares</th>
                              <th className="text-right p-2">Mean Square</th>
                              <th className="text-right p-2">F</th>
                              <th className="text-right p-2">p-value</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b">
                              <td className="p-2">Between Groups</td>
                              <td className="text-right p-2">{results.df_between}</td>
                              <td className="text-right p-2">
                                {results.sum_squares_between.toFixed(3)}
                              </td>
                              <td className="text-right p-2">
                                {results.mean_square_between.toFixed(3)}
                              </td>
                              <td className="text-right p-2">{results.f_statistic.toFixed(3)}</td>
                              <td className="text-right p-2">
                                {results.p_value < 0.001 ? '< 0.001' : results.p_value.toFixed(3)}
                              </td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2">Within Groups</td>
                              <td className="text-right p-2">{results.df_within}</td>
                              <td className="text-right p-2">
                                {results.sum_squares_within.toFixed(3)}
                              </td>
                              <td className="text-right p-2">
                                {results.mean_square_within.toFixed(3)}
                              </td>
                              <td className="text-right p-2">—</td>
                              <td className="text-right p-2">—</td>
                            </tr>
                            <tr className="border-b-2 border-primary">
                              <td className="font-bold p-2">Total</td>
                              <td className="text-right font-bold p-2">
                                {results.df_between + results.df_within}
                              </td>
                              <td className="text-right font-bold p-2">
                                {(results.sum_squares_between + results.sum_squares_within).toFixed(
                                  3
                                )}
                              </td>
                              <td className="text-right p-2">—</td>
                              <td className="text-right p-2">—</td>
                              <td className="text-right p-2">—</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            <TabsContent value="report">
              {results && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Statistical Report</CardTitle>
                        <CardDescription>Generated on {results.report_timestamp}</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={createReportTab} variant="outline" size="sm">
                          <FileText className="h-4 w-4 mr-2" />
                          Open in New Tab
                        </Button>
                        <Button onClick={downloadReport} variant="outline" size="sm">
                          <Download className="h-4 w-4 mr-2" />
                          Download Report
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none">
                      <MarkdownViewer content={results.report_content} editable={false} />
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="gap-2 px-6 pb-6">
          {activeTab === 'setup' && (
            <Button
              onClick={calculateAnova}
              disabled={isLoading || !groupingVariable || !dependentVariable}
            >
              {isLoading ? <Loader className="h-4 w-4 animate-spin mr-2" /> : null}
              Calculate ANOVA
            </Button>
          )}
          {activeTab === 'results' && results && (
            <Button onClick={() => setActiveTab('report')} variant="outline">
              View Report
            </Button>
          )}
          {activeTab === 'report' && results && (
            <>
              <Button onClick={createReportTab} variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                Open in New Tab
              </Button>
              <Button onClick={downloadReport} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download Report
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
