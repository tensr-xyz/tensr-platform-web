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

// API base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_FARGATE_API_URL;

interface MeanProps {
  children: ReactNode;
}

interface Variable {
  name: string;
  type: string;
}

interface DescriptiveStats {
  n: number;
  mean: number;
  std_dev: number;
  min?: number;
  max?: number;
  median?: number;
}

interface MeansRequest {
  variables: string[];
  data: Record<string, number[]>;
}

type Results = Record<string, DescriptiveStats>;

export const Mean = ({ children }: MeanProps) => {
  const { state } = useTabs();
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);
  const [results, setResults] = useState<Results | null>(null);
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

  // Extract data for calculations
  const data = useMemo(() => {
    if (!activeTab?.data?.initialData || !selectedVariables.length) return {};

    return selectedVariables.reduce<{ [key: string]: number[] }>((acc, varName) => {
      const values = activeTab.data.initialData
        .map((row: { [x: string]: any }) => {
          const val = row[varName];
          return typeof val === 'number' ? val : parseFloat(val);
        })
        .filter((val: number) => !isNaN(val));

      acc[varName] = values;
      return acc;
    }, {});
  }, [activeTab?.data?.initialData, selectedVariables]);

  const handleVariableSelect = (variable: string) => {
    if (selectedVariables.includes(variable)) {
      setSelectedVariables(selectedVariables.filter(v => v !== variable));
    } else {
      setSelectedVariables([...selectedVariables, variable]);
    }
  };

  const calculateMeans = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const meansRequest: MeansRequest = {
        variables: selectedVariables,
        data: data,
      };

      // Make the API call to the backend
      const response = await fetch(`${API_BASE_URL}/api/statistics/calculate-means`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(meansRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to calculate means');
      }

      const result: Results = await response.json();
      setResults(result);
    } catch (error) {
      console.error('Failed to calculate means:', error);
      setError(error instanceof Error ? error.message : 'Failed to calculate means');
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

  return (
    <Dialog>
      {children}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Means Analysis</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
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
        </div>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {results && (
          <div className="mt-4 border border-border rounded-lg p-4">
            <h3 className="font-medium mb-2">Results</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-2">Variable</th>
                    <th className="text-left p-2">N</th>
                    <th className="text-left p-2">Mean</th>
                    <th className="text-left p-2">Std. Deviation</th>
                    {results[Object.keys(results)[0]]?.min !== undefined && (
                      <th className="text-left p-2">Min</th>
                    )}
                    {results[Object.keys(results)[0]]?.median !== undefined && (
                      <th className="text-left p-2">Median</th>
                    )}
                    {results[Object.keys(results)[0]]?.max !== undefined && (
                      <th className="text-left p-2">Max</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(results).map(([variable, stats]) => (
                    <tr key={variable} className="border-b border-border">
                      <td className="p-2">{variable}</td>
                      <td className="p-2">{stats.n}</td>
                      <td className="p-2">{stats.mean.toFixed(2)}</td>
                      <td className="p-2">{stats.std_dev.toFixed(2)}</td>
                      {stats.min !== undefined && <td className="p-2">{stats.min.toFixed(2)}</td>}
                      {stats.median !== undefined && (
                        <td className="p-2">{stats.median.toFixed(2)}</td>
                      )}
                      {stats.max !== undefined && <td className="p-2">{stats.max.toFixed(2)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button onClick={calculateMeans} disabled={isLoading || selectedVariables.length === 0}>
            {isLoading ? <LuLoader className="h-4 w-4 animate-spin mr-2" /> : null}
            Calculate Means
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
