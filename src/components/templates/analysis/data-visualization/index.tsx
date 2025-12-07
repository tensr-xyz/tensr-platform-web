import { useTabsStore } from '@/stores/tabs-store';
import { getIdToken } from '@/utils/auth';
import { ReactNode, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/molecules/dialog';
import { Button } from '@/components/atoms/button';
import { Loader, BarChart3, PieChart, TrendingUp, ScatterChart } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/atoms/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/molecules/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import useAuth from '@/hooks/api/use-auth';

// API base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_FARGATE_API_URL;

interface DataVisualizationProps {
  children: ReactNode;
}

interface Variable {
  name: string;
  type: string;
}

interface ChartRequest {
  chart_type: 'bar' | 'line' | 'scatter' | 'pie' | 'histogram' | 'boxplot';
  x_variable?: string;
  y_variable?: string;
  color_variable?: string;
  group_variable?: string;
  data: Record<string, (string | number)[]>;
  options?: {
    title?: string;
    x_label?: string;
    y_label?: string;
    color_scheme?: string;
    show_grid?: boolean;
    show_legend?: boolean;
  };
}

interface ChartResult {
  chart_data: any;
  chart_config: any;
  svg_content?: string;
  interpretation: string;
  report_content: string;
  report_timestamp: string;
}

interface ChartResponse {
  results: ChartResult;
}

export const DataVisualization = ({ children }: DataVisualizationProps) => {
  const { tabs, activeTabId } = useTabsStore();
  const [chartType, setChartType] = useState<
    'bar' | 'line' | 'scatter' | 'pie' | 'histogram' | 'boxplot'
  >('bar');
  const [xVariable, setXVariable] = useState<string>('');
  const [yVariable, setYVariable] = useState<string>('');
  const [colorVariable, setColorVariable] = useState<string>('');
  const [groupVariable, setGroupVariable] = useState<string>('');
  const [chartTitle, setChartTitle] = useState<string>('');
  const [xLabel, setXLabel] = useState<string>('');
  const [yLabel, setYLabel] = useState<string>('');
  const [results, setResults] = useState<ChartResult | null>(null);
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
    if (!activeDataTab?.data?.initialData) return {};

    const allVariables = [xVariable, yVariable, colorVariable, groupVariable].filter(Boolean);
    if (allVariables.length === 0) return {};

    return allVariables.reduce<{ [key: string]: (string | number)[] }>((acc, varName) => {
      if (!varName) return acc;

      const values = activeDataTab
        .data!.initialData!.map((row: { [x: string]: any }) => row[varName])
        .filter((val: string | null) => val != null && val !== '');

      acc[varName] = values;
      return acc;
    }, {});
  }, [activeDataTab?.data?.initialData, xVariable, yVariable, colorVariable, groupVariable]);

  const numericVariables = variables.filter(v => v.type === 'number');
  const categoricalVariables = variables.filter(v => v.type === 'string');

  const getChartIcon = (type: string) => {
    switch (type) {
      case 'bar':
        return <BarChart3 className="h-4 w-4" />;
      case 'line':
        return <TrendingUp className="h-4 w-4" />;
      case 'scatter':
        return <ScatterChart className="h-4 w-4" />;
      case 'pie':
        return <PieChart className="h-4 w-4" />;
      default:
        return <BarChart3 className="h-4 w-4" />;
    }
  };

  const createChart = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const chartRequest: ChartRequest = {
        chart_type: chartType,
        x_variable: xVariable,
        y_variable: yVariable,
        color_variable: colorVariable,
        group_variable: groupVariable,
        data: data,
        options: {
          title: chartTitle,
          x_label: xLabel,
          y_label: yLabel,
          show_grid: true,
          show_legend: true,
        },
      };

      // Make the API call to the backend
      const response = await fetch(`${API_BASE_URL}/api/visualization/create-chart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(chartRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to create chart');
      }

      const result: ChartResponse = await response.json();
      setResults(result.results);
      setActiveTab('results');
    } catch (error) {
      console.error('Failed to create chart:', error);
      setError(error instanceof Error ? error.message : 'Failed to create chart');
    } finally {
      setIsLoading(false);
    }
  };

  const renderChartPreview = () => {
    if (!results) return null;

    return (
      <div className="space-y-4">
        {results.svg_content && (
          <div
            className="border border-border rounded-lg p-4"
            dangerouslySetInnerHTML={{ __html: results.svg_content }}
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle>Chart Configuration</CardTitle>
            <CardDescription>Generated chart settings and data</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-4 rounded overflow-auto">
              {JSON.stringify(results.chart_config, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    );
  };

  const getVariableOptions = (variableType: 'x' | 'y' | 'color' | 'group') => {
    switch (variableType) {
      case 'x':
        return chartType === 'scatter' || chartType === 'line' ? numericVariables : variables;
      case 'y':
        return numericVariables;
      case 'color':
      case 'group':
        return categoricalVariables;
      default:
        return variables;
    }
  };

  const isChartValid = () => {
    switch (chartType) {
      case 'bar':
      case 'line':
        return xVariable && yVariable;
      case 'scatter':
        return xVariable && yVariable;
      case 'pie':
        return xVariable && yVariable;
      case 'histogram':
        return yVariable;
      case 'boxplot':
        return yVariable && groupVariable;
      default:
        return false;
    }
  };

  return (
    <Dialog>
      {children}
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Data Visualization</DialogTitle>
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
                <h3 className="font-medium mb-2">Chart Type</h3>
                <div className="grid grid-cols-2 gap-2">
                  {(['bar', 'line', 'scatter', 'pie', 'histogram', 'boxplot'] as const).map(
                    type => (
                      <div
                        key={type}
                        onClick={() => setChartType(type)}
                        className={`p-3 border rounded-lg cursor-pointer flex items-center gap-2 ${
                          chartType === type
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {getChartIcon(type)}
                        <span className="capitalize">{type}</span>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="border border-border rounded-lg p-4">
                <h3 className="font-medium mb-2">Chart Options</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Chart Title:</label>
                    <input
                      type="text"
                      value={chartTitle}
                      onChange={e => setChartTitle(e.target.value)}
                      className="w-full mt-1 p-2 border border-border rounded text-sm"
                      placeholder="Enter chart title..."
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">X-Axis Label:</label>
                    <input
                      type="text"
                      value={xLabel}
                      onChange={e => setXLabel(e.target.value)}
                      className="w-full mt-1 p-2 border border-border rounded text-sm"
                      placeholder="Enter X-axis label..."
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Y-Axis Label:</label>
                    <input
                      type="text"
                      value={yLabel}
                      onChange={e => setYLabel(e.target.value)}
                      className="w-full mt-1 p-2 border border-border rounded text-sm"
                      placeholder="Enter Y-axis label..."
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="border border-border rounded-lg p-4">
                <h3 className="font-medium mb-2">X Variable</h3>
                <Select value={xVariable} onValueChange={setXVariable}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select X variable" />
                  </SelectTrigger>
                  <SelectContent>
                    {getVariableOptions('x').map(variable => (
                      <SelectItem key={variable.name} value={variable.name}>
                        {variable.name} ({variable.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border border-border rounded-lg p-4">
                <h3 className="font-medium mb-2">Y Variable</h3>
                <Select value={yVariable} onValueChange={setYVariable}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Y variable" />
                  </SelectTrigger>
                  <SelectContent>
                    {getVariableOptions('y').map(variable => (
                      <SelectItem key={variable.name} value={variable.name}>
                        {variable.name} ({variable.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(chartType === 'bar' || chartType === 'scatter') && (
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-border rounded-lg p-4">
                  <h3 className="font-medium mb-2">Color Variable (Optional)</h3>
                  <Select value={colorVariable} onValueChange={setColorVariable}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select color variable" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {getVariableOptions('color').map(variable => (
                        <SelectItem key={variable.name} value={variable.name}>
                          {variable.name} ({variable.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border border-border rounded-lg p-4">
                  <h3 className="font-medium mb-2">Group Variable (Optional)</h3>
                  <Select value={groupVariable} onValueChange={setGroupVariable}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select group variable" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {getVariableOptions('group').map(variable => (
                        <SelectItem key={variable.name} value={variable.name}>
                          {variable.name} ({variable.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                onClick={createChart}
                disabled={!isChartValid() || isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Creating Chart...
                  </>
                ) : (
                  'Create Chart'
                )}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="results" className="space-y-4">
            {results && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Chart Preview</CardTitle>
                    <CardDescription>Generated visualization</CardDescription>
                  </CardHeader>
                  <CardContent>{renderChartPreview()}</CardContent>
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
                  <CardTitle>Visualization Report</CardTitle>
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
