import React, { useState, useMemo } from 'react';
import { getIdToken } from '@/utils/auth';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { Label } from '@/components/atoms/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/molecules/tabs';
import { useTabsStore } from '@/stores/tabs-store';
import { useAuth } from '@/hooks/api/use-auth';
import { apiClient } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/molecules/dialog';
import { Loader } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/atoms/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/card';

interface FactorAnalysisProps {
  children: React.ReactNode;
}

interface Variable {
  name: string;
  type: string;
}

interface FactorAnalysisRequest {
  variables: string[];
  extraction_method: 'pca' | 'efa';
  rotation_method?: 'varimax' | 'promax' | 'none';
  number_of_factors?: number;
  data: Record<string, number[]>;
}

interface FactorAnalysisResult {
  eigenvalues: number[];
  explained_variance: number[];
  cumulative_variance: number[];
  factor_loadings: number[][];
  communalities: number[];
  variables: string[];
  factors: string[];
  scree_plot_data: { factor: number; eigenvalue: number }[];
  interpretation: string;
  report_content: string;
  report_timestamp: string;
}

interface FactorAnalysisResponse {
  results: FactorAnalysisResult;
}

export const FactorAnalysis = ({ children }: FactorAnalysisProps) => {
  const { tabs, activeTabId } = useTabsStore();
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);
  const [extractionMethod, setExtractionMethod] = useState<'pca' | 'efa'>('pca');
  const [rotationMethod, setRotationMethod] = useState<'varimax' | 'promax' | 'none'>('varimax');
  const [numberOfFactors, setNumberOfFactors] = useState<number>(3);
  const [results, setResults] = useState<FactorAnalysisResult | null>(null);
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

  const calculateFactorAnalysis = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const factorAnalysisRequest: FactorAnalysisRequest = {
        variables: selectedVariables,
        extraction_method: extractionMethod,
        rotation_method: rotationMethod,
        number_of_factors: numberOfFactors,
        data: data,
      };

      // Make the API call to the backend
      const result = await apiClient.analysis.factorAnalysis(factorAnalysisRequest);
      setResults(result.results);
      setActiveTab('results');
    } catch (error) {
      console.error('Failed to calculate factor analysis:', error);
      setError(error instanceof Error ? error.message : 'Failed to calculate factor analysis');
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

  const renderFactorLoadings = () => {
    if (!results) return null;

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-border">
          <thead>
            <tr>
              <th className="border border-border p-2 bg-muted">Variable</th>
              {results.factors.map((factor, index) => (
                <th key={index} className="border border-border p-2 bg-muted text-center">
                  {factor}
                </th>
              ))}
              <th className="border border-border p-2 bg-muted text-center">Communality</th>
            </tr>
          </thead>
          <tbody>
            {results.variables.map((variable, varIndex) => (
              <tr key={varIndex}>
                <td className="border border-border p-2 bg-muted font-medium">{variable}</td>
                {results.factors.map((_, factorIndex) => (
                  <td key={factorIndex} className="border border-border p-2 text-center">
                    {results.factor_loadings[varIndex]?.[factorIndex]?.toFixed(3) || '-'}
                  </td>
                ))}
                <td className="border border-border p-2 text-center">
                  {results.communalities[varIndex]?.toFixed(3) || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderEigenvalues = () => {
    if (!results) return null;

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-border">
          <thead>
            <tr>
              <th className="border border-border p-2 bg-muted">Factor</th>
              <th className="border border-border p-2 bg-muted text-center">Eigenvalue</th>
              <th className="border border-border p-2 bg-muted text-center">
                Explained Variance (%)
              </th>
              <th className="border border-border p-2 bg-muted text-center">Cumulative (%)</th>
            </tr>
          </thead>
          <tbody>
            {results.eigenvalues.map((eigenvalue, index) => (
              <tr key={index}>
                <td className="border border-border p-2 bg-muted font-medium">
                  {results.factors[index]}
                </td>
                <td className="border border-border p-2 text-center">{eigenvalue.toFixed(3)}</td>
                <td className="border border-border p-2 text-center">
                  {(results.explained_variance[index] * 100).toFixed(2)}%
                </td>
                <td className="border border-border p-2 text-center">
                  {(results.cumulative_variance[index] * 100).toFixed(2)}%
                </td>
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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Factor Analysis</DialogTitle>
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
                <h3 className="font-medium mb-2">Analysis Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Extraction Method:</label>
                    <div className="space-y-2 mt-2">
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          value="pca"
                          checked={extractionMethod === 'pca'}
                          onChange={e => setExtractionMethod(e.target.value as 'pca')}
                          className="mr-2"
                        />
                        <span>Principal Component Analysis (PCA)</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          value="efa"
                          checked={extractionMethod === 'efa'}
                          onChange={e => setExtractionMethod(e.target.value as 'efa')}
                          className="mr-2"
                        />
                        <span>Exploratory Factor Analysis (EFA)</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Rotation Method:</label>
                    <div className="space-y-2 mt-2">
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          value="varimax"
                          checked={rotationMethod === 'varimax'}
                          onChange={e => setRotationMethod(e.target.value as 'varimax')}
                          className="mr-2"
                        />
                        <span>Varimax</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          value="promax"
                          checked={rotationMethod === 'promax'}
                          onChange={e => setRotationMethod(e.target.value as 'promax')}
                          className="mr-2"
                        />
                        <span>Promax</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          value="none"
                          checked={rotationMethod === 'none'}
                          onChange={e => setRotationMethod(e.target.value as 'none')}
                          className="mr-2"
                        />
                        <span>None</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Number of Factors:</label>
                    <input
                      type="number"
                      min="1"
                      max={selectedVariables.length}
                      value={numberOfFactors}
                      onChange={e => setNumberOfFactors(parseInt(e.target.value) || 3)}
                      className="w-full mt-2 p-2 border border-border rounded"
                    />
                  </div>
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
                onClick={calculateFactorAnalysis}
                disabled={selectedVariables.length < 3 || isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  'Calculate Factor Analysis'
                )}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="results" className="space-y-4">
            {results && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Eigenvalues and Explained Variance</CardTitle>
                    <CardDescription>Factor extraction results</CardDescription>
                  </CardHeader>
                  <CardContent>{renderEigenvalues()}</CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Factor Loadings</CardTitle>
                    <CardDescription>Factor loadings matrix with communalities</CardDescription>
                  </CardHeader>
                  <CardContent>{renderFactorLoadings()}</CardContent>
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
