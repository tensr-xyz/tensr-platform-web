'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/molecules/tabs';
import { Button } from '@/components/atoms/button';
import {
  ColumnMeta,
  ColumnStats,
  RowInsight,
  RelationshipInsight,
  AnalysisResult,
} from '@/types/dataset';
import { Info, TrendingUp, Table, FileText } from 'lucide-react';
import Loading from '@/components/molecules/loading';
import { apiClient } from '@/lib/api-client';

interface InspectorPaneProps {
  selectedColumnId?: string;
  selectedRowId?: string;
  selectedRowData?: Record<string, any>;
  datasetId?: string;
  columnStats?: Record<string, ColumnStats>;
  columnMeta?: ColumnMeta[];
  onAction?: (actionId: string, context: any) => void;
}

export function InspectorPane({
  selectedColumnId,
  selectedRowId,
  selectedRowData,
  datasetId,
  columnStats,
  columnMeta,
  onAction,
}: InspectorPaneProps) {
  const [activeTab, setActiveTab] = useState<'column' | 'row' | 'relationships' | 'results'>(
    'column'
  );
  const [columnInsight, setColumnInsight] = useState<string | null>(null);
  const [rowInsight, setRowInsight] = useState<RowInsight | null>(null);
  const [relationshipInsight, setRelationshipInsight] = useState<RelationshipInsight | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(false);

  const currentColumn = useMemo(() => {
    if (!selectedColumnId || !columnMeta) return null;
    return columnMeta.find(col => col.id === selectedColumnId);
  }, [selectedColumnId, columnMeta]);

  const currentStats = useMemo(() => {
    if (!selectedColumnId || !columnStats) return null;
    return columnStats[selectedColumnId];
  }, [selectedColumnId, columnStats]);

  useEffect(() => {
    if (activeTab === 'column' && selectedColumnId && datasetId) {
      loadColumnInsight();
    }
  }, [activeTab, selectedColumnId, datasetId]);

  useEffect(() => {
    if (activeTab === 'row' && selectedRowId && selectedRowData && datasetId) {
      loadRowInsight();
    }
  }, [activeTab, selectedRowId, selectedRowData, datasetId]);

  useEffect(() => {
    if (activeTab === 'relationships' && selectedColumnId && datasetId) {
      loadRelationshipInsight();
    }
  }, [activeTab, selectedColumnId, datasetId]);

  useEffect(() => {
    if (activeTab === 'results' && datasetId) {
      loadAnalyses();
    }
  }, [activeTab, datasetId]);

  const loadColumnInsight = async () => {
    if (!selectedColumnId || !datasetId || !currentStats) return;

    try {
      setLoading(true);
      const insight = await apiClient.ai.columnInsight({
        datasetId,
        columnId: selectedColumnId,
        stats: currentStats,
      });
      setColumnInsight(insight.summary);
    } catch (error) {
      console.error('Failed to load column insight:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRowInsight = async () => {
    if (!selectedRowId || !selectedRowData || !datasetId) return;

    try {
      setLoading(true);
      const insight = await apiClient.ai.rowInsight({
        datasetId,
        rowId: selectedRowId,
        rowData: selectedRowData,
      });
      setRowInsight(insight);
    } catch (error) {
      console.error('Failed to load row insight:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRelationshipInsight = async () => {
    if (!selectedColumnId || !datasetId) return;

    try {
      setLoading(true);
      const insight = await apiClient.ai.relationships({
        datasetId,
        targetColumnId: selectedColumnId,
      });
      setRelationshipInsight(insight);
    } catch (error) {
      console.error('Failed to load relationship insight:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalyses = async () => {
    if (!datasetId) return;

    try {
      setLoading(true);
      const results = await apiClient.datasets.analyze.listRuns(datasetId);
      const runs = Array.isArray(results) ? results : (results?.runs ?? []);
      setAnalyses(runs as AnalysisResult[]);
    } catch (error) {
      console.error('Failed to load analyses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (actionId: string, context: any) => {
    onAction?.(actionId, context);
  };

  return (
    <div className="w-80 border-l border-border bg-background flex flex-col h-full">
      <Tabs
        value={activeTab}
        onValueChange={v => setActiveTab(v as any)}
        className="flex flex-col h-full"
      >
        <TabsList className="w-full justify-start rounded-none border-b">
          <TabsTrigger value="column" className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            Column
          </TabsTrigger>
          <TabsTrigger value="row" className="flex items-center gap-2">
            <Table className="h-4 w-4" />
            Row
          </TabsTrigger>
          <TabsTrigger value="relationships" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Relationships
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Results
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="column" className="p-4 space-y-4 mt-0">
            {loading ? (
              <Loading />
            ) : currentColumn && currentStats ? (
              <>
                <div>
                  <h3 className="font-medium mb-2">{currentColumn.name}</h3>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>Type: {currentColumn.type}</div>
                    <div>Total: {currentStats.nTotal.toLocaleString()}</div>
                    <div>Missing: {currentStats.nMissing.toLocaleString()}</div>
                    {currentStats.mean !== undefined && (
                      <>
                        <div>Mean: {currentStats.mean.toFixed(2)}</div>
                        <div>SD: {currentStats.sd?.toFixed(2) || '-'}</div>
                        {currentStats.min !== undefined && (
                          <>
                            <div>Min: {currentStats.min.toFixed(2)}</div>
                            <div>Max: {currentStats.max?.toFixed(2) || '-'}</div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {columnInsight && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-2">AI Summary</h4>
                    <p className="text-sm text-muted-foreground">{columnInsight}</p>
                  </div>
                )}

                <div className="border-t pt-4 space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      handleAction('suggest_transformations', { columnId: selectedColumnId })
                    }
                  >
                    Suggest transformations
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleAction('flag_outliers', { columnId: selectedColumnId })}
                  >
                    Flag outliers
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleAction('create_zscore', { columnId: selectedColumnId })}
                  >
                    Create z-scores
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Select a column to view details</div>
            )}
          </TabsContent>

          <TabsContent value="row" className="p-4 space-y-4 mt-0">
            {loading ? (
              <Loading />
            ) : selectedRowData && rowInsight ? (
              <>
                <div>
                  <h3 className="font-medium mb-2">Row {selectedRowId}</h3>
                  <div className="text-sm space-y-1">
                    {Object.entries(selectedRowData).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground">{key}:</span>
                        <span>{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {rowInsight.explanation && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-2">AI Insight</h4>
                    <p className="text-sm text-muted-foreground">{rowInsight.explanation}</p>
                  </div>
                )}

                <div className="border-t pt-4 space-y-2">
                  {rowInsight.actions.map(action => (
                    <Button
                      key={action.id}
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => handleAction(action.id, { rowId: selectedRowId })}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Select a row to view details</div>
            )}
          </TabsContent>

          <TabsContent value="relationships" className="p-4 space-y-4 mt-0">
            {loading ? (
              <Loading />
            ) : relationshipInsight ? (
              <>
                <div>
                  <h3 className="font-medium mb-2">Relationships</h3>
                  <div className="text-sm space-y-2">
                    {relationshipInsight.relationships.map(rel => (
                      <div key={rel.columnId} className="flex justify-between items-center">
                        <span className="text-muted-foreground">{rel.label}</span>
                        <span className="font-medium">{rel.correlation.toFixed(3)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {relationshipInsight.summary && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-2">AI Summary</h4>
                    <p className="text-sm text-muted-foreground">{relationshipInsight.summary}</p>
                  </div>
                )}

                <div className="border-t pt-4 space-y-2">
                  {relationshipInsight.actions.map(action => (
                    <Button
                      key={action.id}
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => handleAction(action.id, { targetColumnId: selectedColumnId })}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                {selectedColumnId
                  ? 'Loading relationships...'
                  : 'Select a column to view relationships'}
              </div>
            )}
          </TabsContent>

          <TabsContent value="results" className="p-4 space-y-4 mt-0">
            {loading ? (
              <Loading />
            ) : analyses.length > 0 ? (
              <div className="space-y-3">
                {analyses.map(analysis => (
                  <div key={analysis.id} className="border rounded p-3 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-sm">{analysis.type}</h4>
                        <p className="text-xs text-muted-foreground">
                          {new Date(analysis.metadata.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {analysis.summary && (
                      <p className="text-xs text-muted-foreground">{analysis.summary}</p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => handleAction('view_analysis', { analysisId: analysis.id })}
                    >
                      View details
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No analyses yet</div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
