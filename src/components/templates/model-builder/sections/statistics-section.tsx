import { useEffect, useState } from 'react';
import { useTabs } from '@/contexts/tabs-context';

// Type definitions
interface ModelNode {
  id: string;
  label: string;
  type: 'observed' | 'latent';
  x: number;
  y: number;
  variableName?: string;
  dataType?: string;
  missingHandling?: string;
  statistics?: Record<string, number>;
}

interface ModelFitIndices {
  cfi: number;
  rmsea: number;
  srmr: number;
}

interface VariableStatistics {
  mean: number;
  sd: number;
  n: number;
}

interface Statistics {
  variables: Record<string, VariableStatistics>;
  correlations: Record<string, Record<string, number>>;
  fit_indices?: ModelFitIndices;
}

interface AvailableVariable {
  name: string;
  statistics: {
    mean: number;
    sd: number;
    n: number;
  };
}

interface StatisticsSectionProps {
  selectedNode: ModelNode | null;
  modelFitIndices: ModelFitIndices | null;
  availableVariables: AvailableVariable[];
}

// Utility functions
const cleanNumericValue = (value: string | number | undefined): number | null => {
  if (value === undefined || value === null) return null;

  if (typeof value === 'number') return value;

  // Remove commas and any other non-numeric characters except decimal points and minus signs
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);

  return isNaN(parsed) ? null : parsed;
};

const calculateBasicStats = (values: number[]): VariableStatistics | null => {
  if (values.length === 0) return null;

  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(variance);

  return {
    mean,
    sd,
    n: values.length,
  };
};

// Main component
export const StatisticsSection = ({
  selectedNode,
  modelFitIndices,
  availableVariables,
}: StatisticsSectionProps) => {
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { state } = useTabs();
  const activeTab = state.tabs.find(tab => tab.id === state.activeTabId);

  useEffect(() => {
    let isMounted = true;

    const calculateStats = async (): Promise<void> => {
      if (!activeTab?.data?.filePath) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const selectedVariables = availableVariables.map(v => v.name);

        // Mock implementation until the actual API is implemented
        // In a real implementation, you would use fetch or another HTTP client
        const mockVariableStats: Record<string, VariableStatistics> = {};
        selectedVariables.forEach(varName => {
          const matchingVar = availableVariables.find(v => v.name === varName);
          if (matchingVar) {
            mockVariableStats[varName] = matchingVar.statistics;
          }
        });

        const mockCorrelations: Record<string, Record<string, number>> = {};
        selectedVariables.forEach(var1 => {
          mockCorrelations[var1] = {};
          selectedVariables.forEach(var2 => {
            if (var1 !== var2) {
              // Generate a random correlation value between -1 and 1
              mockCorrelations[var1][var2] = Math.round((Math.random() * 2 - 1) * 100) / 100;
            }
          });
        });

        const mockStats: Statistics = {
          variables: mockVariableStats,
          correlations: mockCorrelations,
          fit_indices: modelFitIndices || undefined,
        };

        // TODO: Replace with actual API call
        // const stats = await fetch('/api/statistics', {
        //   method: 'POST',
        //   headers: {
        //     'Content-Type': 'application/json',
        //   },
        //   body: JSON.stringify({
        //     csvPath: activeTab.data.filePath,
        //     selectedVariables,
        //   }),
        // });
        // const data = await stats.json();

        if (isMounted) {
          setStatistics(mockStats);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error calculating statistics:', err);
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    calculateStats();

    return () => {
      isMounted = false;
    };
  }, [activeTab?.data?.filePath, availableVariables, modelFitIndices]);

  // Calculate basic statistics from initialData if statistics hasn't been set
  useEffect(() => {
    if (!statistics && activeTab?.data?.initialData) {
      const data = activeTab.data.initialData;
      const basicStats: Record<string, VariableStatistics> = {};

      // Only process numeric columns
      const numericColumns = ['Value', 'Year'];

      numericColumns.forEach(column => {
        // Handle potential missing columns in the data
        if (data.length > 0 && data[0] && typeof data[0] === 'object') {
          // Check if the column exists in the data
          if (column in data[0]) {
            const values = data
              .map((row: any) => cleanNumericValue(row[column as keyof typeof row]))
              .filter((val: any): val is number => val !== null);

            const stats = calculateBasicStats(values);
            if (stats) {
              basicStats[column] = stats;
            }
          }
        }
      });

      setStatistics({
        variables: basicStats,
        correlations: {},
        fit_indices: modelFitIndices ?? undefined,
      });
    }
  }, [activeTab?.data?.initialData, statistics, modelFitIndices]);

  if (loading) {
    return (
      <div className="p-4">
        <div className="text-sm text-muted-foreground">Calculating statistics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-sm text-red-500">Error: {error}</div>
      </div>
    );
  }

  if (!selectedNode) {
    return (
      <div className="p-4 space-y-4">
        <h3 className="font-medium">Model Statistics</h3>
        {statistics?.fit_indices && (
          <div className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">CFI:</span> {statistics.fit_indices.cfi.toFixed(3)}
            </div>
            <div className="text-sm">
              <span className="font-medium">RMSEA:</span> {statistics.fit_indices.rmsea.toFixed(3)}
            </div>
            <div className="text-sm">
              <span className="font-medium">SRMR:</span> {statistics.fit_indices.srmr.toFixed(3)}
            </div>
          </div>
        )}

        {statistics?.variables && (
          <div className="mt-6">
            <h4 className="font-medium mb-2">Available Variables</h4>
            <div className="space-y-2">
              {Object.entries(statistics.variables).map(([varName, stats]) => (
                <div key={varName} className="text-sm">
                  <div className="font-medium">{varName}</div>
                  <div className="ml-4">
                    <div>Mean: {stats.mean.toFixed(3)}</div>
                    <div>SD: {stats.sd.toFixed(3)}</div>
                    <div>N: {stats.n}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Selected node view
  return (
    <div className="p-4 space-y-4">
      <h3 className="font-medium">{selectedNode.label} Statistics</h3>
      {selectedNode.type === 'observed' &&
        statistics?.variables &&
        selectedNode.label in statistics.variables && (
          <div className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">Mean:</span>{' '}
              {statistics.variables[selectedNode.label].mean.toFixed(3)}
            </div>
            <div className="text-sm">
              <span className="font-medium">SD:</span>{' '}
              {statistics.variables[selectedNode.label].sd.toFixed(3)}
            </div>
            <div className="text-sm">
              <span className="font-medium">N:</span> {statistics.variables[selectedNode.label].n}
            </div>
          </div>
        )}

      {selectedNode.type === 'latent' && (
        <div className="text-sm text-muted-foreground">
          Latent variable statistics will be calculated after model estimation.
        </div>
      )}
    </div>
  );
};
