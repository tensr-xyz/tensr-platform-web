import { useTabs } from '@/contexts/tabs-context';
import { ReactNode, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/molecules/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/atoms/alert';
import { FileText } from 'lucide-react';
import { Line, LineChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { useProject } from '@/contexts/project-context';

interface TTestProps {
  children: ReactNode;
}

interface TTestResult {
  t_statistic: number;
  p_value: number;
  degrees_of_freedom: number;
  mean_difference: number;
  sample_mean: number;
  sample_size: number;
  confidence_interval: [number, number] | null;
}

interface ReportMetadata {
  analysis_type: string;
  timestamp: string;
  output_path: string;
}

export const OneSampleTTest = ({ children }: TTestProps) => {
  const { state } = useTabs();
  const { state: projectState } = useProject();
  const [selectedVariable, setSelectedVariable] = useState<string>('');
  const [hypothesizedMean, setHypothesizedMean] = useState<string>('');
  const [confidenceLevel, setConfidenceLevel] = useState<string>('0.95');
  const [results, setResults] = useState<TTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportMetadata, setReportMetadata] = useState<ReportMetadata | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const activeTab = useMemo(
    () => state.tabs.find(tab => tab.id === state.activeTabId),
    [state.tabs, state.activeTabId]
  );

  const variables = useMemo(() => {
    if (!activeTab?.data?.initialData?.[0]) return [];

    const columnNames = Object.keys(activeTab.data.initialData[0]).filter(key => key !== 'id');

    return columnNames.map(colName => {
      const sampleValues = activeTab.data.initialData
        .slice(0, 5)
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
  }, [activeTab?.data?.initialData]);

  const numericVariables = useMemo(() => {
    return variables.filter(v => v.type === 'number');
  }, [variables]);

  const prepareData = () => {
    if (!activeTab?.data?.initialData || !selectedVariable) return [];

    return activeTab.data.initialData
      .map((row: any) => {
        const value =
          typeof row[selectedVariable] === 'number'
            ? row[selectedVariable]
            : parseFloat(row[selectedVariable]);
        return !isNaN(value) ? value : null;
      })
      .filter((value: number | null): value is number => value !== null);
  };

  const generateHistogramData = (data: number[]) => {
    // Create histogram data for visualization
    const bins = 20;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const binWidth = (max - min) / bins;

    const histogram = Array(bins).fill(0);
    data.forEach(value => {
      const binIndex = Math.min(Math.floor((value - min) / binWidth), bins - 1);
      histogram[binIndex]++;
    });

    return histogram.map((count, i) => ({
      value: min + (i + 0.5) * binWidth,
      frequency: count,
    }));
  };

  const calculateTTest = async () => {
    try {
      const sample = prepareData();
      if (sample.length < 2) {
        throw new Error('Sample size must be at least 2');
      }

      // Check if all values are the same
      const allSame = sample.every((val: any) => val === sample[0]);
      if (allSame) {
        throw new Error('Cannot perform t-test: All values are identical');
      }

      // Step 1: Calculate t-test
      const response = {};
      // const response = await invoke<TTestResult>('calculate_one_sample_ttest', {
      //   sample,
      //   hypothesizedMean: parseFloat(hypothesizedMean),
      //   confidenceLevel: parseFloat(confidenceLevel),
      // });

      if (!response) {
        throw new Error('Failed to calculate t-test: No response received');
      }

      setResults(response);

      // Step 2: Wait for state update and chart render
      await new Promise(resolve => setTimeout(resolve, 250));

      // Step 3: Capture chart SVG
      const chartSvg = captureChartSvg();
      if (!chartSvg) {
        throw new Error('Failed to capture chart visualization');
      }

      // Step 4: Generate report
      const metadata = await invoke<ReportMetadata>('generate_ttest_report', {
        projectPath: projectState.currentProject?.path || '',
        results: response,
        variableName: selectedVariable,
        hypothesizedMean: parseFloat(hypothesizedMean),
        visualizations: [
          {
            plot_type: 'Distribution Plot',
            svg_content: chartSvg,
            caption: `Distribution of ${selectedVariable} with hypothesized mean (${hypothesizedMean})`,
          },
        ],
      });

      setReportMetadata(metadata);
    } catch (error) {
      // Add an error state to show to the user
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    }
  };

  // Updated captureChartSvg function
  const captureChartSvg = (): string => {
    if (!chartRef.current) return '';
    const svg = chartRef.current.querySelector('svg');
    if (!svg) return '';

    // Clone the SVG to avoid modifying the original
    const clonedSvg = svg.cloneNode(true) as SVGElement;

    // Add any needed SVG attributes
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    // Get computed styles and apply them inline for better rendering
    const styles = window.getComputedStyle(svg);
    clonedSvg.style.backgroundColor = styles.backgroundColor;

    return clonedSvg.outerHTML;
  };

  return (
    <Dialog>
      {children}
      <DialogContent className="max-w-4xl max-h-96 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>One-Sample T-Test Analysis</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-2">Test Variable</h3>
            <div className="max-h-60 overflow-y-auto">
              {numericVariables.map(variable => (
                <div
                  key={variable.name}
                  onClick={() => setSelectedVariable(variable.name)}
                  className={`p-2 cursor-pointer rounded ${
                    selectedVariable === variable.name
                      ? 'bg-blue-100 dark:bg-blue-900'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {variable.name}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-2">Hypothesized Mean</h3>
              <input
                type="number"
                value={hypothesizedMean}
                onChange={e => setHypothesizedMean(e.target.value)}
                className="w-full p-2 border rounded-sm"
                placeholder="Enter value..."
              />
            </div>

            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-2">Confidence Level</h3>
              <select
                value={confidenceLevel}
                onChange={e => setConfidenceLevel(e.target.value)}
                className="w-full p-2 border rounded-sm"
              >
                <option value="0.90">90%</option>
                <option value="0.95">95%</option>
                <option value="0.99">99%</option>
              </select>
            </div>
          </div>

          {results && (
            <div className="mt-4 space-y-4">
              <div ref={chartRef} className="w-full h-64 border rounded-lg p-4">
                <ResponsiveContainer>
                  <LineChart data={generateHistogramData(prepareData())}>
                    <XAxis dataKey="value" />
                    <YAxis />
                    <Line type="monotone" dataKey="frequency" stroke="#8884d8" />
                    <ReferenceLine
                      x={parseFloat(hypothesizedMean)}
                      stroke="red"
                      label="Hypothesized Mean"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">T-Test Results</h3>
                <table className="w-full">
                  <tbody>
                    <tr>
                      <td className="p-2 font-medium">t-statistic</td>
                      <td className="p-2">{results.t_statistic.toFixed(4)}</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium">p-value</td>
                      <td className="p-2">
                        {results.p_value < 0.001 ? 'p < .001' : `p = ${results.p_value.toFixed(3)}`}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium">Degrees of Freedom</td>
                      <td className="p-2">{results.degrees_of_freedom}</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium">Sample Mean</td>
                      <td className="p-2">{results.sample_mean.toFixed(4)}</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium">Mean Difference</td>
                      <td className="p-2">{results.mean_difference.toFixed(4)}</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium">Sample Size</td>
                      <td className="p-2">{results.sample_size}</td>
                    </tr>
                    {results.confidence_interval && (
                      <tr>
                        <td className="p-2 font-medium">Confidence Interval</td>
                        <td className="p-2">
                          ({results.confidence_interval[0].toFixed(4)},{' '}
                          {results.confidence_interval[1].toFixed(4)})
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {reportMetadata && (
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertTitle>Analysis Report Generated</AlertTitle>
              <AlertDescription>Report saved to: {reportMetadata.output_path}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <button
            onClick={calculateTTest}
            disabled={!selectedVariable || !hypothesizedMean}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded-sm hover:bg-blue-600 disabled:opacity-50"
          >
            Calculate T-Test
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OneSampleTTest;
