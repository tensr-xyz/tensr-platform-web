import { useTabsStore } from '@/stores/tabs-store';
import { getIdToken } from '@/utils/auth';
import { ReactNode, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/molecules/dialog';
import { Button } from '@/components/atoms/button';
import { Loader } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/atoms/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/molecules/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/card';
import useAuth from '@/hooks/api/use-auth';
import { adaptCorrelationResults, runDatasetAnalysis } from '@/lib/workspace-analysis';
import { getDatasetIdFromTab, WORKSPACE_DATASET_REQUIRED } from '@/lib/workspace-dataset';

interface CorrelationProps {
  children: ReactNode;
}

interface Variable {
  name: string;
  type: string;
}

interface CorrelationRequest {
  variables: string[];
  correlation_type: 'pearson' | 'spearman' | 'kendall';
  data: Record<string, number[]>;
}

interface CorrelationResult {
  correlation_matrix: number[][];
  p_values: number[][];
  sample_sizes: number[][];
  variables: string[];
  interpretation: string;
  report_content: string;
  report_timestamp: string;
}

interface CorrelationResponse {
  results: CorrelationResult;
}

export const Correlation = ({ children }: CorrelationProps) => {
  const { tabs, activeTabId } = useTabsStore();
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);
  const [correlationType, setCorrelationType] = useState<'pearson' | 'spearman' | 'kendall'>(
    'pearson'
  );
  const [results, setResults] = useState<CorrelationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('setup');
  // Removed tokens - using getIdToken() directly

  const token = getIdToken();

  const activeDataTab = useMemo(
    () => tabs.find(tab => tab.id === activeTabId),
    [tabs, activeTabId]
  );

  const variables = useMemo(() => {
    if (!activeDataTab?.data?.initialData?.[0]) return [];

    const columnNames = Object.keys(activeDataTab.data?.initialData[0]).filter(key => key !== 'id');

    return columnNames.map(colName => {
      const sampleValues = activeDataTab
        .data!.initialData!.slice(0, 5)
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

  const data = useMemo(() => {
    if (!activeDataTab?.data?.initialData || !selectedVariables.length) return {};

    return selectedVariables.reduce<{ [key: string]: number[] }>((acc, varName) => {
      const values = activeDataTab
        .data!.initialData!.map((row: { [x: string]: any }) => {
          const val = row[varName];
          return typeof val === 'number' ? val : parseFloat(val);
        })
        .filter((val: number) => !isNaN(val));

      acc[varName] = values;
      return acc;
    }, {});
  }, [activeDataTab?.data?.initialData, selectedVariables]);

  const handleVariableSelect = (variable: string) => {
    if (selectedVariables.includes(variable)) {
      setSelectedVariables(selectedVariables.filter(v => v !== variable));
    } else {
      setSelectedVariables([...selectedVariables, variable]);
    }
  };

  const calculateCorrelation = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const datasetId = getDatasetIdFromTab(activeDataTab);
      if (!datasetId) {
        throw new Error(WORKSPACE_DATASET_REQUIRED);
      }

      const envelope = await runDatasetAnalysis(datasetId, 'correlation', {
        columns: selectedVariables,
        method: correlationType,
      });
      setResults(adaptCorrelationResults(envelope));
      setActiveTab('results');
    } catch (error) {
      console.error('Failed to calculate correlation:', error);
      setError(error instanceof Error ? error.message : 'Failed to calculate correlation');
    } finally {
      setIsLoading(false);
    }
  };

  const numericVariables = variables.filter(
    v =>
      v.type === 'number' ||
      (activeDataTab?.data?.initialData?.[0]?.[v.name] !== undefined &&
        !isNaN(parseFloat(activeDataTab.data?.initialData[0][v.name])))
  );

  const renderCorrelationMatrix = () => {
    if (!results) return null;

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-border">
          <thead>
            <tr>
              <th className="border border-border p-2 bg-muted"></th>
              {results.variables.map((variable, index) => (
                <th key={index} className="border border-border p-2 bg-muted text-center">
                  {variable}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.correlation_matrix.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className="border border-border p-2 bg-muted font-medium">
                  {results.variables[rowIndex]}
                </td>
                {row.map((value, colIndex) => (
                  <td
                    key={colIndex}
                    className={`border border-border p-2 text-center ${
                      rowIndex === colIndex ? 'bg-muted' : ''
                    }`}
                  >
                    {rowIndex === colIndex ? '1.000' : value.toFixed(3)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderPValues = () => {
    if (!results) return null;

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-border">
          <thead>
            <tr>
              <th className="border border-border p-2 bg-muted"></th>
              {results.variables.map((variable, index) => (
                <th key={index} className="border border-border p-2 bg-muted text-center">
                  {variable}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.p_values.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className="border border-border p-2 bg-muted font-medium">
                  {results.variables[rowIndex]}
                </td>
                {row.map((value, colIndex) => (
                  <td
                    key={colIndex}
                    className={`border border-border p-2 text-center ${
                      rowIndex === colIndex ? 'bg-muted' : ''
                    }`}
                  >
                    {rowIndex === colIndex ? '-' : value.toFixed(4)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <Dialog>
      {children}
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Correlation Analysis</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="setup">Setup</TabsTrigger>
            <TabsTrigger value="results" disabled={!results}>
              Results
            </TabsTrigger>
            <TabsTrigger value="report" disabled={!results}>
              Report
            </TabsTrigger>
          </TabsList>

          <TabsContent value="setup" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-border rounded-lg p-4">
                <h3 className="font-medium mb-2">Correlation Type</h3>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      value="pearson"
                      checked={correlationType === 'pearson'}
                      onChange={e => setCorrelationType(e.target.value as 'pearson')}
                      className="mr-2"
                    />
                    <span>Pearson (Linear)</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      value="spearman"
                      checked={correlationType === 'spearman'}
                      onChange={e => setCorrelationType(e.target.value as 'spearman')}
                      className="mr-2"
                    />
                    <span>Spearman (Rank)</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      value="kendall"
                      checked={correlationType === 'kendall'}
                      onChange={e => setCorrelationType(e.target.value as 'kendall')}
                      className="mr-2"
                    />
                    <span>Kendall&apos;s Tau</span>
                  </label>
                </div>
              </div>

              <div className="border border-border rounded-lg p-4">
                <h3 className="font-medium mb-2">Numeric Variables</h3>
                <div className="max-h-60 overflow-y-auto">
                  {numericVariables.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No numeric variables found</p>
                  ) : (
                    numericVariables.map(variable => (
                      <div
                        key={variable.name}
                        onClick={() => handleVariableSelect(variable.name)}
                        className={`p-2 cursor-pointer rounded ${
                          selectedVariables.includes(variable.name)
                            ? 'bg-blue-100 dark:bg-blue-900'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        {variable.name}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="border border-border rounded-lg p-4">
              <h3 className="font-medium mb-2">Selected Variables</h3>
              <div className="space-y-2">
                {selectedVariables.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No variables selected</p>
                ) : (
                  selectedVariables.map(variable => (
                    <div
                      key={variable}
                      className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-2 rounded-sm"
                    >
                      <span>{variable}</span>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleVariableSelect(variable);
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                onClick={calculateCorrelation}
                disabled={selectedVariables.length < 2 || isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  'Calculate Correlation'
                )}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="results" className="space-y-4">
            {results && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Correlation Matrix</CardTitle>
                    <CardDescription>
                      {correlationType.charAt(0).toUpperCase() + correlationType.slice(1)}{' '}
                      correlation coefficients
                    </CardDescription>
                  </CardHeader>
                  <CardContent>{renderCorrelationMatrix()}</CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>P-Values</CardTitle>
                    <CardDescription>Statistical significance of correlations</CardDescription>
                  </CardHeader>
                  <CardContent>{renderPValues()}</CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Interpretation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{results.interpretation}</p>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="report" className="space-y-4">
            {results && (
              <Card>
                <CardHeader>
                  <CardTitle>Analysis Report</CardTitle>
                  <CardDescription>Generated on {results.report_timestamp}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: results.report_content }} />
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
