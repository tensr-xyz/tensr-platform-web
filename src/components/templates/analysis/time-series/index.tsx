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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/molecules/tabs';
import { apiClient } from '@/lib/api-client';
import { useTabsStore } from '@/stores/tabs-store';
import { useToast } from '@/hooks/ui/use-toast';
import { getNumericColumns } from '@/utils/data-utils';

interface TimeSeriesProps {
  children: React.ReactNode;
}

interface TimeSeriesRequest {
  data: number[];
  method: 'arima' | 'exponential' | 'seasonal';
  parameters: {
    p?: number;
    d?: number;
    q?: number;
    seasonal_p?: number;
    seasonal_d?: number;
    seasonal_q?: number;
    seasonal_period?: number;
    forecast_periods?: number;
    alpha?: number;
    beta?: number;
    gamma?: number;
    decomposition_type?: string;
  };
  options: {
    auto_arima?: boolean;
    aic_selection?: boolean;
    residual_analysis?: boolean;
    holt_winters?: boolean;
    damped_trend?: boolean;
    auto_parameters?: boolean;
    trend_component?: boolean;
    seasonal_component?: boolean;
    residual_component?: boolean;
    seasonal_adjustment?: boolean;
  };
}

export const TimeSeries = ({ children }: TimeSeriesProps): React.JSX.Element => {
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = tabs.find(tab => tab.id === activeTabId);
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [activeMethod, setActiveMethod] = useState<'arima' | 'exponential' | 'seasonal'>('arima');

  const [formData, setFormData] = useState<TimeSeriesRequest>({
    data: [],
    method: 'arima',
    parameters: {
      p: 1,
      d: 1,
      q: 1,
      seasonal_p: 0,
      seasonal_d: 0,
      seasonal_q: 0,
      seasonal_period: 12,
      forecast_periods: 10,
      alpha: 0.3,
      beta: 0.1,
      gamma: 0.1,
      decomposition_type: 'additive',
    },
    options: {
      auto_arima: false,
      aic_selection: false,
      residual_analysis: true,
      holt_winters: true,
      damped_trend: false,
      auto_parameters: false,
      trend_component: true,
      seasonal_component: true,
      residual_component: true,
      seasonal_adjustment: false,
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

      // Find time series column (first numeric column)
      const numericColumns = getNumericColumns(data.initialColumns, data.initialData);

      if (numericColumns.length === 0) {
        toast({
          title: 'Error',
          description: 'No numeric columns found for time series analysis',
          variant: 'destructive',
        });
        return;
      }

      // Use the first numeric column as time series
      const timeSeriesColumn = numericColumns[0];
      const timeSeriesData = (data.initialData as any[])
        .map((row: any) => {
          const value = parseFloat(row[timeSeriesColumn.id]);
          return isNaN(value) ? null : value;
        })
        .filter((val: any) => val !== null);

      if (timeSeriesData.length < 10) {
        toast({
          title: 'Error',
          description: 'Time series data must have at least 10 observations',
          variant: 'destructive',
        });
        return;
      }

      let result;
      switch (activeMethod) {
        case 'arima':
          result = await apiClient.analysis.arima({
            data: timeSeriesData,
            parameters: {
              p: formData.parameters.p || 1,
              d: formData.parameters.d || 1,
              q: formData.parameters.q || 1,
              seasonal_p: formData.parameters.seasonal_p || 0,
              seasonal_d: formData.parameters.seasonal_d || 0,
              seasonal_q: formData.parameters.seasonal_q || 0,
              seasonal_period: formData.parameters.seasonal_period || 12,
              forecast_periods: formData.parameters.forecast_periods || 10,
            },
          });
          break;
        case 'exponential':
          result = await apiClient.analysis.exponentialSmoothing({
            data: timeSeriesData,
            parameters: {
              alpha: formData.parameters.alpha || 0.3,
              beta: formData.parameters.beta || 0.1,
              gamma: formData.parameters.gamma || 0.1,
              seasonal_period: formData.parameters.seasonal_period || 12,
              forecast_periods: formData.parameters.forecast_periods || 10,
            },
          });
          break;
        case 'seasonal':
          result = await apiClient.analysis.seasonalDecomposition({
            data: timeSeriesData,
            parameters: {
              seasonal_period: formData.parameters.seasonal_period || 12,
              decomposition_type: formData.parameters.decomposition_type || 'additive',
            },
          });
          break;
        default:
          throw new Error('Invalid time series method');
      }

      setResults(result);
      toast({
        title: 'Success',
        description: `${activeMethod.toUpperCase()} analysis completed successfully!`,
      });
    } catch (error) {
      console.error('Time series analysis error:', error);
      toast({
        title: 'Error',
        description: 'Time series analysis failed. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleParameterChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [field]: value,
      },
    }));
  };

  const handleOptionChange = (field: string, value: boolean) => {
    setFormData(prev => ({
      ...prev,
      options: {
        ...prev.options,
        [field]: value,
      },
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {children}
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Time Series Analysis</DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeMethod}
          onValueChange={value => setActiveMethod(value as any)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="arima">ARIMA</TabsTrigger>
            <TabsTrigger value="exponential">Exponential Smoothing</TabsTrigger>
            <TabsTrigger value="seasonal">Seasonal Decomposition</TabsTrigger>
          </TabsList>

          <TabsContent value="arima" className="space-y-4">
            <div>
              <Label htmlFor="time_series">Time Series Variable</Label>
              <div className="text-sm text-muted-foreground mb-2">
                Using first numeric column:{' '}
                {activeTab?.data?.initialColumns?.find(
                  (col: any) => col.type === 'number' || col.type === 'numeric'
                )?.header || 'None'}
              </div>
              <Select disabled>
                <SelectTrigger>
                  <SelectValue placeholder="First numeric column will be used" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-select</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="p">AR Order (p)</Label>
                <Input
                  id="p"
                  type="number"
                  min="0"
                  max="10"
                  value={formData.parameters.p}
                  onChange={e => handleParameterChange('p', parseInt(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="d">Difference Order (d)</Label>
                <Input
                  id="d"
                  type="number"
                  min="0"
                  max="3"
                  value={formData.parameters.d}
                  onChange={e => handleParameterChange('d', parseInt(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="q">MA Order (q)</Label>
                <Input
                  id="q"
                  type="number"
                  min="0"
                  max="10"
                  value={formData.parameters.q}
                  onChange={e => handleParameterChange('q', parseInt(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="seasonal_p">Seasonal AR Order (P)</Label>
                <Input
                  id="seasonal_p"
                  type="number"
                  min="0"
                  max="5"
                  value={formData.parameters.seasonal_p}
                  onChange={e => handleParameterChange('seasonal_p', parseInt(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="seasonal_d">Seasonal Difference (D)</Label>
                <Input
                  id="seasonal_d"
                  type="number"
                  min="0"
                  max="3"
                  value={formData.parameters.seasonal_d}
                  onChange={e => handleParameterChange('seasonal_d', parseInt(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="seasonal_q">Seasonal MA Order (Q)</Label>
                <Input
                  id="seasonal_q"
                  type="number"
                  min="0"
                  max="5"
                  value={formData.parameters.seasonal_q}
                  onChange={e => handleParameterChange('seasonal_q', parseInt(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="seasonal_period">Seasonal Period</Label>
                <Input
                  id="seasonal_period"
                  type="number"
                  min="2"
                  value={formData.parameters.seasonal_period}
                  onChange={e => handleParameterChange('seasonal_period', parseInt(e.target.value))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="forecast_periods">Forecast Periods</Label>
              <Input
                id="forecast_periods"
                type="number"
                min="1"
                max="100"
                value={formData.parameters.forecast_periods}
                onChange={e => handleParameterChange('forecast_periods', parseInt(e.target.value))}
              />
            </div>

            <div>
              <Label>ARIMA Options</Label>
              <div className="space-y-2 mt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="auto_arima"
                    checked={formData.options.auto_arima}
                    onCheckedChange={checked =>
                      handleOptionChange('auto_arima', checked as boolean)
                    }
                  />
                  <Label htmlFor="auto_arima">Auto ARIMA (Best Model Selection)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="aic_selection"
                    checked={formData.options.aic_selection}
                    onCheckedChange={checked =>
                      handleOptionChange('aic_selection', checked as boolean)
                    }
                  />
                  <Label htmlFor="aic_selection">AIC-based Model Selection</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="residual_analysis"
                    checked={formData.options.residual_analysis}
                    onCheckedChange={checked =>
                      handleOptionChange('residual_analysis', checked as boolean)
                    }
                  />
                  <Label htmlFor="residual_analysis">Residual Analysis</Label>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="exponential" className="space-y-4">
            <div>
              <Label htmlFor="smoothing_variable">Time Series Variable</Label>
              <div className="text-sm text-muted-foreground mb-2">
                Using first numeric column:{' '}
                {getNumericColumns(
                  activeTab?.data?.initialColumns || [],
                  activeTab?.data?.initialData || []
                )[0]?.header || 'None'}
              </div>
              <Select disabled>
                <SelectTrigger>
                  <SelectValue placeholder="First numeric column will be used" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-select</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="alpha">Alpha (α) - Level</Label>
                <Input
                  id="alpha"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={formData.parameters.alpha}
                  onChange={e => handleParameterChange('alpha', parseFloat(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="beta">Beta (β) - Trend</Label>
                <Input
                  id="beta"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={formData.parameters.beta}
                  onChange={e => handleParameterChange('beta', parseFloat(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="gamma">Gamma (γ) - Seasonality</Label>
                <Input
                  id="gamma"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={formData.parameters.gamma}
                  onChange={e => handleParameterChange('gamma', parseFloat(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="seasonal_period_es">Seasonal Period</Label>
                <Input
                  id="seasonal_period_es"
                  type="number"
                  min="2"
                  value={formData.parameters.seasonal_period}
                  onChange={e => handleParameterChange('seasonal_period', parseInt(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="forecast_periods_es">Forecast Periods</Label>
                <Input
                  id="forecast_periods_es"
                  type="number"
                  min="1"
                  max="100"
                  value={formData.parameters.forecast_periods}
                  onChange={e =>
                    handleParameterChange('forecast_periods', parseInt(e.target.value))
                  }
                />
              </div>
            </div>

            <div>
              <Label>Exponential Smoothing Options</Label>
              <div className="space-y-2 mt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="holt_winters"
                    checked={formData.options.holt_winters}
                    onCheckedChange={checked =>
                      handleOptionChange('holt_winters', checked as boolean)
                    }
                  />
                  <Label htmlFor="holt_winters">Holt-Winters Method</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="damped_trend"
                    checked={formData.options.damped_trend}
                    onCheckedChange={checked =>
                      handleOptionChange('damped_trend', checked as boolean)
                    }
                  />
                  <Label htmlFor="damped_trend">Damped Trend</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="auto_parameters"
                    checked={formData.options.auto_parameters}
                    onCheckedChange={checked =>
                      handleOptionChange('auto_parameters', checked as boolean)
                    }
                  />
                  <Label htmlFor="auto_parameters">Auto-optimize Parameters</Label>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="seasonal" className="space-y-4">
            <div>
              <Label htmlFor="decomposition_variable">Time Series Variable</Label>
              <div className="text-sm text-muted-foreground mb-2">
                Using first numeric column:{' '}
                {getNumericColumns(
                  activeTab?.data?.initialColumns || [],
                  activeTab?.data?.initialData || []
                )[0]?.header || 'None'}
              </div>
              <Select disabled>
                <SelectTrigger>
                  <SelectValue placeholder="First numeric column will be used" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-select</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="decomposition_period">Seasonal Period</Label>
                <Input
                  id="decomposition_period"
                  type="number"
                  min="2"
                  value={formData.parameters.seasonal_period}
                  onChange={e => handleParameterChange('seasonal_period', parseInt(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="decomposition_type">Decomposition Type</Label>
                <Select
                  value={formData.parameters.decomposition_type}
                  onValueChange={value => handleParameterChange('decomposition_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="additive">Additive</SelectItem>
                    <SelectItem value="multiplicative">Multiplicative</SelectItem>
                    <SelectItem value="auto">Auto-detect</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Decomposition Options</Label>
              <div className="space-y-2 mt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="trend_component"
                    checked={formData.options.trend_component}
                    onCheckedChange={checked =>
                      handleOptionChange('trend_component', checked as boolean)
                    }
                  />
                  <Label htmlFor="trend_component">Trend Component</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="seasonal_component"
                    checked={formData.options.seasonal_component}
                    onCheckedChange={checked =>
                      handleOptionChange('seasonal_component', checked as boolean)
                    }
                  />
                  <Label htmlFor="seasonal_component">Seasonal Component</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="residual_component"
                    checked={formData.options.residual_component}
                    onCheckedChange={checked =>
                      handleOptionChange('residual_component', checked as boolean)
                    }
                  />
                  <Label htmlFor="residual_component">Residual Component</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="seasonal_adjustment"
                    checked={formData.options.seasonal_adjustment}
                    onCheckedChange={checked =>
                      handleOptionChange('seasonal_adjustment', checked as boolean)
                    }
                  />
                  <Label htmlFor="seasonal_adjustment">Seasonally Adjusted Series</Label>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {results && (
          <div className="border rounded-lg p-4 bg-muted/50">
            <h3 className="font-semibold mb-2">Time Series Analysis Results</h3>
            <pre className="text-sm overflow-auto max-h-40">{JSON.stringify(results, null, 2)}</pre>
          </div>
        )}

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleRunAnalysis} disabled={isLoading}>
            {isLoading ? 'Running Analysis...' : 'Run Time Series Analysis'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
