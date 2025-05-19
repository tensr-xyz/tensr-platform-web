import { useTabs } from '@/contexts/tabs-context';
import { ReactNode, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/molecules/dialog';
import { Button } from '@/components/atoms/button';
import { Label } from '@/components/atoms/label';
import { Input } from '@/components/atoms/input';
import { Alert, AlertDescription } from '@/components/atoms/alert';
import { LuLoader } from 'react-icons/lu';
import useAuth from '@/hooks/api/use-auth';

// API base URL
const API_BASE_URL = 'http://localhost:8080';

interface OneSampleTTestProps {
  children: ReactNode;
}

interface Variable {
  name: string;
  type: string;
}

interface OneSampleTTestRequest {
  sample: number[];
  hypothesized_mean: number;
  confidence_level: number;
}

interface TTestResult {
  t_statistic: number;
  p_value: number;
  degrees_of_freedom: number;
  mean_difference: number;
  sample_mean: number;
  sample_size: number;
  confidence_interval?: [number, number];
}

export const OneSampleTTest = ({ children }: OneSampleTTestProps) => {
  const { state } = useTabs();
  const [selectedVariable, setSelectedVariable] = useState<string | null>(null);
  const [hypothesizedMean, setHypothesizedMean] = useState<string>('0');
  const [confidenceLevel, setConfidenceLevel] = useState<string>('0.95');
  const [results, setResults] = useState<TTestResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { tokens } = useAuth();

  const token = tokens?.accessToken;

  const activeTab = useMemo(
    () => state.tabs.find(tab => tab.id === state.activeTabId),
    [state.tabs, state.activeTabId]
  );

  // Extract variables from the columns
  const variables = useMemo((): Variable[] => {
    if (!activeTab?.data?.initialColumns) return [];
    return activeTab.data.initialColumns.map((column: { header: any; type: any }) => ({
      name: column.header,
      type: column.type || 'string',
    }));
  }, [activeTab?.data?.initialColumns]);

  // Extract data for the selected variable
  const sampleData = useMemo(() => {
    if (!activeTab?.data?.initialData || !selectedVariable) return [];

    return activeTab.data.initialData
      .map((row: { [x: string]: any }) => {
        const val = row[selectedVariable];
        return typeof val === 'number' ? val : parseFloat(val);
      })
      .filter((val: number) => !isNaN(val));
  }, [activeTab?.data?.initialData, selectedVariable]);

  const handleVariableSelect = (variable: string) => {
    setSelectedVariable(prevSelected => (prevSelected === variable ? null : variable));
    // Reset results when changing variable
    setResults(null);
  };

  const validateInput = () => {
    if (!selectedVariable) return 'Please select a variable';
    if (sampleData.length < 2)
      return 'The selected variable must have at least 2 valid numeric values';

    const parsedMean = parseFloat(hypothesizedMean);
    if (isNaN(parsedMean)) return 'Hypothesized mean must be a valid number';

    const parsedConfidence = parseFloat(confidenceLevel);
    if (isNaN(parsedConfidence) || parsedConfidence <= 0 || parsedConfidence >= 1)
      return 'Confidence level must be between 0 and 1 (e.g., 0.95 for 95%)';

    return null;
  };

  const runTTest = async () => {
    const validationError = validateInput();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const request: OneSampleTTestRequest = {
        sample: sampleData,
        hypothesized_mean: parseFloat(hypothesizedMean),
        confidence_level: parseFloat(confidenceLevel),
      };

      const response = await fetch(`${API_BASE_URL}/api/statistics/calculate-one-sample-ttest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to calculate t-test');
      }

      const result: TTestResult = await response.json();
      setResults(result);
    } catch (error) {
      console.error('Failed to calculate t-test:', error);
      setError(error instanceof Error ? error.message : 'Failed to calculate t-test');
    } finally {
      setIsLoading(false);
    }
  };

  const numericVariables = variables.filter(
    v =>
      v.type === 'number' ||
      (activeTab?.data?.initialData?.[0]?.[v.name] !== undefined &&
        !isNaN(parseFloat(activeTab.data.initialData[0][v.name])))
  );

  const significanceLevel = results
    ? results.p_value < 0.001
      ? '< 0.001'
      : results.p_value.toFixed(3)
    : '';

  const isSignificant = results ? results.p_value < 0.05 : false;

  const conclusionText = results
    ? isSignificant
      ? `The sample mean (${results.sample_mean.toFixed(2)}) is significantly different from the hypothesized mean (${hypothesizedMean})`
      : `The sample mean (${results.sample_mean.toFixed(2)}) is not significantly different from the hypothesized mean (${hypothesizedMean})`
    : '';

  return (
    <Dialog>
      {children}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>One-Sample T-Test</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
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
                        selectedVariable === variable.name
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

            <div className="border rounded-lg p-4 space-y-4">
              <div>
                <Label htmlFor="mean">Hypothesized Mean</Label>
                <Input
                  id="mean"
                  type="number"
                  step="any"
                  value={hypothesizedMean}
                  onChange={e => setHypothesizedMean(e.target.value)}
                  placeholder="Enter hypothesized mean"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="confidence">Confidence Level</Label>
                <Input
                  id="confidence"
                  type="number"
                  min="0.01"
                  max="0.99"
                  step="0.01"
                  value={confidenceLevel}
                  onChange={e => setConfidenceLevel(e.target.value)}
                  placeholder="0.95 (for 95% confidence)"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter a value between 0 and 1 (e.g., 0.95 for 95% confidence)
                </p>
              </div>

              {selectedVariable && sampleData.length > 0 && (
                <div>
                  <p className="text-sm">
                    <strong>Selected variable:</strong> {selectedVariable}
                  </p>
                  <p className="text-sm">
                    <strong>Sample size:</strong> {sampleData.length} valid values
                  </p>
                </div>
              )}
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {results && (
            <div className="mt-4 border rounded-lg p-4">
              <h3 className="font-medium mb-2">T-Test Results</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                    <p className="text-sm font-medium">T-Statistic</p>
                    <p className="text-lg">{results.t_statistic.toFixed(3)}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                    <p className="text-sm font-medium">P-Value</p>
                    <p
                      className={`text-lg ${isSignificant ? 'text-green-600 dark:text-green-400' : ''}`}
                    >
                      {significanceLevel}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                    <p className="text-sm font-medium">Sample Mean</p>
                    <p className="text-lg">{results.sample_mean.toFixed(3)}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                    <p className="text-sm font-medium">Mean Difference</p>
                    <p className="text-lg">{results.mean_difference.toFixed(3)}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                    <p className="text-sm font-medium">Degrees of Freedom</p>
                    <p className="text-lg">{results.degrees_of_freedom}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                    <p className="text-sm font-medium">Sample Size</p>
                    <p className="text-lg">{results.sample_size}</p>
                  </div>
                </div>

                {results.confidence_interval && (
                  <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                    <p className="text-sm font-medium">
                      {(parseFloat(confidenceLevel) * 100).toFixed(0)}% Confidence Interval
                    </p>
                    <p className="text-lg">
                      {results.confidence_interval[0].toFixed(3)} to{' '}
                      {results.confidence_interval[1].toFixed(3)}
                    </p>
                  </div>
                )}

                <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-md mt-3">
                  <p className="font-medium">Conclusion:</p>
                  <p>{conclusionText}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={runTTest}
            disabled={isLoading || !selectedVariable || sampleData.length < 2}
          >
            {isLoading ? <LuLoader className="h-4 w-4 animate-spin mr-2" /> : null}
            Run T-Test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
