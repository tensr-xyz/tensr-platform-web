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

// API base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_FARGATE_API_URL;

interface ChiSquareProps {
  children: ReactNode;
}

interface Variable {
  name: string;
  type: string;
}

interface ChiSquareRequest {
  variables: string[];
  data: Record<string, (string | number)[]>;
}

interface ChiSquareResult {
  chi_square_statistic: number;
  p_value: number;
  degrees_of_freedom: number;
  expected_frequencies: number[][];
  observed_frequencies: number[][];
  contingency_table: number[][];
  variables: string[];
  interpretation: string;
  report_content: string;
  report_timestamp: string;
}

interface ChiSquareResponse {
  results: ChiSquareResult;
}

export const ChiSquare = ({ children }: ChiSquareProps) => {
  const { tabs, activeTabId } = useTabsStore();
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);
  const [results, setResults] = useState<ChiSquareResult | null>(null);
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

      return {
        name: colName,
        type: 'categorical', // Chi-square is for categorical variables
      };
    });
  }, [activeDataTab?.data?.initialData]);

  const data = useMemo(() => {
    if (!activeDataTab?.data?.initialData || !selectedVariables.length) return {};

    return selectedVariables.reduce<{ [key: string]: (string | number)[] }>((acc, varName) => {
      const values = activeDataTab
        .data!.initialData!.map((row: { [x: string]: any }) => row[varName])
        .filter((val: string | null) => val != null && val !== '');

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

  const calculateChiSquare = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const chiSquareRequest: ChiSquareRequest = {
        variables: selectedVariables,
        data: data,
      };

      // Make the API call to the backend
      const response = await fetch(`${API_BASE_URL}/api/statistics/perform-chi-square-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(chiSquareRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to calculate chi-square test');
      }

      const result: ChiSquareResponse = await response.json();
      setResults(result.results);
      setActiveTab('results');
    } catch (error) {
      console.error('Failed to calculate chi-square test:', error);
      setError(error instanceof Error ? error.message : 'Failed to calculate chi-square test');
    } finally {
      setIsLoading(false);
    }
  };

  const renderContingencyTable = () => {
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
            {results.contingency_table.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className="border border-border p-2 bg-muted font-medium">
                  Category {rowIndex + 1}
                </td>
                {row.map((value, colIndex) => (
                  <td key={colIndex} className="border border-border p-2 text-center">
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderExpectedFrequencies = () => {
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
            {results.expected_frequencies.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className="border border-border p-2 bg-muted font-medium">
                  Category {rowIndex + 1}
                </td>
                {row.map((value, colIndex) => (
                  <td key={colIndex} className="border border-border p-2 text-center">
                    {value.toFixed(2)}
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
          <DialogTitle>Chi-Square Test of Independence</DialogTitle>
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
            <div className="border border-border rounded-lg p-4">
              <h3 className="font-medium mb-2">Categorical Variables</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Select two categorical variables to test for independence
              </p>
              <div className="max-h-60 overflow-y-auto">
                {variables.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No variables found</p>
                ) : (
                  variables.map(variable => (
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
                onClick={calculateChiSquare}
                disabled={selectedVariables.length !== 2 || isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  'Calculate Chi-Square Test'
                )}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="results" className="space-y-4">
            {results && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Test Results</CardTitle>
                    <CardDescription>Chi-square test of independence results</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm font-medium">Chi-Square Statistic:</p>
                        <p className="text-lg font-bold">
                          {results.chi_square_statistic.toFixed(4)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">P-value:</p>
                        <p className="text-lg font-bold">{results.p_value.toFixed(6)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Degrees of Freedom:</p>
                        <p className="text-lg font-bold">{results.degrees_of_freedom}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Contingency Table</CardTitle>
                    <CardDescription>Observed frequencies</CardDescription>
                  </CardHeader>
                  <CardContent>{renderContingencyTable()}</CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Expected Frequencies</CardTitle>
                    <CardDescription>Expected frequencies under independence</CardDescription>
                  </CardHeader>
                  <CardContent>{renderExpectedFrequencies()}</CardContent>
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
