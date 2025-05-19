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
import { LuLoader } from 'react-icons/lu';
import { Alert, AlertDescription } from '@/components/atoms/alert';
import useAuth from '@/hooks/api/use-auth';

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

interface AnovaResult {
  f_statistic: number;
  p_value: number;
  df_between: number;
  df_within: number;
  sum_squares_between: number;
  sum_squares_within: number;
  mean_square_between: number;
  mean_square_within: number;
}

export const OneWayAnova = ({ children }: AnovaProps) => {
  const { state } = useTabs();
  const [groupingVariable, setGroupingVariable] = useState<string>('');
  const [dependentVariable, setDependentVariable] = useState<string>('');
  const [results, setResults] = useState<AnovaResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { tokens } = useAuth();

  const token = tokens?.accessToken;

  const activeTab = useMemo(
    () => state.tabs.find(tab => tab.id === state.activeTabId),
    [state.tabs, state.activeTabId]
  );

  const variables = useMemo(() => {
    if (!activeTab?.data?.initialData?.[0]) return [];

    // Get all keys except 'id' from the first row
    const columnNames = Object.keys(activeTab.data.initialData[0]).filter(key => key !== 'id');

    return columnNames.map(colName => {
      // Get sample values for type detection
      const sampleValues = activeTab.data.initialData
        .slice(0, 5)
        .map((row: { [x: string]: any }) => row[colName])
        .filter((val: string | null) => val != null && val !== '');

      // Try to convert sample values to numbers
      const numericValues = sampleValues.map((val: { toString: () => string }) =>
        parseFloat(val.toString())
      );
      const isNumeric = numericValues.every((val: number) => !isNaN(val));

      return {
        name: colName,
        type: isNumeric ? 'number' : 'string',
      };
    });
  }, [activeTab?.data?.initialData]);

  const numericVariables = useMemo(() => {
    return variables.filter(v => v.type === 'number');
  }, [variables]);

  const categoricalVariables = useMemo(() => {
    return variables.filter(v => v.type === 'string');
  }, [variables]);

  const prepareData = () => {
    if (!activeTab?.data?.initialData || !groupingVariable || !dependentVariable) return {};

    const groupedData: Record<string, number[]> = {};

    activeTab.data.initialData.forEach((row: any) => {
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
    // Check if we have at least 2 groups
    if (Object.keys(groupedData).length < 2) {
      return 'ANOVA requires at least two groups.';
    }

    // Check if each group has at least 2 observations
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

      // Validate data
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

      const result: AnovaResult = await response.json();
      setResults(result);
    } catch (error) {
      console.error('Error calculating ANOVA:', error);
      setError(error instanceof Error ? error.message : 'Failed to calculate ANOVA');
    } finally {
      setIsLoading(false);
    }
  };

  const isSignificant = results && results.p_value < 0.05;

  return (
    <Dialog>
      {children}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>One-Way ANOVA Analysis</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-2">Grouping Variable</h3>
            <div className="max-h-60 overflow-y-auto">
              {categoricalVariables.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No categorical variables found</p>
              ) : (
                categoricalVariables.map(variable => (
                  <div
                    key={variable.name}
                    onClick={() => setGroupingVariable(variable.name)}
                    className={`p-2 cursor-pointer rounded ${
                      groupingVariable === variable.name
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

          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-2">Dependent Variable</h3>
            <div className="max-h-60 overflow-y-auto">
              {numericVariables.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No numeric variables found</p>
              ) : (
                numericVariables.map(variable => (
                  <div
                    key={variable.name}
                    onClick={() => setDependentVariable(variable.name)}
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
        </div>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {results && (
          <div className="mt-4 border rounded-lg p-4">
            <h3 className="font-medium mb-2">ANOVA Results</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                  <p className="text-sm font-medium">F-statistic</p>
                  <p className="text-lg">{results.f_statistic.toFixed(3)}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                  <p className="text-sm font-medium">p-value</p>
                  <p
                    className={`text-lg ${isSignificant ? 'text-green-600 dark:text-green-400' : ''}`}
                  >
                    {results.p_value < 0.001 ? '< 0.001' : results.p_value.toFixed(3)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                  <p className="text-sm font-medium">Between-group df</p>
                  <p className="text-lg">{results.df_between}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                  <p className="text-sm font-medium">Within-group df</p>
                  <p className="text-lg">{results.df_within}</p>
                </div>
              </div>

              <details className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                <summary className="font-medium cursor-pointer">Additional Statistics</summary>
                <div className="mt-2 space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="font-medium">Sum of Squares (Between)</p>
                      <p>{results.sum_squares_between.toFixed(3)}</p>
                    </div>
                    <div>
                      <p className="font-medium">Sum of Squares (Within)</p>
                      <p>{results.sum_squares_within.toFixed(3)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="font-medium">Mean Square (Between)</p>
                      <p>{results.mean_square_between.toFixed(3)}</p>
                    </div>
                    <div>
                      <p className="font-medium">Mean Square (Within)</p>
                      <p>{results.mean_square_within.toFixed(3)}</p>
                    </div>
                  </div>
                </div>
              </details>

              <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-md">
                <p className="font-medium">Conclusion:</p>
                <p>
                  {isSignificant
                    ? `There is a statistically significant difference between groups (F = ${results.f_statistic.toFixed(
                        2
                      )}, p ${results.p_value < 0.001 ? '< 0.001' : '= ' + results.p_value.toFixed(3)}).`
                    : `There is no statistically significant difference between groups (F = ${results.f_statistic.toFixed(
                        2
                      )}, p = ${results.p_value.toFixed(3)}).`}
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            onClick={calculateAnova}
            disabled={isLoading || !groupingVariable || !dependentVariable}
          >
            {isLoading ? <LuLoader className="h-4 w-4 animate-spin mr-2" /> : null}
            Calculate ANOVA
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
