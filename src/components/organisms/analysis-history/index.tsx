import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/atoms/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/card';
import { Badge } from '@/components/atoms/badge';
import { ScrollArea } from '@/components/atoms/scroll-area';
import { Clock, RefreshCw, Eye, Play, Calendar, AlertCircle } from 'lucide-react';
import {
  formatRunLabel,
  formatRunTime,
  listDatasetAnalysisRuns,
  openStoredAnalysisRun,
  type StoredAnalysisRun,
} from '@/lib/analysis-runs';

interface AnalysisHistoryProps {
  /** tensr-api dataset id */
  projectId: string;
  onReRunAnalysis?: (run: StoredAnalysisRun) => void;
}

export function AnalysisHistory({ projectId, onReRunAnalysis }: AnalysisHistoryProps) {
  const [analyses, setAnalyses] = useState<StoredAnalysisRun[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<StoredAnalysisRun | null>(null);

  const loadAnalysisHistory = useCallback(async () => {
    if (!projectId) {
      setAnalyses([]);
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const runs = await listDatasetAnalysisRuns(projectId);
      setAnalyses(runs);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load analysis history');
      setAnalyses([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadAnalysisHistory();
  }, [loadAnalysisHistory]);

  const handleReRunAnalysis = (analysis: StoredAnalysisRun) => {
    if (onReRunAnalysis) {
      onReRunAnalysis(analysis);
      return;
    }
    void openStoredAnalysisRun(analysis);
  };

  const handleViewDetails = (analysis: StoredAnalysisRun) => {
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
          <Button onClick={() => void loadAnalysisHistory()} variant="outline" className="mt-2">
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
        <Button onClick={() => void loadAnalysisHistory()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {analyses.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No analyses yet</p>
          <p className="text-sm">Run an analysis from the Analyze menu or command palette</p>
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
                        {formatRunLabel(analysis)}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{formatRunTime(analysis.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Badge variant="secondary" className="text-xs">
                        {analysis.op.replace(/_/g, ' ')}
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
                      <h4 className="font-medium mb-2">Summary</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        {analysis.report.summary}
                      </p>
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
