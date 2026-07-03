import React, { useState, useMemo } from 'react';
import { Card } from '@/components/atoms/card';
import { Button } from '@/components/atoms/button';
import { Badge } from '@/components/atoms/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/molecules/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/molecules/table';
import { devLog } from '@/lib/dev-log';
import { ScrollArea } from '@/components/atoms/scroll-area';
import { Separator } from '@/components/atoms/separator';
import {
  Download,
  Copy,
  BarChart3,
  Table as TableIcon,
  FileText,
  CheckCircle,
  AlertCircle,
  Info,
  TrendingUp,
  PieChart,
  ScatterChart,
  BarChart3 as Histogram,
  Sparkles,
  RefreshCw,
  BookOpen,
  Loader2,
} from 'lucide-react';
import { AnalysisResult, AnalysisOutput } from '@/types/agent';
import { apiClient } from '@/lib/api-client';
import { useTabsStore } from '@/stores/tabs-store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/molecules/dialog';
import { Textarea } from '@/components/atoms/text-area';

interface AnalysisResultsProps {
  result: AnalysisResult;
  className?: string;
}

interface ChartData {
  type: 'bar' | 'line' | 'scatter' | 'histogram' | 'pie' | 'heatmap';
  data: any;
  options: any;
  title: string;
}

export const AnalysisResults: React.FC<AnalysisResultsProps> = ({ result, className }) => {
  const [activeTab, setActiveTab] = useState('summary');
  const [selectedOutput, setSelectedOutput] = useState<AnalysisOutput | null>(null);
  const [explanationDialogOpen, setExplanationDialogOpen] = useState(false);
  const [explanation, setExplanation] = useState<any>(null);
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [rerunDialogOpen, setRerunDialogOpen] = useState(false);
  const [modificationNote, setModificationNote] = useState('');
  const [apaDialogOpen, setApaDialogOpen] = useState(false);
  const [apaWriteup, setApaWriteup] = useState<string | null>(null);
  const [apaLoading, setApaLoading] = useState(false);
  const { tabs, activeTabId } = useTabsStore();
  const activeTabData = tabs.find(t => t.id === activeTabId);

  // Process and categorize outputs
  const processedOutputs = useMemo(() => {
    const outputs = {
      tables: [] as AnalysisOutput[],
      charts: [] as AnalysisOutput[],
      statistics: [] as AnalysisOutput[],
      text: [] as AnalysisOutput[],
      raw: [] as AnalysisOutput[],
    };

    result.outputs.forEach(output => {
      if (output.format === 'table') {
        outputs.tables.push(output);
      } else if (output.format === 'chart') {
        outputs.charts.push(output);
      } else if (output.format === 'statistics') {
        outputs.statistics.push(output);
      } else if (output.format === 'text') {
        outputs.text.push(output);
      } else {
        outputs.raw.push(output);
      }
    });

    return outputs;
  }, [result.outputs]);

  // Generate chart data from outputs
  const chartData = useMemo((): ChartData[] => {
    return processedOutputs.charts.map(output => {
      // This is a simplified chart data structure
      // In production, you'd parse the actual chart data from the output
      return {
        type: 'bar' as const, // Default type
        data: output.content || {},
        options: {
          title: output.title || 'Chart',
          xAxis: { title: 'X Axis' },
          yAxis: { title: 'Y Axis' },
        },
        title: output.title || 'Generated Chart',
      };
    });
  }, [processedOutputs.charts]);

  // Export functions
  const exportToCSV = (data: any, filename: string) => {
    if (!data || !Array.isArray(data)) return;

    const csvContent = [
      Object.keys(data[0]).join(','),
      ...data.map(row =>
        Object.values(row)
          .map(val => `"${val}"`)
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToJSON = (data: any, filename: string) => {
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  // Render table output
  const renderTable = (output: AnalysisOutput) => {
    if (!output.content || !Array.isArray(output.content)) {
      return <div className="text-gray-500">No table data available</div>;
    }

    const columns = Object.keys(output.content[0] || {});

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">{output.title || 'Table'}</h4>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCSV(output.content, output.title || 'table')}
            >
              <Download className="w-3 h-3 mr-1" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(JSON.stringify(output.content, null, 2))}
            >
              <Copy className="w-3 h-3 mr-1" />
              Copy
            </Button>
          </div>
        </div>

        <ScrollArea className="max-h-96">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map(column => (
                  <TableHead key={column} className="text-xs">
                    {column}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {output.content.slice(0, 100).map((row, index) => (
                <TableRow key={index}>
                  {columns.map(column => (
                    <TableCell key={column} className="text-xs">
                      {String(row[column] || '')}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>

        {output.content.length > 100 && (
          <div className="text-xs text-gray-500 text-center">
            Showing first 100 rows of {output.content.length} total rows
          </div>
        )}
      </div>
    );
  };

  // Render chart output
  const renderChart = (output: AnalysisOutput, chartData: ChartData) => {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">{chartData.title}</h4>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToJSON(chartData.data, chartData.title)}
            >
              <Download className="w-3 h-3 mr-1" />
              JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(JSON.stringify(chartData.data, null, 2))}
            >
              <Copy className="w-3 h-3 mr-1" />
              Copy
            </Button>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded border min-h-[200px] flex items-center justify-center">
          <div className="text-center text-gray-500">
            <BarChart3 className="w-12 h-12 mx-auto mb-2" />
            <p className="text-sm">Chart visualization</p>
            <p className="text-xs">Chart rendering would be implemented here</p>
          </div>
        </div>

        <div className="text-xs text-gray-600">
          <p>
            <strong>Chart Type:</strong> {chartData.type}
          </p>
          <p>
            <strong>Data Points:</strong> {Object.keys(chartData.data).length}
          </p>
        </div>
      </div>
    );
  };

  // Render statistics output
  const renderStatistics = (output: AnalysisOutput) => {
    if (!output.content) {
      return <div className="text-gray-500">No statistics data available</div>;
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">{output.title || 'Statistics'}</h4>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToJSON(output.content, output.title || 'statistics')}
            >
              <Download className="w-3 h-3 mr-1" />
              JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(JSON.stringify(output.content, null, 2))}
            >
              <Copy className="w-3 h-3 mr-1" />
              Copy
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(output.content).map(([key, value]) => (
            <div key={key} className="bg-gray-50 p-3 rounded border">
              <div className="text-xs font-medium text-gray-600">{key}</div>
              <div className="text-sm font-semibold">
                {typeof value === 'number' ? value.toFixed(4) : String(value)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render text output
  const renderText = (output: AnalysisOutput) => {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">{output.title || 'Text Output'}</h4>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const blob = new Blob([output.content || ''], { type: 'text/plain' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${output.title || 'output'}.txt`;
                a.click();
                window.URL.revokeObjectURL(url);
              }}
            >
              <Download className="w-3 h-3 mr-1" />
              TXT
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(output.content || '')}
            >
              <Copy className="w-3 h-3 mr-1" />
              Copy
            </Button>
          </div>
        </div>

        <div className="bg-gray-50 p-3 rounded border">
          <pre className="text-xs whitespace-pre-wrap">{output.content}</pre>
        </div>
      </div>
    );
  };

  // Render raw output
  const renderRaw = (output: AnalysisOutput) => {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">{output.title || 'Raw Output'}</h4>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToJSON(output.content, output.title || 'raw')}
            >
              <Download className="w-3 h-3 mr-1" />
              JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(JSON.stringify(output.content, null, 2))}
            >
              <Copy className="w-3 h-3 mr-1" />
              Copy
            </Button>
          </div>
        </div>

        <div className="bg-gray-50 p-3 rounded border">
          <pre className="text-xs overflow-x-auto">
            <code>{JSON.stringify(output.content, null, 2)}</code>
          </pre>
        </div>
      </div>
    );
  };

  return (
    <Card className={className}>
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-medium">Analysis Complete</span>
            </div>
            <Badge variant="secondary">{result.taskId || 'Analysis'}</Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setExplanationDialogOpen(true);
                setExplanationLoading(true);
                try {
                  const analysisType = result.metadata?.analysisType || 'analysis';
                  const expl = await apiClient.ai.explainResult({
                    analysisType,
                    results: result.outputs.map(o => o.content),
                    context: result.metadata,
                    teachingMode: activeTabData?.data?.teachingMode || false,
                  });
                  setExplanation(expl);
                } catch (error) {
                  console.error('Failed to explain result', error);
                } finally {
                  setExplanationLoading(false);
                }
              }}
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Explain
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRerunDialogOpen(true)}>
              <RefreshCw className="w-3 h-3 mr-1" />
              Re-run
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setApaDialogOpen(true);
                setApaLoading(true);
                try {
                  const analysisType = result.metadata?.analysisType || 'analysis';
                  const writeup = await apiClient.ai.apaWriteup({
                    analysisType,
                    results: result.outputs.map(o => o.content),
                    context: result.metadata,
                  });
                  setApaWriteup(writeup.apaText || writeup.summary || 'APA writeup generated');
                } catch (error) {
                  console.error('Failed to generate APA writeup', error);
                  setApaWriteup('Failed to generate APA writeup');
                } finally {
                  setApaLoading(false);
                }
              }}
            >
              <BookOpen className="w-3 h-3 mr-1" />
              APA
            </Button>
            <div className="flex items-center gap-2 text-sm text-gray-600 ml-2">
              <span>Execution time: {result.executionTime}ms</span>
              <span>•</span>
              <span>{result.outputs.length} outputs</span>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <Info className="w-3 h-3" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="tables" className="flex items-center gap-2">
            <TableIcon className="w-3 h-3" />
            Tables ({processedOutputs.tables.length})
          </TabsTrigger>
          <TabsTrigger value="charts" className="flex items-center gap-2">
            <BarChart3 className="w-3 h-3" />
            Charts ({processedOutputs.charts.length})
          </TabsTrigger>
          <TabsTrigger value="statistics" className="flex items-center gap-2">
            <TrendingUp className="w-3 h-3" />
            Stats ({processedOutputs.statistics.length})
          </TabsTrigger>
          <TabsTrigger value="raw" className="flex items-center gap-2">
            <FileText className="w-3 h-3" />
            Raw ({processedOutputs.raw.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded border">
              <div className="flex items-center gap-2 mb-2">
                <TableIcon className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Tables</span>
              </div>
              <div className="text-2xl font-bold text-blue-900">
                {processedOutputs.tables.length}
              </div>
              <div className="text-xs text-blue-700">Data tables generated</div>
            </div>

            <div className="bg-green-50 p-4 rounded border">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-900">Charts</span>
              </div>
              <div className="text-2xl font-bold text-green-900">
                {processedOutputs.charts.length}
              </div>
              <div className="text-xs text-green-700">Visualizations created</div>
            </div>

            <div className="bg-purple-50 p-4 rounded border">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-900">Statistics</span>
              </div>
              <div className="text-2xl font-bold text-purple-900">
                {processedOutputs.statistics.length}
              </div>
              <div className="text-xs text-purple-700">Statistical measures</div>
            </div>
          </div>

          {result.metadata && (
            <div className="bg-gray-50 p-4 rounded border">
              <h4 className="text-sm font-medium mb-2">Analysis Metadata</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-gray-600">Type:</span>
                  <div className="font-medium">{result.metadata.analysisType}</div>
                </div>
                <div>
                  <span className="text-gray-600">Libraries:</span>
                  <div className="font-medium">{result.metadata.librariesUsed?.join(', ')}</div>
                </div>
                <div>
                  <span className="text-gray-600">Code Size:</span>
                  <div className="font-medium">{result.metadata.codeSize} chars</div>
                </div>
                <div>
                  <span className="text-gray-600">Environment:</span>
                  <div className="font-medium">{result.metadata.executionEnvironment}</div>
                </div>
              </div>
            </div>
          )}

          {result.warnings && result.warnings.length > 0 && (
            <div className="bg-yellow-50 p-4 rounded border">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-900">Warnings</span>
              </div>
              <ul className="text-sm text-yellow-800 space-y-1">
                {result.warnings.map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>

        <TabsContent value="tables" className="p-4 space-y-6">
          {processedOutputs.tables.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <TableIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No tables generated in this analysis</p>
            </div>
          ) : (
            processedOutputs.tables.map((output, index) => (
              <div key={index}>
                {renderTable(output)}
                {index < processedOutputs.tables.length - 1 && <Separator className="my-6" />}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="charts" className="p-4 space-y-6">
          {processedOutputs.charts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No charts generated in this analysis</p>
            </div>
          ) : (
            processedOutputs.charts.map((output, index) => (
              <div key={index}>
                {renderChart(output, chartData[index])}
                {index < processedOutputs.charts.length - 1 && <Separator className="my-6" />}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="statistics" className="p-4 space-y-6">
          {processedOutputs.statistics.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <TrendingUp className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No statistics generated in this analysis</p>
            </div>
          ) : (
            processedOutputs.statistics.map((output, index) => (
              <div key={index}>
                {renderStatistics(output)}
                {index < processedOutputs.statistics.length - 1 && <Separator className="my-6" />}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="raw" className="p-4 space-y-6">
          {processedOutputs.raw.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No raw outputs in this analysis</p>
            </div>
          ) : (
            processedOutputs.raw.map((output, index) => (
              <div key={index}>
                {renderRaw(output)}
                {index < processedOutputs.raw.length - 1 && <Separator className="my-6" />}
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Explanation Dialog */}
      <Dialog open={explanationDialogOpen} onOpenChange={setExplanationDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Analysis Explanation</DialogTitle>
            <DialogDescription>AI-powered explanation of these results</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            {explanationLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : explanation ? (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Explanation</h4>
                  <p className="text-sm text-muted-foreground">{explanation.explanation}</p>
                </div>
                {explanation.keyFindings && explanation.keyFindings.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Key Findings</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {explanation.keyFindings.map((finding: string, idx: number) => (
                        <li key={idx}>{finding}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {explanation.implications && (
                  <div>
                    <h4 className="font-medium mb-2">Implications</h4>
                    <p className="text-sm text-muted-foreground">{explanation.implications}</p>
                  </div>
                )}
                {explanation.recommendations && explanation.recommendations.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Recommendations</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {explanation.recommendations.map((rec: string, idx: number) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No explanation available</div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Re-run Dialog */}
      <Dialog open={rerunDialogOpen} onOpenChange={setRerunDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-run Analysis with Modifications</DialogTitle>
            <DialogDescription>Describe how you'd like to modify this analysis</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="e.g., Add more predictors, change the model type, filter to specific groups..."
              value={modificationNote}
              onChange={e => setModificationNote(e.target.value)}
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRerunDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  // This would trigger a re-run through the agent panel
                  // For now, just log and close
                  devLog('Re-run requested with modification:', modificationNote);
                  setRerunDialogOpen(false);
                  setModificationNote('');
                }}
              >
                Re-run
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* APA Writeup Dialog */}
      <Dialog open={apaDialogOpen} onOpenChange={setApaDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>APA-Style Writeup</DialogTitle>
            <DialogDescription>Academic format writeup of this analysis</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            {apaLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : apaWriteup ? (
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap text-sm">{apaWriteup}</pre>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No writeup available</div>
            )}
          </ScrollArea>
          {apaWriteup && !apaLoading && (
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const blob = new Blob([apaWriteup], { type: 'text/plain' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'apa-writeup.txt';
                  a.click();
                  window.URL.revokeObjectURL(url);
                }}
              >
                <Download className="w-3 h-3 mr-1" />
                Download
              </Button>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(apaWriteup)}>
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
