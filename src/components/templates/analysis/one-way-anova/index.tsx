import { useTabs } from '@/contexts/tabs-context';
import { addTab, setActiveTab } from '@/contexts/tabs-context/actions';
import { ReactNode, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/molecules/dialog';
import { Button } from '@/components/atoms/button';
import { LuLoader, LuDownload, LuInfo, LuFileText } from 'react-icons/lu';
import { Alert, AlertDescription } from '@/components/atoms/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/molecules/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/card';
import useAuth from '@/hooks/api/use-auth';
import { ViewType } from '@/contexts/project-context/types';

const API_BASE_URL = 'http://localhost:8080';

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
  const { state, dispatch } = useTabs();
  const [groupingVariable, setGroupingVariable] = useState<string>('');
  const [dependentVariable, setDependentVariable] = useState<string>('');
  const [results, setResults] = useState<AnovaResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('setup');
  const { tokens } = useAuth();

  const token = tokens?.accessToken;

  const activeDataTab = useMemo(
    () => state.tabs.find(tab => tab.id === state.activeTabId),
    [state.tabs, state.activeTabId]
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

    activeDataTab.data.initialData.forEach((row: any) => {
      const group = row[groupingVariable]?.toString();
      const value =
        typeof row[dependentVariable] === 'number'
          ? row[dependentVariable]
          : parseFloat(row[dependentVariable]);

      if (group && !isNaN(value)) {
        if (!groupedData[group]) {
          groupedData[group] = [];
        }
        groupedData[group].push(value);
      }
    });

    return groupedData;
  };

  const validateData = (groupedData: Record<string, number[]>) => {
    if (Object.keys(groupedData).length < 2) {
      return 'ANOVA requires at least two groups.';
    }

    for (const [group, values] of Object.entries(groupedData)) {
      if (values.length < 2) {
        return `Group '${group}' has less than 2 valid observations, which is insufficient for ANOVA.`;
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

    // Add the tab - the reducer will generate an ID and set it as active automatically
    dispatch(addTab(reportTab));

    // Note: Your reducer automatically sets the new tab as active in ADD_TAB case,
    // so we don't need to dispatch setActiveTab separately
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>One-Way ANOVA Analysis</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          <TabsList className="flex w-full h-9 items-center justify-center bg-muted p-1 text-muted-foreground">
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

          <div className="flex-1 overflow-auto py-2">
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
            </TabsContent>

            <TabsContent value="results" className="space-y-4">
              {results && (
                <>
                  {/* Main Results Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <LuInfo className="h-4 w-4" />
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
                      <CardTitle>Group Statistics</CardTitle>
                      <CardDescription>Descriptive statistics for each group</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
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
                      <CardTitle>ANOVA Table</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
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
                          <LuFileText className="h-4 w-4 mr-2" />
                          Open in New Tab
                        </Button>
                        <Button onClick={downloadReport} variant="outline" size="sm">
                          <LuDownload className="h-4 w-4 mr-2" />
                          Download Report
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-accent/30 p-4 rounded-lg">
                      <pre className="whitespace-pre-wrap text-sm font-mono overflow-auto max-h-96">
                        {results.report_content}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="gap-2">
          {activeTab === 'setup' && (
            <Button
              onClick={calculateAnova}
              disabled={isLoading || !groupingVariable || !dependentVariable}
            >
              {isLoading ? <LuLoader className="h-4 w-4 animate-spin mr-2" /> : null}
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
                <LuFileText className="h-4 w-4 mr-2" />
                Open in New Tab
              </Button>
              <Button onClick={downloadReport} variant="outline">
                <LuDownload className="h-4 w-4 mr-2" />
                Download Report
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
