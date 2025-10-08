import { useState, useEffect } from 'react';
import { Button } from '@/components/atoms/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/card';
import { Badge } from '@/components/atoms/badge';
import { ScrollArea } from '@/components/atoms/scroll-area';
import { Clock, RefreshCw, Eye, Play, Calendar, User, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface AnalysisHistoryProps {
  projectId: string;
  onReRunAnalysis?: (analysis: any) => void;
}

interface Analysis {
  id: string;
  query: string;
  outputJSON: string;
  createdAt: string;
  userId: string;
}

export function AnalysisHistory({ projectId, onReRunAnalysis }: AnalysisHistoryProps) {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null);

  useEffect(() => {
    loadAnalysisHistory();
  }, [projectId]);

  const loadAnalysisHistory = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // TODO: Implement API endpoint for getting analysis history
      // For now, using mock data
      const mockAnalyses: Analysis[] = [
        {
          id: 'analysis_1',
          query: 'Run a t-test comparing age by gender',
          outputJSON: JSON.stringify({
            type: 'analysis',
            content:
              'The t-test shows a significant difference in age between genders (t=2.15, p=0.03).',
            toolResults: {
              t_statistic: 2.15,
              p_value: 0.03,
              means: { M: 35.1, F: 33.9 },
            },
          }),
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          userId: 'user1',
        },
        {
          id: 'analysis_2',
          query: 'What is the correlation between income and education?',
          outputJSON: JSON.stringify({
            type: 'analysis',
            content:
              'There is a moderate positive correlation between income and education (r=0.45, p<0.001).',
            toolResults: {
              correlation_coefficient: 0.45,
              p_value: 0.001,
            },
          }),
          createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
          userId: 'user1',
        },
        {
          id: 'analysis_3',
          query: 'Show me descriptive statistics for all numeric variables',
          outputJSON: JSON.stringify({
            type: 'analysis',
            content: 'Here are the descriptive statistics for your numeric variables...',
            toolResults: {
              variables: ['age', 'income', 'years_experience'],
              statistics: {
                age: { mean: 34.5, std: 12.3, min: 18, max: 89 },
                income: { mean: 32000, std: 8000, min: 15000, max: 120000 },
              },
            },
          }),
          createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
          userId: 'user1',
        },
      ];

      setAnalyses(mockAnalyses);
    } catch (err: any) {
      setError(err.message || 'Failed to load analysis history');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getAnalysisType = (analysis: Analysis) => {
    try {
      const output = JSON.parse(analysis.outputJSON);
      if (output.type === 'analysis') {
        if (output.toolResults?.t_statistic) return 't-test';
        if (output.toolResults?.correlation_coefficient) return 'correlation';
        if (output.toolResults?.statistics) return 'descriptive';
        return 'analysis';
      }
      return 'text';
    } catch {
      return 'text';
    }
  };

  const getAnalysisSummary = (analysis: Analysis) => {
    try {
      const output = JSON.parse(analysis.outputJSON);
      if (output.type === 'analysis') {
        return output.content.substring(0, 100) + (output.content.length > 100 ? '...' : '');
      }
      return output.content.substring(0, 100) + (output.content.length > 100 ? '...' : '');
    } catch {
      return analysis.query.substring(0, 100) + (analysis.query.length > 100 ? '...' : '');
    }
  };

  const handleReRunAnalysis = (analysis: Analysis) => {
    if (onReRunAnalysis) {
      onReRunAnalysis(analysis);
    }
  };

  const handleViewDetails = (analysis: Analysis) => {
    setSelectedAnalysis(selectedAnalysis?.id === analysis.id ? null : analysis);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading analysis history...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-red-600 text-center">
          <AlertCircle className="h-6 w-6 mx-auto mb-2" />
          <p>{error}</p>
          <Button onClick={loadAnalysisHistory} variant="outline" className="mt-2">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Analysis History</h3>
        <Button onClick={loadAnalysisHistory} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {analyses.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No analyses yet</p>
          <p className="text-sm">Start by asking the AI agent a question about your data</p>
        </div>
      ) : (
        <ScrollArea className="h-[600px]">
          <div className="space-y-3">
            {analyses.map(analysis => (
              <Card key={analysis.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm font-medium truncate">
                        {analysis.query}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(analysis.createdAt)}</span>
                        <User className="h-3 w-3 ml-2" />
                        <span>{analysis.userId}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Badge variant="secondary" className="text-xs">
                        {getAnalysisType(analysis)}
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={() => handleViewDetails(analysis)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReRunAnalysis(analysis)}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {selectedAnalysis?.id === analysis.id && (
                  <CardContent className="pt-0">
                    <div className="border-t pt-3">
                      <h4 className="font-medium mb-2">Analysis Results</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        {getAnalysisSummary(analysis)}
                      </p>

                      <div className="bg-muted p-3 rounded-lg">
                        <h5 className="font-medium text-xs mb-2">Full Output</h5>
                        <pre className="text-xs overflow-auto max-h-32">{analysis.outputJSON}</pre>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
