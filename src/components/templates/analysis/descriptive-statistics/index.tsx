import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/molecules/dialog';
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
import { Checkbox } from '@/components/atoms/checkbox';
import { apiClient } from '@/lib/api-client';
import { useTabsStore } from '@/stores/tabs-store';
import { useToast } from '@/hooks/ui/use-toast';
import { getNumericColumns } from '@/utils/data-utils';

interface DescriptiveStatisticsProps {
  children: React.ReactNode;
}

interface DescriptiveStatisticsRequest {
  data: number[][];
  variables: string[];
  statistics: {
    mean: boolean;
    median: boolean;
    mode: boolean;
    std: boolean;
    variance: boolean;
    range: boolean;
    minmax: boolean;
    sum: boolean;
  };
  percentiles: {
    quartiles: boolean;
    custom: boolean;
    iqr: boolean;
  };
  options: {
    normality: boolean;
    outliers: boolean;
    z_scores: boolean;
    missing_values: boolean;
  };
  output: {
    tables: boolean;
    charts: boolean;
    export: boolean;
  };
}

export const DescriptiveStatistics = ({
  children,
}: DescriptiveStatisticsProps): React.JSX.Element => {
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = tabs.find(tab => tab.id === activeTabId);
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const [formData, setFormData] = useState<DescriptiveStatisticsRequest>({
    data: [],
    variables: [],
    statistics: {
      mean: true,
      median: true,
      mode: false,
      std: true,
      variance: false,
      range: false,
      minmax: false,
      sum: false,
    },
    percentiles: {
      quartiles: true,
      custom: false,
      iqr: false,
    },
    options: {
      normality: false,
      outliers: false,
      z_scores: false,
      missing_values: true,
    },
    output: {
      tables: true,
      charts: false,
      export: false,
    },
  });

  const handleRunAnalysis = async () => {
    if (!activeTab?.data?.initialData || !activeTab?.data?.initialColumns) {
      toast({
        title: 'Error',
        description: 'No data available for analysis',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      // Ensure data is defined after the guard
      const data = activeTab.data;
      if (!data.initialData || !data.initialColumns) {
        toast({
          title: 'Error',
          description: 'Data structure is invalid',
          variant: 'destructive',
        });
        return;
      }

      // Prepare data for analysis
      const numericColumns = getNumericColumns(data.initialColumns, data.initialData);

      if (numericColumns.length === 0) {
        toast({
          title: 'Error',
          description: 'No numeric columns found for analysis',
          variant: 'destructive',
        });
        return;
      }

      // Extract numeric data - now we know data.initialData is defined
      const numericData = numericColumns.map((col: any) =>
        (data.initialData as any[])
          .map((row: any) => {
            const value = parseFloat(row[col.id]);
            return isNaN(value) ? null : value;
          })
          .filter((val: any) => val !== null)
      );

      const requestData = {
        ...formData,
        data: numericData,
        variables: numericColumns.map((col: any) => col.header),
      };

      const result = await apiClient.statistics.comprehensiveDescriptives(requestData);
      setResults(result);
      toast({
        title: 'Success',
        description: 'Analysis completed successfully!',
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: 'Error',
        description: 'Analysis failed. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckboxChange = (
    category: keyof DescriptiveStatisticsRequest,
    field: string,
    value: boolean
  ) => {
    setFormData(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value,
      },
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {children}
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Descriptive Statistics</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="variables">Variables</Label>
              <div className="text-sm text-muted-foreground mb-2">
                {
                  getNumericColumns(
                    activeTab?.data?.initialColumns || [],
                    activeTab?.data?.initialData || []
                  ).length
                }{' '}
                numeric variables available
              </div>
              <Select disabled>
                <SelectTrigger>
                  <SelectValue placeholder="All numeric variables will be analyzed" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Numeric Variables</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="statistics">Statistics</Label>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="mean"
                      checked={formData.statistics.mean}
                      onCheckedChange={checked =>
                        handleCheckboxChange('statistics', 'mean', checked as boolean)
                      }
                    />
                    <Label htmlFor="mean">Mean</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="median"
                      checked={formData.statistics.median}
                      onCheckedChange={checked =>
                        handleCheckboxChange('statistics', 'median', checked as boolean)
                      }
                    />
                    <Label htmlFor="median">Median</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="mode"
                      checked={formData.statistics.mode}
                      onCheckedChange={checked =>
                        handleCheckboxChange('statistics', 'mode', checked as boolean)
                      }
                    />
                    <Label htmlFor="mode">Mode</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="std"
                      checked={formData.statistics.std}
                      onCheckedChange={checked =>
                        handleCheckboxChange('statistics', 'std', checked as boolean)
                      }
                    />
                    <Label htmlFor="std">Standard Deviation</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="variance"
                      checked={formData.statistics.variance}
                      onCheckedChange={checked =>
                        handleCheckboxChange('statistics', 'variance', checked as boolean)
                      }
                    />
                    <Label htmlFor="variance">Variance</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="range"
                      checked={formData.statistics.range}
                      onCheckedChange={checked =>
                        handleCheckboxChange('statistics', 'range', checked as boolean)
                      }
                    />
                    <Label htmlFor="range">Range</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="minmax"
                      checked={formData.statistics.minmax}
                      onCheckedChange={checked =>
                        handleCheckboxChange('statistics', 'minmax', checked as boolean)
                      }
                    />
                    <Label htmlFor="minmax">Minimum & Maximum</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="sum"
                      checked={formData.statistics.sum}
                      onCheckedChange={checked =>
                        handleCheckboxChange('statistics', 'sum', checked as boolean)
                      }
                    />
                    <Label htmlFor="sum">Sum</Label>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="percentiles">Percentiles</Label>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="quartiles"
                      checked={formData.percentiles.quartiles}
                      onCheckedChange={checked =>
                        handleCheckboxChange('percentiles', 'quartiles', checked as boolean)
                      }
                    />
                    <Label htmlFor="quartiles">Quartiles (25, 50, 75)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="percentiles_custom"
                      checked={formData.percentiles.custom}
                      onCheckedChange={checked =>
                        handleCheckboxChange('percentiles', 'custom', checked as boolean)
                      }
                    />
                    <Label htmlFor="percentiles_custom">Custom Percentiles</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="iqr"
                      checked={formData.percentiles.iqr}
                      onCheckedChange={checked =>
                        handleCheckboxChange('percentiles', 'iqr', checked as boolean)
                      }
                    />
                    <Label htmlFor="iqr">Interquartile Range</Label>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="options">Additional Options</Label>
              <div className="space-y-2 mt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="normality"
                    checked={formData.options.normality}
                    onCheckedChange={checked =>
                      handleCheckboxChange('options', 'normality', checked as boolean)
                    }
                  />
                  <Label htmlFor="normality">Normality Tests</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="outliers"
                    checked={formData.options.outliers}
                    onCheckedChange={checked =>
                      handleCheckboxChange('options', 'outliers', checked as boolean)
                    }
                  />
                  <Label htmlFor="outliers">Outlier Detection</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="z_scores"
                    checked={formData.options.z_scores}
                    onCheckedChange={checked =>
                      handleCheckboxChange('options', 'z_scores', checked as boolean)
                    }
                  />
                  <Label htmlFor="z_scores">Z-Scores</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="missing_values"
                    checked={formData.options.missing_values}
                    onCheckedChange={checked =>
                      handleCheckboxChange('options', 'missing_values', checked as boolean)
                    }
                  />
                  <Label htmlFor="missing_values">Missing Value Analysis</Label>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="output">Output Options</Label>
              <div className="space-y-2 mt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="tables"
                    checked={formData.output.tables}
                    onCheckedChange={checked =>
                      handleCheckboxChange('output', 'tables', checked as boolean)
                    }
                  />
                  <Label htmlFor="tables">Tables</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="charts"
                    checked={formData.output.charts}
                    onCheckedChange={checked =>
                      handleCheckboxChange('output', 'charts', checked as boolean)
                    }
                  />
                  <Label htmlFor="charts">Charts</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="export"
                    checked={formData.output.export}
                    onCheckedChange={checked =>
                      handleCheckboxChange('output', 'export', checked as boolean)
                    }
                  />
                  <Label htmlFor="export">Export Results</Label>
                </div>
              </div>
            </div>
          </div>

          {results && (
            <div className="border rounded-lg p-4 bg-muted/50">
              <h3 className="font-semibold mb-2">Analysis Results</h3>
              <pre className="text-sm overflow-auto max-h-40">
                {JSON.stringify(results, null, 2)}
              </pre>
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRunAnalysis} disabled={isLoading}>
              {isLoading ? 'Running Analysis...' : 'Run Analysis'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
