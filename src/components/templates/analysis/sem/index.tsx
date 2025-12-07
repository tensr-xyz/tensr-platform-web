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
import { Textarea } from '@/components/atoms/text-area';

interface SEMProps {
  children: React.ReactNode;
}

interface Variable {
  name: string;
  type: string;
}

interface SEMRequest {
  variables: string[];
  model_specification: string;
  estimation_method: 'ml' | 'uls' | 'gls' | 'wls';
  data: Record<string, number[]>;
}

interface SEMResult {
  model_fit: {
    chi_square: number;
    df: number;
    p_value: number;
    cfi: number;
    tli: number;
    rmsea: number;
    rmsea_ci_lower: number;
    rmsea_ci_upper: number;
    srmr: number;
    aic: number;
    bic: number;
  };
  parameter_estimates: {
    path: string;
    estimate: number;
    se: number;
    z_value: number;
    p_value: number;
    standardized: number;
  }[];
  modification_indices: {
    path: string;
    mi: number;
    epc: number;
  }[];
  interpretation: string;
  report_content: string;
  report_timestamp: string;
}

interface SEMResponse {
  results: SEMResult;
}

export const SEM = ({ children }: SEMProps) => {
  const { tabs, activeTabId } = useTabsStore();
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);
  const [modelSpecification, setModelSpecification] = useState<string>('');
  const [estimationMethod, setEstimationMethod] = useState<'ml' | 'uls' | 'gls' | 'wls'>('ml');
  const [results, setResults] = useState<SEMResult | null>(null);
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

  const calculateSEM = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const semRequest: SEMRequest = {
        variables: selectedVariables,
        model_specification: modelSpecification,
        estimation_method: estimationMethod,
        data: data,
      };

      // Make the API call to the backend
      const result = await apiClient.analysis.sem(semRequest);
      setResults(result.results);
      setActiveTab('results');
    } catch (error) {
      console.error('Failed to calculate SEM:', error);
      setError(error instanceof Error ? error.message : 'Failed to calculate SEM');
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

  const renderModelFit = () => {
    if (!results) return null;

    const fit = results.model_fit;

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-border">
          <thead>
            <tr>
              <th className="border border-border p-2 bg-muted">Fit Index</th>
              <th className="border border-border p-2 bg-muted text-center">Value</th>
              <th className="border border-border p-2 bg-muted text-center">Interpretation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-border p-2 bg-muted font-medium">Chi-square</td>
              <td className="border border-border p-2 text-center">{fit.chi_square.toFixed(3)}</td>
              <td className="border border-border p-2 text-center">
                {fit.p_value > 0.05 ? 'Good fit' : 'Poor fit'}
              </td>
            </tr>
            <tr>
              <td className="border border-border p-2 bg-muted font-medium">df</td>
              <td className="border border-border p-2 text-center">{fit.df}</td>
              <td className="border border-border p-2 text-center">-</td>
            </tr>
            <tr>
              <td className="border border-border p-2 bg-muted font-medium">p-value</td>
              <td className="border border-border p-2 text-center">{fit.p_value.toFixed(3)}</td>
              <td className="border border-border p-2 text-center">
                {fit.p_value > 0.05 ? 'Good fit' : 'Poor fit'}
              </td>
            </tr>
            <tr>
              <td className="border border-border p-2 bg-muted font-medium">CFI</td>
              <td className="border border-border p-2 text-center">{fit.cfi.toFixed(3)}</td>
              <td className="border border-border p-2 text-center">
                {fit.cfi > 0.95 ? 'Excellent' : fit.cfi > 0.9 ? 'Good' : 'Poor'}
              </td>
            </tr>
            <tr>
              <td className="border border-border p-2 bg-muted font-medium">TLI</td>
              <td className="border border-border p-2 text-center">{fit.tli.toFixed(3)}</td>
              <td className="border border-border p-2 text-center">
                {fit.tli > 0.95 ? 'Excellent' : fit.tli > 0.9 ? 'Good' : 'Poor'}
              </td>
            </tr>
            <tr>
              <td className="border border-border p-2 bg-muted font-medium">RMSEA</td>
              <td className="border border-border p-2 text-center">{fit.rmsea.toFixed(3)}</td>
              <td className="border border-border p-2 text-center">
                {fit.rmsea < 0.05 ? 'Excellent' : fit.rmsea < 0.08 ? 'Good' : 'Poor'}
              </td>
            </tr>
            <tr>
              <td className="border border-border p-2 bg-muted font-medium">SRMR</td>
              <td className="border border-border p-2 text-center">{fit.srmr.toFixed(3)}</td>
              <td className="border border-border p-2 text-center">
                {fit.srmr < 0.05 ? 'Excellent' : fit.srmr < 0.08 ? 'Good' : 'Poor'}
              </td>
            </tr>
            <tr>
              <td className="border border-border p-2 bg-muted font-medium">AIC</td>
              <td className="border border-border p-2 text-center">{fit.aic.toFixed(3)}</td>
              <td className="border border-border p-2 text-center">Lower is better</td>
            </tr>
            <tr>
              <td className="border border-border p-2 bg-muted font-medium">BIC</td>
              <td className="border border-border p-2 text-center">{fit.bic.toFixed(3)}</td>
              <td className="border border-border p-2 text-center">Lower is better</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const renderParameterEstimates = () => {
    if (!results) return null;

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-border">
          <thead>
            <tr>
              <th className="border border-border p-2 bg-muted">Path</th>
              <th className="border border-border p-2 bg-muted text-center">Estimate</th>
              <th className="border border-border p-2 bg-muted text-center">SE</th>
              <th className="border border-border p-2 bg-muted text-center">Z-value</th>
              <th className="border border-border p-2 bg-muted text-center">p-value</th>
              <th className="border border-border p-2 bg-muted text-center">Standardized</th>
            </tr>
          </thead>
          <tbody>
            {results.parameter_estimates.map((param, index) => (
              <tr key={index}>
                <td className="border border-border p-2 bg-muted font-medium">{param.path}</td>
                <td className="border border-border p-2 text-center">
                  {param.estimate.toFixed(3)}
                </td>
                <td className="border border-border p-2 text-center">{param.se.toFixed(3)}</td>
                <td className="border border-border p-2 text-center">{param.z_value.toFixed(3)}</td>
                <td className="border border-border p-2 text-center">{param.p_value.toFixed(3)}</td>
                <td className="border border-border p-2 text-center">
                  {param.standardized.toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderModificationIndices = () => {
    if (!results || !results.modification_indices.length) return null;

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-border">
          <thead>
            <tr>
              <th className="border border-border p-2 bg-muted">Path</th>
              <th className="border border-border p-2 bg-muted text-center">Modification Index</th>
              <th className="border border-border p-2 bg-muted text-center">
                Expected Parameter Change
              </th>
            </tr>
          </thead>
          <tbody>
            {results.modification_indices.map((mod, index) => (
              <tr key={index}>
                <td className="border border-border p-2 bg-muted font-medium">{mod.path}</td>
                <td className="border border-border p-2 text-center">{mod.mi.toFixed(3)}</td>
                <td className="border border-border p-2 text-center">{mod.epc.toFixed(3)}</td>
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
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Structural Equation Modeling (SEM)</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="setup">Setup</TabsTrigger>
            <TabsTrigger value="results" disabled={!results}>
              Results
            </TabsTrigger>
            <TabsTrigger value="modifications" disabled={!results}>
              Modifications
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
                    <label className="text-sm font-medium">Estimation Method:</label>
                    <div className="space-y-2 mt-2">
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          value="ml"
                          checked={estimationMethod === 'ml'}
                          onChange={e => setEstimationMethod(e.target.value as 'ml')}
                          className="mr-2"
                        />
                        <span>Maximum Likelihood (ML)</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          value="uls"
                          checked={estimationMethod === 'uls'}
                          onChange={e => setEstimationMethod(e.target.value as 'uls')}
                          className="mr-2"
                        />
                        <span>Unweighted Least Squares (ULS)</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          value="gls"
                          checked={estimationMethod === 'gls'}
                          onChange={e => setEstimationMethod(e.target.value as 'gls')}
                          className="mr-2"
                        />
                        <span>Generalized Least Squares (GLS)</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          value="wls"
                          checked={estimationMethod === 'wls'}
                          onChange={e => setEstimationMethod(e.target.value as 'wls')}
                          className="mr-2"
                        />
                        <span>Weighted Least Squares (WLS)</span>
                      </label>
                    </div>
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
              <h3 className="font-medium mb-2">Model Specification</h3>
              <Textarea
                placeholder="Enter your SEM model specification using lavaan syntax. Example:
# Measurement model
F1 =~ x1 + x2 + x3
F2 =~ x4 + x5 + x6

# Structural model
F2 ~ F1

# Covariances
F1 ~~ F2"
                value={modelSpecification}
                onChange={e => setModelSpecification(e.target.value)}
                className="min-h-32"
              />
              <p className="text-xs text-gray-500 mt-2">
                Use lavaan syntax to specify your structural equation model. Include measurement
                models, structural relationships, and covariances.
              </p>
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
                onClick={calculateSEM}
                disabled={selectedVariables.length < 2 || !modelSpecification.trim() || isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  'Calculate SEM'
                )}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="results" className="space-y-4">
            {results && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Model Fit Indices</CardTitle>
                    <CardDescription>Overall model fit assessment</CardDescription>
                  </CardHeader>
                  <CardContent>{renderModelFit()}</CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Parameter Estimates</CardTitle>
                    <CardDescription>Path coefficients and their significance</CardDescription>
                  </CardHeader>
                  <CardContent>{renderParameterEstimates()}</CardContent>
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

          <TabsContent value="modifications" className="space-y-4">
            {results && (
              <Card>
                <CardHeader>
                  <CardTitle>Modification Indices</CardTitle>
                  <CardDescription>Suggested model improvements</CardDescription>
                </CardHeader>
                <CardContent>
                  {results.modification_indices.length > 0 ? (
                    renderModificationIndices()
                  ) : (
                    <p className="text-sm text-gray-500 italic">
                      No significant modification indices found
                    </p>
                  )}
                </CardContent>
              </Card>
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
