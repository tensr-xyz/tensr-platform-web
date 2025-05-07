import { useTabs } from '@/contexts/tabs-context';
import { ReactNode, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/molecules/dialog';

interface AnovaProps {
  children: ReactNode;
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

    const groupedData: { [key: string]: number[] } = {};

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

  const calculateAnova = async () => {
    try {
      const groupedData = prepareData();

      // Mock the invoke function with a properly structured response
      // Original code:
      // const response = await invoke<AnovaResult>('calculate_anova', {
      //   groups: groupedData,
      // });

      // Mock response with appropriate typing
      const response: AnovaResult = {
        f_statistic: 3.456,
        p_value: 0.032,
        df_between: Object.keys(groupedData).length - 1,
        df_within:
          Object.values(groupedData).reduce((sum, group) => sum + group.length, 0) -
          Object.keys(groupedData).length,
        sum_squares_between: 42.5,
        sum_squares_within: 126.8,
        mean_square_between: 21.25,
        mean_square_within: 6.15,
      };

      setResults(response);
    } catch (error) {
      // You might want to handle errors here
      console.error('Error calculating ANOVA:', error);
    }
  };

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
              {categoricalVariables.map(variable => (
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
              ))}
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-2">Dependent Variable</h3>
            <div className="max-h-60 overflow-y-auto">
              {numericVariables.map(variable => (
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
              ))}
            </div>
          </div>
        </div>

        {results && (
          <div className="mt-4 border rounded-lg p-4">
            <h3 className="font-medium mb-2">ANOVA Results</h3>
            <table className="w-full">
              <tbody>
                <tr>
                  <td className="p-2 font-medium">F-statistic</td>
                  <td className="p-2">{results.f_statistic.toFixed(4)}</td>
                </tr>
                <tr>
                  <td className="p-2 font-medium">p-value</td>
                  <td className="p-2">{results.p_value.toFixed(4)}</td>
                </tr>
                <tr>
                  <td className="p-2 font-medium">Degrees of Freedom (Between)</td>
                  <td className="p-2">{results.df_between}</td>
                </tr>
                <tr>
                  <td className="p-2 font-medium">Degrees of Freedom (Within)</td>
                  <td className="p-2">{results.df_within}</td>
                </tr>
                <tr>
                  <td className="p-2 font-medium">Sum of Squares (Between)</td>
                  <td className="p-2">{results.sum_squares_between.toFixed(4)}</td>
                </tr>
                <tr>
                  <td className="p-2 font-medium">Sum of Squares (Within)</td>
                  <td className="p-2">{results.sum_squares_within.toFixed(4)}</td>
                </tr>
                <tr>
                  <td className="p-2 font-medium">Mean Square (Between)</td>
                  <td className="p-2">{results.mean_square_between.toFixed(4)}</td>
                </tr>
                <tr>
                  <td className="p-2 font-medium">Mean Square (Within)</td>
                  <td className="p-2">{results.mean_square_within.toFixed(4)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <button
            onClick={calculateAnova}
            disabled={!groupingVariable || !dependentVariable}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded-sm hover:bg-blue-600 disabled:opacity-50"
          >
            Calculate ANOVA
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
