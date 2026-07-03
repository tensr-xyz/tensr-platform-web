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
import { adaptLinearRegressionResults, runDatasetAnalysis } from '@/lib/workspace-analysis';
import { getDatasetIdFromTab, WORKSPACE_DATASET_REQUIRED } from '@/lib/workspace-dataset';

interface LinearRegressionProps {
  children: ReactNode;
}

interface Variable {
  name: string;
  type: string;
}

interface LinearRegressionRequest {
  dependent_variable: string;
  independent_variables: string[];
  data: Record<string, number[]>;
}

interface LinearRegressionResult {
  coefficients: Record<string, number>;
  intercept: number;
  r_squared: number;
  adjusted_r_squared: number;
  standard_error: number;
  f_statistic: number;
  p_value: number;
  degrees_of_freedom: number;
  residuals: number[];
  predicted_values: number[];
  interpretation: string;
  report_content: string;
  report_timestamp: string;
}

interface LinearRegressionResponse {
  results: LinearRegressionResult;
}

export const LinearRegression = ({ children }: LinearRegressionProps) => {
  const { tabs, activeTabId } = useTabsStore();
  const [dependentVariable, setDependentVariable] = useState<string>('');
  const [independentVariables, setIndependentVariables] = useState<string[]>([]);
  const [results, setResults] = useState<LinearRegressionResult | null>(null);
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
    if (
      !activeDataTab?.data?.initialData ||
      !dependentVariable ||
      independentVariables.length === 0
    )
      return {};

    const allVariables = [dependentVariable, ...independentVariables];
    return allVariables.reduce<{ [key: string]: number[] }>((acc, varName) => {
      const values = activeDataTab
        .data!.initialData!.map((row: { [x: string]: any }) => {
          const val = row[varName];
          return typeof val === 'number' ? val : parseFloat(val);
        })
        .filter((val: number) => !isNaN(val));

      acc[varName] = values;
      return acc;
    }, {});
  }, [activeDataTab?.data?.initialData, dependentVariable, independentVariables]);

  const handleDependentVariableSelect = (variable: string) => {
    setDependentVariable(variable);
  };

  const handleIndependentVariableSelect = (variable: string) => {
    if (independentVariables.includes(variable)) {
      setIndependentVariables(independentVariables.filter(v => v !== variable));
    } else {
      setIndependentVariables([...independentVariables, variable]);
    }
  };

  const calculateRegression = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const datasetId = getDatasetIdFromTab(activeDataTab);
      if (!datasetId) {
        throw new Error(WORKSPACE_DATASET_REQUIRED);
      }

      const envelope = await runDatasetAnalysis(datasetId, 'linear_regression', {
        dependent: dependentVariable,
        independents: independentVariables,
      });
      // Legacy template expects a slightly different shape than tensr-api returns.
      setResults(adaptLinearRegressionResults(envelope) as unknown as LinearRegressionResult);
      setActiveTab('results');
    } catch (error) {
      console.error('Failed to calculate linear regression:', error);
      setError(error instanceof Error ? error.message : 'Failed to calculate linear regression');
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

  const availableIndependentVariables = numericVariables.filter(v => v.name !== dependentVariable);

  return (
    <Dialog>
      {children}
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Linear Regression Analysis</DialogTitle>
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
                <h3 className="font-medium mb-2">Dependent Variable (Target)</h3>
                <div className="max-h-60 overflow-y-auto">
                  {numericVariables.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No numeric variables found</p>
                  ) : (
                    numericVariables.map(variable => (
                      <div
                        key={variable.name}
                        onClick={() => handleDependentVariableSelect(variable.name)}
                        className={`p-2 cursor-pointer rounded ${
                          dependentVariable === variable.name
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
                <h3 className="font-medium mb-2">Independent Variables (Predictors)</h3>
                <div className="max-h-60 overflow-y-auto">
                  {availableIndependentVariables.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">
                      {dependentVariable
                        ? 'No other numeric variables available'
                        : 'Select dependent variable first'}
                    </p>
                  ) : (
                    availableIndependentVariables.map(variable => (
                      <div
                        key={variable.name}
                        onClick={() => handleIndependentVariableSelect(variable.name)}
                        className={`p-2 cursor-pointer rounded ${
                          independentVariables.includes(variable.name)
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
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    Dependent Variable:
                  </h4>
                  {dependentVariable ? (
                    <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-sm">
                      {dependentVariable}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No dependent variable selected</p>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    Independent Variables:
                  </h4>
                  {independentVariables.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">
                      No independent variables selected
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {independentVariables.map(variable => (
                        <div
                          key={variable}
                          className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-2 rounded-sm"
                        >
                          <span>{variable}</span>
                          <button
                            onClick={() => handleIndependentVariableSelect(variable)}
                            className="text-red-500 hover:text-red-700"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                onClick={calculateRegression}
                disabled={!dependentVariable || independentVariables.length === 0 || isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  'Calculate Linear Regression'
                )}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="results" className="space-y-4">
            {results && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Model Summary</CardTitle>
                    <CardDescription>Regression model performance metrics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">R-squared:</p>
                        <p className="text-lg font-bold">{(results.r_squared * 100).toFixed(2)}%</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Adjusted R-squared:</p>
                        <p className="text-lg font-bold">
                          {(results.adjusted_r_squared * 100).toFixed(2)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Standard Error:</p>
                        <p className="text-lg font-bold">{results.standard_error.toFixed(4)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">F-statistic:</p>
                        <p className="text-lg font-bold">{results.f_statistic.toFixed(4)}</p>
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
                    <CardTitle>Coefficients</CardTitle>
                    <CardDescription>Regression coefficients and intercept</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="font-medium">Intercept:</span>
                        <span>{results.intercept.toFixed(4)}</span>
                      </div>
                      {Object.entries(results.coefficients).map(([variable, coefficient]) => (
                        <div key={variable} className="flex justify-between">
                          <span className="font-medium">{variable}:</span>
                          <span>{coefficient.toFixed(4)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
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
