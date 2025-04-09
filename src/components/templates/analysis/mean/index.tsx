import { useTabs } from '@/contexts/tabs-context';
import { ReactNode, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/molecules/dialog';

interface MeanProps {
  children: ReactNode;
}

interface Variable {
  name: string;
  type: string;
}

interface Stats {
  n: number;
  mean: number;
  std_dev: number;
}

interface Results {
  [key: string]: Stats;
}

export const Mean = ({ children }: MeanProps) => {
  const { state } = useTabs();
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);
  const [results, setResults] = useState<Results | null>(null);

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
      const response = {};
      // const response = await invoke<Results>('calculate_means', {
      //   variables: selectedVariables,
      //   data: data,
      // });
      setResults(response);
    } catch (error) {
      console.error('Failed to calculate means:', error);
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
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-2">Numeric Variables</h3>
            <div className="max-h-60 overflow-y-auto">
              {numericVariables.map(variable => (
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
              ))}
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-2">Selected Variables</h3>
            <div className="space-y-2">
              {selectedVariables.map(variable => (
                <div
                  key={variable}
                  className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-2 rounded"
                >
                  <span>{variable}</span>
                  <button
                    onClick={() => handleVariableSelect(variable)}
                    className="text-red-500 hover:text-red-700"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {results && (
          <div className="mt-4 border rounded-lg p-4">
            <h3 className="font-medium mb-2">Results</h3>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left p-2">Variable</th>
                  <th className="text-left p-2">N</th>
                  <th className="text-left p-2">Mean</th>
                  <th className="text-left p-2">Std. Deviation</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(results).map(([variable, stats]) => (
                  <tr key={variable}>
                    <td className="p-2">{variable}</td>
                    <td className="p-2">{stats.n}</td>
                    <td className="p-2">{stats.mean.toFixed(2)}</td>
                    <td className="p-2">{stats.std_dev.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <button
            onClick={calculateMeans}
            disabled={selectedVariables.length === 0}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Calculate
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
