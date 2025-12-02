import { Button } from '@/components/atoms/button';
import { Alert, AlertDescription } from '@/components/atoms/alert';
import { Textarea } from '@/components/atoms/text-area';
import { Send, Brain, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTabsStore } from '@/stores/tabs-store';
import { useProjectStore } from '@/stores/project-store';
import { ColumnFiltersState } from '@tanstack/react-table';
import { useAuth } from '@/hooks/api/use-auth';
import { Message } from '@/types/agent';
import { v4 as uuidv4 } from 'uuid';
import { apiClient } from '@/lib/api-client';
import { getIdToken } from '@/utils/auth';
import { useChatStore, ChatMessage } from '@/stores/chat-store';
import { ApprovalDialog } from '@/components/molecules/approval-dialog';
import { ProgressIndicator } from '@/components/molecules/progress-indicator';

export function AgentPanel() {
  const { tabs, activeTabId, updateTab } = useTabsStore();
  const { currentProject } = useProjectStore();
  const { tokens } = useAuth();

  // Get project ID from current project or use default
  const projectId = currentProject?.id || 'default-project';

  // Use chat store for persistent state
  const {
    initializeSession,
    addMessage,
    setLoading,
    setError,
    getMessages,
    getLoading,
    getError,
    clearMessages,
  } = useChatStore();

  // Local state for input
  const [inputMessage, setInputMessage] = useState('');

  // Approval dialog state
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState<any>(null);

  // Get messages and state from store
  const messages = getMessages(projectId);
  const isLoading = getLoading(projectId);
  const error = getError(projectId);

  // Initialize session when component mounts or project changes
  useEffect(() => {
    initializeSession(projectId);
  }, [projectId, initializeSession]);

  // Get active tab data
  const { tabs: storeTabs, activeTabId: storeActiveTabId } = useTabsStore();
  const activeTab = storeTabs.find(tab => tab.id === storeActiveTabId);

  // Message handling using chat store
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      role: 'user' as const,
      content: inputMessage,
      timestamp: new Date(),
    };

    // Add user message to store
    addMessage(projectId, userMessage);

    const currentMessage = inputMessage;
    setInputMessage('');
    setLoading(projectId, true);
    setError(projectId, null);

    try {
      // Get the auth token (use ID token for API Gateway authorization)
      const token = getIdToken();
      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }

      // Check if this is a filter query - if so, handle it directly
      const isFilterQuery =
        /(show|filter|find|where|participants|rows with|where.*>|where.*<|display|list)/i.test(
          currentMessage
        );

      // Check if this is a data quality scan request
      const isDataQualityQuery = /(data quality|quality scan|check data|data issues|scan data|data problems)/i.test(
        currentMessage
      );

      if (isFilterQuery && activeTab?.data?.initialColumns) {
        try {
          // Get dataset schema from active tab
          const datasetSchema = {
            columns: activeTab.data.initialColumns.map((col: any) => ({
              id: col.id,
              name: col.header || col.id,
              type: col.type || 'numeric',
            })),
          };

          // Call AI filters API
          const filterResponse = await apiClient.ai.filters({
            datasetSchema,
            instruction: currentMessage,
          });

          if (filterResponse?.filters && Array.isArray(filterResponse.filters)) {
            // Convert to ColumnFiltersState format
            const newFilters: ColumnFiltersState = filterResponse.filters.map(
              (filter: { columnId: string; operator: string; value: any }) => ({
                id: filter.columnId,
                value: {
                  operator: filter.operator,
                  value: filter.value,
                },
              })
            );

            // Update tab store with filters
            if (activeTab) {
              updateTab(activeTab.id, {
                data: {
                  ...activeTab.data,
                  columnFilters: newFilters as any, // Type assertion needed due to ColumnFiltersState type mismatch
                },
              });
            }

            // Show success message
            const filterList = filterResponse.filters
              .map((f: any) => {
                const columnName =
                  activeTab.data?.initialColumns?.find((col: any) => col.id === f.columnId)
                    ?.header || f.columnId;
                return `• ${columnName} ${f.operator} ${f.value}`;
              })
              .join('\n');

            const filterMessage = {
              role: 'assistant' as const,
              content: `✅ **Filters applied!**\n\n${filterResponse.description || 'Applied the following filters:'}\n\n${filterList}\n\nThe table has been filtered accordingly.`,
              timestamp: new Date(),
            };
            addMessage(projectId, filterMessage);
            setLoading(projectId, false);
            return;
          }
        } catch (filterError) {
          // If filter generation fails, fall through to regular agent chat
          console.warn('Filter generation failed, using regular chat:', filterError);
        }
      }

      // Check if this is an analysis question - if so, use analysis planner first
      const isAnalysisQuestion =
        /(predict|analyze|relationship|correlation|regression|anova|compare|difference|effect|impact)/i.test(
          currentMessage
        );

      if (isAnalysisQuestion && activeTab?.data?.initialColumns) {
        try {
          // Get dataset schema from active tab
          const datasetSchema = {
            columns: activeTab.data.initialColumns.map((col: any) => ({
              id: col.id,
              name: col.header || col.id,
              type: col.type || 'numeric',
            })),
          };

          // Call analysis planner
          const plan = await apiClient.ai.analysisPlanner({
            datasetSchema,
            question: currentMessage,
          });

          // Show the plan to user and offer to run
          const planMessage = {
            role: 'assistant' as const,
            content: `I suggest running a **${plan.analysisType}** analysis.\n\n**Rationale:** ${plan.rationale}\n\nWould you like me to run this analysis?`,
            timestamp: new Date(),
          };
          addMessage(projectId, planMessage);

          // Store the plan for execution
          setPendingCommand({
            tool: 'run_analysis',
            params: plan.spec,
            description: `Run ${plan.analysisType} analysis`,
            analysisPlan: plan,
          });
          setApprovalDialogOpen(true);
          setLoading(projectId, false);
          return;
        } catch (planError) {
          // If planning fails, fall through to regular agent chat
          console.warn('Analysis planning failed, using regular chat:', planError);
        }
      }

      // Handle data quality scan
      if (isDataQualityQuery && activeTab?.data) {
        try {
          const datasetId = activeTab.data.filePath || activeTab.id;
          const datasetSchema = {
            columns: activeTab.data.initialColumns?.map((col: any) => ({
              id: col.id,
              name: col.header || col.id,
              type: col.type || 'numeric',
            })) || [],
          };

          const qualityReport = await apiClient.ai.dataQualityScan({
            datasetId,
            datasetSchema,
            columnStats: activeTab.data.columnStats,
          });

          const reportMessage = {
            role: 'assistant' as const,
            content: `## Data Quality Report\n\n**Overall Score: ${qualityReport.overallScore}/100**\n\n${qualityReport.summary || ''}\n\n### Issues by Column:\n${(qualityReport.columns || []).map((col: any) => `\n**${col.id}** (Score: ${col.score}/100)\n${col.issues?.map((issue: string) => `- ${issue}`).join('\n') || 'No issues'}\n${col.suggestions?.map((sugg: string) => `💡 ${sugg}`).join('\n') || ''}`).join('\n')}`,
            timestamp: new Date(),
          };
          addMessage(projectId, reportMessage);
          setLoading(projectId, false);
          return;
        } catch (error: any) {
          console.error('Failed to run data quality scan', error);
          setError(projectId, error.message || 'Failed to run data quality scan');
          setLoading(projectId, false);
          return;
        }
      }

      // Call the backend agent API
      const response = await apiClient.agent.chat({
        projectId,
        message: currentMessage,
        cursor: {
          snapshotId: 'current-snapshot',
          variables: [],
          filters: {},
        },
        authToken: token, // Use ID token for API Gateway authorization
      });

      if (response.type === 'error') {
        throw new Error(response.content);
      }

      // Handle different response types
      if (response.type === 'pending_approval') {
        // Show approval dialog
        setPendingCommand(response.pendingCommand);
        setApprovalDialogOpen(true);

        const aiMessage = {
          role: 'assistant' as const,
          content: response.content,
          timestamp: new Date(),
        };
        addMessage(projectId, aiMessage);
        return;
      }

      if (response.type === 'executing') {
        // Show progress indicator
        setExecutionProgress(response.executionProgress);
        setIsExecuting(true);
        return;
      }

      if (response.type === 'completed') {
        // Hide progress indicator
        setIsExecuting(false);
        setExecutionProgress(null);
      }

      const aiMessage = {
        role: 'assistant' as const,
        content: response.content,
        timestamp: new Date(),
      };

      // Add AI response to store
      addMessage(projectId, aiMessage);

      // Show suggested actions if available
      if (response.suggestedActions && response.suggestedActions.length > 0) {
        const suggestionsMessage = {
          role: 'assistant' as const,
          content: `💡 **Suggested next steps:**\n${response.suggestedActions.map((action: string) => `• ${action}`).join('\n')}`,
          timestamp: new Date(),
        };
        addMessage(projectId, suggestionsMessage);
      }
    } catch (err: any) {
      setError(projectId, err.message || 'Failed to send message. Please try again.');
    } finally {
      setLoading(projectId, false);
    }
  };

  // Handle approval
  const handleApprove = async () => {
    if (!pendingCommand) return;

    setApprovalDialogOpen(false);
    setIsExecuting(true);
    setExecutionProgress({
      step: 1,
      totalSteps: 3,
      currentStep: 'Running analysis...',
      completed: false,
    });

    try {
      const token = getIdToken();
      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }

      // If this is an analysis plan, run it directly
      if (pendingCommand.tool === 'run_analysis' && pendingCommand.analysisPlan) {
        const { analysisPlan } = pendingCommand;
        const spec = analysisPlan.spec;

        // Map analysis type to API call
        let analysisResult;
        if (analysisPlan.analysisType === 'regression') {
          analysisResult = await apiClient.analysis.regression({
            datasetId: activeTab?.data?.filePath || projectId,
            dependent: spec.dependent,
            predictors: spec.predictors,
            controls: spec.controls,
          });
        } else if (analysisPlan.analysisType === 'anova') {
          analysisResult = await apiClient.analysis.anova({
            datasetId: activeTab?.data?.filePath || projectId,
            dependent: spec.dependent,
            independent: spec.independent || spec.groups?.[0],
            groups: spec.groups,
          });
        } else if (analysisPlan.analysisType === 'correlations') {
          analysisResult = await apiClient.analysis.correlations({
            datasetId: activeTab?.data?.filePath || projectId,
            variables: spec.variables || spec.predictors,
          });
        }

        setExecutionProgress({
          step: 2,
          totalSteps: 3,
          currentStep: 'Generating APA writeup...',
          completed: false,
        });

        // Generate APA writeup
        const writeup = await apiClient.ai.apaWriteup({
          analysisType: analysisPlan.analysisType,
          results: analysisResult,
          context: {
            dvLabel: spec.dependent,
            predictorLabels: (spec.predictors || []).reduce((acc: any, p: string) => {
              acc[p] = p;
              return acc;
            }, {}),
          },
        });

        setExecutionProgress({
          step: 3,
          totalSteps: 3,
          currentStep: 'Complete',
          completed: true,
        });

        // Show results
        const resultMessage = {
          role: 'assistant' as const,
          content: `**Analysis Results**\n\n${writeup.apaText}\n\n**Summary:** ${writeup.summary}`,
          timestamp: new Date(),
        };
        addMessage(projectId, resultMessage);

        setTimeout(() => {
          setIsExecuting(false);
          setExecutionProgress(null);
        }, 1000);
        return;
      }

      // Otherwise, use the regular approval flow
      const response = await apiClient.agent.approve({
        projectId,
        command: pendingCommand,
        approved: true,
        authToken: token,
      });

      if (response.type === 'error') {
        throw new Error(response.content);
      }

      // Update progress to completion
      setExecutionProgress({
        step: 2,
        totalSteps: 2,
        currentStep: 'Analysis complete',
        completed: true,
      });

      // Hide progress after a short delay and show results
      setTimeout(() => {
        setIsExecuting(false);
        setExecutionProgress(null);

        const aiMessage = {
          role: 'assistant' as const,
          content: response.content,
          timestamp: new Date(),
        };
        addMessage(projectId, aiMessage);
      }, 1000);
    } catch (err: any) {
      setIsExecuting(false);
      setExecutionProgress(null);
      setError(projectId, err.message || 'Failed to execute command. Please try again.');
    }
  };

  // Handle rejection
  const handleReject = () => {
    setApprovalDialogOpen(false);
    setPendingCommand(null);

    const aiMessage = {
      role: 'assistant' as const,
      content: "Command cancelled. Let me know if you'd like to try something else!",
      timestamp: new Date(),
    };
    addMessage(projectId, aiMessage);
  };

  return (
    <div
      className="flex flex-col h-full w-full bg-background p-0"
      style={{ maxWidth: '100%', width: '100%' }}
    >
      {/* Header with project context */}
      <div className="flex items-center gap-2 border-b border-border flex-shrink-0 px-4 py-2 min-w-0">
        <Brain className="h-4 w-4 text-primary flex-shrink-0" />
        <span className="font-medium text-sm truncate min-w-0">AI Assistant</span>
        <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
          Project: {currentProject?.name || projectId}
        </span>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clearMessages(projectId)}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground flex-shrink-0"
            title="Clear chat history"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Messages area - takes up all available space */}
      <div className="flex-1 overflow-auto space-y-4 min-h-0 min-w-0 py-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 px-4">
            <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Ask me anything about your data analysis</p>
            <p className="text-xs text-muted-foreground mt-2">
              I can help with statistics, code generation, and data interpretation
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Current project: {currentProject?.name || projectId}
            </p>
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} px-4`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 text-sm break-words ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                {typeof message.content === 'string' ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: message.content.replace(/\n/g, '<br/>') }}
                  />
                ) : (
                  <div className="space-y-2">
                    {message.content &&
                    typeof message.content === 'object' &&
                    'results' in message.content ? (
                      // Render structured results (e.g., descriptive statistics)
                      <pre className="text-xs overflow-x-auto">
                        {JSON.stringify(message.content, null, 2)}
                      </pre>
                    ) : (
                      <pre className="text-xs overflow-x-auto">
                        {JSON.stringify(message.content, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start px-4">
            <div className="bg-muted rounded-lg px-4 py-3 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
      </div>

      {/* Input area - fixed at bottom */}
      <div className="p-4 border-t border-border bg-background flex-shrink-0 min-w-0">
        <div className="relative w-full">
          <Textarea
            value={inputMessage}
            onChange={e => setInputMessage(e.target.value)}
            placeholder="Ask about your data..."
            className="min-h-[40px] max-h-[120px] resize-none w-full pr-12"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !inputMessage.trim()}
            size="sm"
            className="absolute right-2 bottom-2 h-8 w-8 p-0 rounded-md flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-4 border-t border-border bg-background flex-shrink-0 min-w-0">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Approval Dialog */}
      <ApprovalDialog
        open={approvalDialogOpen}
        onOpenChange={setApprovalDialogOpen}
        command={pendingCommand}
        onApprove={handleApprove}
        onReject={handleReject}
        isExecuting={isExecuting}
      />

      {/* Progress Indicator */}
      {isExecuting && executionProgress && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="w-full max-w-md mx-4">
            <ProgressIndicator progress={executionProgress} command={pendingCommand?.tool} />
          </div>
        </div>
      )}
    </div>
  );
}
