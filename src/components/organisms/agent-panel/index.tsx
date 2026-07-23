import { Button } from '@/components/atoms/button';
import { Alert, AlertDescription } from '@/components/atoms/alert';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/atoms/empty';
import { Kbd } from '@/components/atoms/kbd';
import { Spinner } from '@/components/atoms/spinner';
import { ChatComposerInput } from '@/components/molecules/chat-composer-input';
import { Bubble, BubbleContent } from '@/components/molecules/bubble';
import { Marker, MarkerContent, MarkerIcon } from '@/components/molecules/marker';
import { Message, MessageContent } from '@/components/molecules/message';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerViewport,
} from '@/components/molecules/message-scroller';
import { Send, AlertCircle, Trash2, History, Plus, X, Sparkles } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { AgentMarkdown } from '@/components/molecules/agent-markdown';
import { useTabsStore, ViewType, type AgentAnalysisHistoryEntry } from '@/stores/tabs-store';
import { useProjectStore } from '@/stores/project-store';
import { ColumnFiltersState } from '@tanstack/react-table';
import { v4 as uuidv4 } from 'uuid';
import { apiClient } from '@/lib/api-client';
import { getIdToken } from '@/utils/auth';
import { useChatStore } from '@/stores/chat-store';
import { ChatAnalysisApproval } from '@/components/molecules/chat-analysis-approval';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/atoms/tooltip';
import { cn } from '@/utils';
import { getDatasetIdFromTab, resolveWorkspaceDatasetId } from '@/lib/workspace-dataset';
import { formatApiErrorMessage, ApiRequestError } from '@/lib/api-error';
import { CHAT_ACTION_HINTS, resolveChatAction } from '@/lib/chat-actions';
import { findColumnByLabel } from '@/lib/column-utils';
import {
  dispatchApplyColumnFilters,
  dispatchClearColumnFilters,
  dispatchClearSort,
  dispatchFilterColumnFocus,
  dispatchHideColumn,
  dispatchShowHiddenColumns,
  dispatchSortColumn,
} from '@/lib/spreadsheet-commands';
import { useAnalysisSetupStore } from '@/stores/analysis-setup-store';
import { recordTabSnapshot } from '@/lib/tab-history';
import { AgentInlineChart } from '@/components/organisms/agent-inline-chart';
import type { AnalysisReportChart } from '@/lib/analysis-report-types';
import {
  buildChartFromDataset,
  chartFromAnalysisEnvelope,
  fetchDatasetPreviewRows,
  isChartIntent,
  shouldRouteToInlineChart,
  stripChartBlocks,
} from '@/lib/agent-chart-from-dataset';
import type { AgentAnalysisPlan, ChatPendingAction } from '@/lib/chat-pending-action';
import { plannerSpecToSetupBody, plannerTypeToOp } from '@/lib/chat-pending-action';
import { isAnalysisKey } from '@/lib/analysis-definitions';
import {
  analysisResultMarkdown,
  assistantUpdateFromParseIntent,
  fetchExploratorySuggestions,
  openResultTabForPlan,
  parseIntentForDataset,
  pendingActionFromParseIntentUpdate,
  planFromParseIntent,
  runAgentAnalysisPlan,
  suggestFollowUpPlan,
  resetFollowUpSuggestionDedup,
  suggestionToPlan,
} from '@/lib/run-agent-analysis-plan';
import {
  executeDataActionForDataset,
  pendingFilterApplyFromResult,
  shouldRouteMessageToDataIntent,
} from '@/lib/run-agent-data-action';
import { shouldSuggestExploratoryAnalyses } from '@/lib/agent-exploratory-intent';
import { revealAssistantText, streamAssistantFollowup } from '@/lib/stream-assistant-followup';
import {
  buildAgentConversationHistory,
  isAnalysisFollowUpQuestion,
} from '@/lib/agent-conversation-history';
import { ANALYSIS_PLANNING_MESSAGE } from '@/lib/agent-analysis-progress';
import type { AgentDataAction } from '@/lib/chat-pending-action';

const ANALYSIS_HISTORY_LIMIT = 20;

const SUGGESTED_PROMPTS = [
  "What's the correlation between two numeric columns?",
  'Filter rows where a column meets a condition',
  'Run a t-test comparing two groups',
  'Summarise this dataset and flag outliers',
  'Plot the correlation between minutes and points',
];

const NOTEBOOK_SUGGESTED_PROMPTS = [
  'Plot points vs minutes played',
  'Run a correlation matrix on numeric columns',
  'Flag outliers in the PTS column',
  'Group by team and summarise mean stats',
];

const ANALYSIS_TYPE_LABELS: Record<string, string> = {
  regression: 'Regression',
  anova: 'ANOVA',
  correlations: 'Correlations',
};

function analysisHistoryTitle(analysisType: string): string {
  return (
    ANALYSIS_TYPE_LABELS[analysisType] ||
    (analysisType ? analysisType.charAt(0).toUpperCase() + analysisType.slice(1) : 'Analysis')
  );
}

function ChatMessageBody({
  role,
  content,
  thinkingLines,
  resultMarkdown,
  charts,
  isStreaming,
  repairSuggestions,
  onRepairPick,
}: {
  role: 'user' | 'assistant';
  content: string;
  thinkingLines?: string[];
  resultMarkdown?: string;
  charts?: AnalysisReportChart[];
  isStreaming?: boolean;
  repairSuggestions?: string[];
  onRepairPick?: (column: string) => void;
}) {
  if (role === 'user') {
    return <div className="whitespace-pre-wrap break-words text-sm">{content}</div>;
  }

  const hasThinking = (thinkingLines?.length ?? 0) > 0;
  const showChecklist = (thinkingLines?.length ?? 0) >= 5;
  const showPlan = Boolean(content?.trim());
  const showResult = Boolean(resultMarkdown?.trim());
  const streamingResult = isStreaming && showResult;

  return (
    <>
      {showPlan || hasThinking || showResult || isStreaming ? (
        <div className="max-w-none break-words text-sm">
          {showPlan ? <AgentMarkdown>{content}</AgentMarkdown> : null}

          {showChecklist ? (
            <ol
              className={cn(
                'mt-2 space-y-1 rounded-md border border-border/60 bg-muted/30 p-2 text-xs',
                showPlan && 'mt-2'
              )}
            >
              {thinkingLines!.map((line, i) => {
                const isLast = i === thinkingLines!.length - 1;
                const done = !isLast || !isStreaming;
                return (
                  <li
                    key={`${i}-${line.slice(0, 24)}`}
                    className="flex gap-2 text-muted-foreground"
                  >
                    <span
                      className={cn(
                        'mt-0.5 size-1.5 shrink-0 rounded-full',
                        done ? 'bg-emerald-500' : 'bg-amber-500'
                      )}
                    />
                    <span className={cn(isLast && isStreaming && 'text-foreground')}>{line}</span>
                  </li>
                );
              })}
            </ol>
          ) : hasThinking ? (
            <div className={cn('space-y-1.5', showPlan && 'mt-2')}>
              {thinkingLines!.map((line, i) => (
                <p
                  key={`${i}-${line.slice(0, 24)}`}
                  className="text-sm leading-5 text-muted-foreground"
                >
                  {line}
                </p>
              ))}
            </div>
          ) : null}

          {repairSuggestions?.length && onRepairPick ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {repairSuggestions.map(col => (
                <button
                  key={col}
                  type="button"
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-muted"
                  onClick={() => onRepairPick(col)}
                >
                  Try {col}
                </button>
              ))}
            </div>
          ) : null}

          {isStreaming && !showResult ? (
            <span
              className={cn(
                'ml-0.5 inline-block h-[1.1em] w-0.5 animate-pulse bg-primary align-text-bottom',
                (showPlan || hasThinking) && 'mt-1'
              )}
              aria-hidden
            />
          ) : null}

          {showResult ? (
            <div className={cn('max-w-none', (showPlan || hasThinking) && 'mt-2')}>
              {streamingResult ? (
                <div className="whitespace-pre-wrap text-sm leading-5">
                  {resultMarkdown}
                  <span
                    className="ml-0.5 inline-block h-[1.1em] w-0.5 animate-pulse bg-primary align-text-bottom"
                    aria-hidden
                  />
                </div>
              ) : (
                <AgentMarkdown>{resultMarkdown!}</AgentMarkdown>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
      {charts?.map((chart, i) => (
        <AgentInlineChart key={`${chart.kind}-${i}`} chart={chart} />
      ))}
    </>
  );
}

function formatAgentAnalysisSubtitle(analysisPlan: {
  analysisType: string;
  spec: Record<string, any>;
}): string {
  const spec = analysisPlan.spec || {};
  if (analysisPlan.analysisType === 'regression') {
    const inds = spec.predictors || [];
    const dep = spec.dependent;
    if (dep && inds.length) return `${dep} ~ ${inds.join(', ')}`;
    return dep || inds.join(', ') || '';
  }
  if (analysisPlan.analysisType === 'anova') {
    const g = spec.independent || spec.groups?.[0];
    return [spec.dependent, g].filter(Boolean).join(' by ');
  }
  if (analysisPlan.analysisType === 'correlations') {
    const v = spec.variables || spec.predictors || [];
    return v.join(', ');
  }
  return '';
}

function AnalysisRunsList({
  entries,
  onSelect,
}: {
  entries: AgentAnalysisHistoryEntry[];
  onSelect: (entry: AgentAnalysisHistoryEntry) => void;
}) {
  if (entries.length === 0) {
    return (
      <Empty className="min-h-0 border-0 p-6 md:p-8">
        <EmptyHeader>
          <EmptyTitle className="text-sm">No runs yet</EmptyTitle>
          <EmptyDescription className="text-[11px]">
            Ask the agent to analyze your data.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {entries.map(entry => (
        <li key={entry.id}>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onSelect(entry)}
            className="h-auto w-full justify-start rounded-none px-4 py-3 text-left font-normal text-xs hover:bg-muted/50"
          >
            <div className="block w-full">
              <div className="font-medium text-foreground">
                {analysisHistoryTitle(entry.analysisType)}
              </div>
              {entry.subtitle ? (
                <div className="truncate text-[11px] text-muted-foreground">{entry.subtitle}</div>
              ) : null}
              <div className="text-[10px] tabular-nums text-muted-foreground">
                {new Date(entry.createdAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </Button>
        </li>
      ))}
    </ul>
  );
}

type AgentPanelProps = {
  variant?: 'default' | 'notebook';
  compactHeader?: boolean;
};

export function AgentPanel({ variant = 'default', compactHeader = false }: AgentPanelProps) {
  const { tabs, activeTabId, updateTab } = useTabsStore();
  const activeTab = tabs.find(tab => tab.id === activeTabId);
  const { currentProject } = useProjectStore();
  const fileSystem = useProjectStore(s => s.fileSystem);
  const projectId = currentProject?.id || 'default-project';
  const projectGlossary = currentProject?.description?.trim() || null;

  const workspaceDatasetId = useMemo(
    () =>
      resolveWorkspaceDatasetId({
        tab: activeTab,
        projectId: currentProject?.id,
        fileSystem,
      }),
    [activeTab, currentProject?.id, fileSystem]
  );

  const {
    initializeSession,
    createThread,
    setActiveThread,
    closeThread,
    addMessage,
    updateMessage,
    expirePendingSuggestionCards,
    setLoading,
    setError,
    clearMessages,
  } = useChatStore();

  const projectChats = useChatStore(state => state.projects[projectId]);

  const chatThreads = useMemo(
    () => (projectChats ? Object.values(projectChats.threads) : []),
    [projectChats]
  );
  const activeThreadId = projectChats?.activeThreadId ?? null;
  const activeThread = activeThreadId ? projectChats?.threads[activeThreadId] : undefined;
  const messages = activeThread?.messages ?? [];
  const isLoading = activeThread?.isLoading ?? false;
  const error = activeThread?.error ?? null;

  const activeApprovalMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const pending = messages[i].pendingAction;
      if (pending?.status === 'pending') {
        return messages[i].id;
      }
    }
    for (let i = messages.length - 1; i >= 0; i--) {
      const pending = messages[i].pendingAction;
      if (pending?.status === 'failed') {
        return messages[i].id;
      }
    }
    return null;
  }, [messages]);

  /** First superseded suggestion card gets the single collapsed tombstone line. */
  const firstSupersededSuggestionId = useMemo(() => {
    for (const message of messages) {
      const pending = message.pendingAction;
      if (pending?.kind !== 'analysis_plan') continue;
      const superseded =
        pending.status === 'expired' ||
        (pending.status === 'pending' && message.id !== activeApprovalMessageId);
      if (superseded) return message.id;
    }
    return null;
  }, [messages, activeApprovalMessageId]);

  const [inputMessage, setInputMessage] = useState('');
  const [busyMessageId, setBusyMessageId] = useState<string | null>(null);
  const [showRuns, setShowRuns] = useState(false);

  const showRunsToggle = activeTab?.type === ViewType.SPREADSHEET && activeTab.data != null;
  const analysisRuns = activeTab?.data?.analysisHistory ?? [];

  const restoreAnalysisRun = async (entry: AgentAnalysisHistoryEntry) => {
    if (entry.runId) {
      const { openAnalysisRunById } = await import('@/lib/analysis-runs');
      const ok = await openAnalysisRunById(entry.runId);
      if (ok) {
        setShowRuns(false);
        return;
      }
    }
    addMessage(projectId, {
      role: 'assistant',
      content: entry.content,
      timestamp: new Date(),
    });
    setShowRuns(false);
  };

  // Initialize session when component mounts or project changes
  useEffect(() => {
    initializeSession(projectId);
  }, [projectId, initializeSession]);

  useEffect(() => {
    setShowRuns(false);
  }, [activeTabId]);

  useEffect(() => {
    if (!showRunsToggle) setShowRuns(false);
  }, [showRunsToggle]);

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

    resetFollowUpSuggestionDedup();
    expirePendingSuggestionCards(projectId);

    const currentMessage = inputMessage;
    setInputMessage('');
    setLoading(projectId, true);
    setError(projectId, null);

    const conversationHistory = buildAgentConversationHistory([...messages, userMessage]);

    try {
      // 1) Try to dispatch to the same registry the ⌘K palette uses so chat
      // can run every menu item (analyses, transform/data dialogs, direct
      // column edits) with no LLM round-trip.
      // Chart/plot requests should render inline charts, not open analysis setup.
      if (shouldRouteToInlineChart(currentMessage)) {
        // fall through to LLM + buildChartFromDataset below
      } else {
        const action = resolveChatAction(currentMessage);
        const setupStore = useAnalysisSetupStore.getState();

        if (action.kind === 'analysis') {
          const datasetIdForIntent = workspaceDatasetId ?? getDatasetIdFromTab(activeTab);
          const menuFallback = {
            op: action.op,
            menuName: action.menuName,
            triggerMessage: currentMessage,
          };
          const assistantMessageId = addMessage(projectId, {
            role: 'assistant',
            content: ANALYSIS_PLANNING_MESSAGE,
            isStreaming: true,
            timestamp: new Date(),
            pendingAction: {
              kind: 'analysis_menu',
              status: datasetIdForIntent ? 'planning' : 'pending',
              ...menuFallback,
            },
          });
          setLoading(projectId, false);

          if (datasetIdForIntent) {
            void (async () => {
              try {
                const intent = await parseIntentForDataset(
                  datasetIdForIntent,
                  currentMessage,
                  conversationHistory,
                  projectGlossary
                );
                const parsed = assistantUpdateFromParseIntent(
                  intent,
                  action.menuName,
                  currentMessage
                );
                updateMessage(projectId, assistantMessageId, {
                  content: parsed.content,
                  isStreaming: false,
                  pendingAction: pendingActionFromParseIntentUpdate(parsed, {
                    ...menuFallback,
                    triggerMessage: currentMessage,
                  }),
                });
              } catch (planError) {
                updateMessage(projectId, assistantMessageId, {
                  isStreaming: false,
                  pendingAction: {
                    kind: 'analysis_menu',
                    status: 'failed',
                    ...menuFallback,
                    errorMessage: formatApiErrorMessage(planError),
                  },
                });
              }
            })();
          }
          return;
        }

        if (action.kind === 'dialog') {
          setupStore.openDialog(action.menuName);
          addMessage(projectId, {
            role: 'assistant',
            content: `Opening **${action.menuName}**.`,
            timestamp: new Date(),
          });
          setLoading(projectId, false);
          return;
        }

        if (action.kind === 'unavailable') {
          setupStore.openUnavailable(action.menuName);
          addMessage(projectId, {
            role: 'assistant',
            content: `**${action.menuName}** isn't wired to tensr-api yet. I can run any of:\n${CHAT_ACTION_HINTS.map(h => `• ${h}`).join('\n')}`,
            timestamp: new Date(),
          });
          setLoading(projectId, false);
          return;
        }

        if (action.kind === 'rename_column') {
          if (!activeTab?.data?.initialColumns?.length) {
            throw new Error('Open a spreadsheet tab to rename a column.');
          }
          const cols = activeTab.data.initialColumns;
          const match = findColumnByLabel(cols, action.from);
          if (!match) {
            addMessage(projectId, {
              role: 'assistant',
              content: `I couldn't find a column called "${action.from}". Available columns: ${cols.map(c => c.header).join(', ')}.`,
              timestamp: new Date(),
            });
            setLoading(projectId, false);
            return;
          }
          recordTabSnapshot(activeTab.id, `Rename ${match.header} → ${action.to}`);
          const nextCols = cols.map(c =>
            c.id === match.id ? { ...c, header: action.to, accessor: action.to } : c
          );
          updateTab(activeTab.id, {
            data: { ...activeTab.data, initialColumns: nextCols },
            isDirty: true,
          });
          const liveNote = activeTab.data?.sheetId
            ? '\n\n_Note: this tab is in live-collab mode; the rename is applied locally only. Use the column header menu in the grid to broadcast renames to collaborators._'
            : '';
          addMessage(projectId, {
            role: 'assistant',
            content: `Renamed column **${match.header}** → **${action.to}**. (⌘Z to undo)${liveNote}`,
            timestamp: new Date(),
          });
          setLoading(projectId, false);
          return;
        }

        if (action.kind === 'delete_column') {
          if (!activeTab?.data?.initialColumns?.length) {
            throw new Error('Open a spreadsheet tab to delete a column.');
          }
          const cols = activeTab.data.initialColumns;
          const match = findColumnByLabel(cols, action.column);
          if (!match) {
            addMessage(projectId, {
              role: 'assistant',
              content: `I couldn't find a column called "${action.column}".`,
              timestamp: new Date(),
            });
            setLoading(projectId, false);
            return;
          }
          recordTabSnapshot(activeTab.id, `Delete column ${match.header}`);
          const nextCols = cols.filter(c => c.id !== match.id);
          const nextRows = (activeTab.data.initialData ?? []).map(row => {
            const { [match.id]: _drop, ...rest } = row;
            return rest;
          });
          updateTab(activeTab.id, {
            data: {
              ...activeTab.data,
              initialColumns: nextCols,
              initialData: nextRows,
              totalColumns: nextCols.length,
            },
            isDirty: true,
          });
          const liveNoteDel = activeTab.data?.sheetId
            ? '\n\n_Note: this tab is in live-collab mode; the delete is applied locally only and not broadcast._'
            : '';
          addMessage(projectId, {
            role: 'assistant',
            content: `Deleted column **${match.header}**. (⌘Z to undo)${liveNoteDel}`,
            timestamp: new Date(),
          });
          setLoading(projectId, false);
          return;
        }

        if (action.kind === 'sort_column') {
          if (!activeTab?.data?.initialColumns?.length) {
            throw new Error('Open a spreadsheet tab to sort a column.');
          }
          const cols = activeTab.data.initialColumns;
          const match = findColumnByLabel(cols, action.column);
          if (!match) {
            addMessage(projectId, {
              role: 'assistant',
              content: `I couldn't find a column called "${action.column}". Available columns: ${cols.map(c => c.header).join(', ')}.`,
              timestamp: new Date(),
            });
            setLoading(projectId, false);
            return;
          }
          dispatchSortColumn(match.id, action.direction);
          addMessage(projectId, {
            role: 'assistant',
            content: `Sorted **${match.header}** ${action.direction === 'desc' ? 'descending' : 'ascending'}.`,
            timestamp: new Date(),
          });
          setLoading(projectId, false);
          return;
        }

        if (action.kind === 'clear_sort') {
          dispatchClearSort();
          addMessage(projectId, {
            role: 'assistant',
            content: 'Cleared sorting.',
            timestamp: new Date(),
          });
          setLoading(projectId, false);
          return;
        }

        if (action.kind === 'filter_column') {
          if (!activeTab?.data?.initialColumns?.length) {
            throw new Error('Open a spreadsheet tab to filter a column.');
          }
          const cols = activeTab.data.initialColumns;
          const match = findColumnByLabel(cols, action.column);
          if (!match) {
            addMessage(projectId, {
              role: 'assistant',
              content: `I couldn't find a column called "${action.column}". Available columns: ${cols.map(c => c.header).join(', ')}.`,
              timestamp: new Date(),
            });
            setLoading(projectId, false);
            return;
          }

          const isNumericOp = action.operator === 'greaterThan' || action.operator === 'lessThan';
          const coerced =
            isNumericOp && !Number.isNaN(Number(action.value))
              ? Number(action.value)
              : action.value;

          const prevFilters = (activeTab.data.columnFilters ?? []) as Array<{
            id: string;
            value: { operator: string; value: unknown };
          }>;
          const nextFilters = [
            ...prevFilters.filter(f => f.id !== match.id),
            { id: match.id, value: { operator: action.operator, value: coerced } },
          ];

          updateTab(activeTab.id, {
            data: {
              ...activeTab.data,
              columnFilters: nextFilters as any,
            },
          });

          dispatchApplyColumnFilters(nextFilters, { showFilterBar: true });
          dispatchFilterColumnFocus(match.id, {
            operator: action.operator,
            value: coerced,
            showFilterBar: true,
          });

          const opLabel: Record<string, string> = {
            equals: '=',
            contains: 'contains',
            greaterThan: '>',
            lessThan: '<',
          };
          addMessage(projectId, {
            role: 'assistant',
            content: `Filtered **${match.header}** ${opLabel[action.operator]} \`${action.value}\`.`,
            timestamp: new Date(),
          });
          setLoading(projectId, false);
          return;
        }

        if (action.kind === 'clear_filters') {
          if (activeTab?.data) {
            updateTab(activeTab.id, {
              data: { ...activeTab.data, columnFilters: [] as any },
            });
          }
          dispatchClearColumnFilters();
          addMessage(projectId, {
            role: 'assistant',
            content: 'Cleared all filters.',
            timestamp: new Date(),
          });
          setLoading(projectId, false);
          return;
        }

        if (action.kind === 'hide_column') {
          if (!activeTab?.data?.initialColumns?.length) {
            throw new Error('Open a spreadsheet tab to hide a column.');
          }
          const cols = activeTab.data.initialColumns;
          const match = findColumnByLabel(cols, action.column);
          if (!match) {
            addMessage(projectId, {
              role: 'assistant',
              content: `I couldn't find a column called "${action.column}".`,
              timestamp: new Date(),
            });
            setLoading(projectId, false);
            return;
          }
          dispatchHideColumn(match.id);
          addMessage(projectId, {
            role: 'assistant',
            content: `Hid column **${match.header}**. Say "show hidden columns" to bring it back.`,
            timestamp: new Date(),
          });
          setLoading(projectId, false);
          return;
        }

        if (action.kind === 'show_hidden_columns') {
          dispatchShowHiddenColumns();
          addMessage(projectId, {
            role: 'assistant',
            content: 'Restored all hidden columns.',
            timestamp: new Date(),
          });
          setLoading(projectId, false);
          return;
        }

        if (action.kind === 'group_by' || action.kind === 'aggregate_by') {
          setupStore.openDialog('Aggregate Data');
          const cols = activeTab?.data?.initialColumns ?? [];
          const match = findColumnByLabel(cols, action.column);
          addMessage(projectId, {
            role: 'assistant',
            content: match
              ? `Opening **Aggregate Data** for column **${match.header}**.`
              : 'Opening **Aggregate Data**.',
            timestamp: new Date(),
          });
          setLoading(projectId, false);
          return;
        }
      } // end menu routing (skipped for chart/plot intents)

      // 2) Fall back to the existing LLM flows for everything else.
      if (!getIdToken()) {
        throw new Error('Authentication required. Please log in again.');
      }

      // Check if this is a data quality scan request
      const isDataQualityQuery =
        /(data quality|quality scan|check data|data issues|scan data|data problems)/i.test(
          currentMessage
        );

      const datasetIdForIntent = workspaceDatasetId ?? getDatasetIdFromTab(activeTab);

      // Phase A: count / filter / aggregate / chart / descriptive compare → parse-intent + execute
      if (datasetIdForIntent && shouldRouteMessageToDataIntent(currentMessage)) {
        // Keep the panel's "Thinking…" spinner — do not insert a fake streaming
        // bubble ("Working on that…" + caret); that stacks two loading UIs.
        try {
          const intent = await parseIntentForDataset(
            datasetIdForIntent,
            currentMessage,
            conversationHistory,
            projectGlossary
          );
          const parsed = assistantUpdateFromParseIntent(intent, 'Data action', currentMessage);

          if (parsed.type === 'clarification' || parsed.type === 'unsupported') {
            addMessage(projectId, {
              role: 'assistant',
              content: parsed.content,
              timestamp: new Date(),
            });
            setLoading(projectId, false);
            return;
          }

          if (parsed.type === 'action') {
            const result = await executeDataActionForDataset(datasetIdForIntent, parsed.action);
            const charts: AnalysisReportChart[] = [];
            if (result.chart) {
              charts.push(result.chart as AnalysisReportChart);
            }
            const pending =
              result.ok && result.filters?.length
                ? pendingFilterApplyFromResult(parsed.action, result)
                : undefined;
            const repairCols = result.repair?.suggested_columns?.filter(Boolean) ?? [];
            addMessage(projectId, {
              role: 'assistant',
              content: result.answer_markdown || parsed.content,
              timestamp: new Date(),
              charts: charts.length ? charts : undefined,
              pendingAction: pending,
              repairSuggestions: repairCols.length ? repairCols.slice(0, 5) : undefined,
              repairBase: repairCols.length
                ? {
                    actionType: parsed.action.actionType,
                    spec: {
                      ...parsed.action.spec,
                      ...(result.repair?.suggested_spec ?? {}),
                    },
                  }
                : undefined,
            });
            setLoading(projectId, false);
            return;
          }

          if (parsed.type === 'plan') {
            addMessage(projectId, {
              role: 'assistant',
              content: parsed.content,
              timestamp: new Date(),
              pendingAction: {
                kind: 'analysis_plan',
                status: 'pending',
                plan: parsed.plan,
              },
            });
            setLoading(projectId, false);
            return;
          }

          // Never fall through to followup/coach after a data-intent attempt.
          addMessage(projectId, {
            role: 'assistant',
            content:
              parsed.content ||
              'I could not turn that into a data action. Try naming the column and what you want (e.g. “top 10 by PTS”).',
            timestamp: new Date(),
          });
          setLoading(projectId, false);
          return;
        } catch (dataActionError) {
          console.warn('data-action intent failed:', dataActionError);
          addMessage(projectId, {
            role: 'assistant',
            content:
              'I could not complete that data request. Try rephrasing, or use the column Filter menu.',
            timestamp: new Date(),
          });
          setLoading(projectId, false);
          return;
        }
      }

      if (
        shouldSuggestExploratoryAnalyses(currentMessage) &&
        !shouldRouteToInlineChart(currentMessage) &&
        datasetIdForIntent
      ) {
        setLoading(projectId, false);
        try {
          expirePendingSuggestionCards(projectId);
          const suggestions = await fetchExploratorySuggestions(
            datasetIdForIntent,
            conversationHistory
          );
          if (suggestions.length > 0) {
            addMessage(projectId, {
              role: 'assistant',
              content: 'Here are a few analyses worth running on this dataset:',
              timestamp: new Date(),
            });
            for (const item of suggestions) {
              addMessage(projectId, {
                role: 'assistant',
                content: item.rationale,
                timestamp: new Date(),
                pendingAction: {
                  kind: 'analysis_plan',
                  status: 'pending',
                  plan: suggestionToPlan(item),
                },
              });
            }
            return;
          }
        } catch (exploreError) {
          console.warn('suggest-analyses failed, falling through:', exploreError);
        }
      }

      const analysisFollowUp = isAnalysisFollowUpQuestion(currentMessage, messages);

      // Analysis questions: parse-intent (tensr-api) when dataset is open
      const isAnalysisQuestion =
        analysisFollowUp ||
        /(predict|analyze|analys|relationship|correlation|regression|anova|compare|difference|effect|impact|test|wilcoxon|mann|kruskal|chi|crosstab|pca|cluster|factor|reliability|normality|shapiro|sign test|mcnemar|probit|logistic|poisson|ttest|t-test|kappa|cohen|spearman|kendall|canonical|discriminant|manova|ancova|glmm|mixed model|survival|kaplan|cox|arima)/i.test(
          currentMessage
        );

      if (isAnalysisQuestion && !shouldRouteToInlineChart(currentMessage) && datasetIdForIntent) {
        const menuFallback = {
          op: 'ttest_independent' as const,
          menuName: 'Analysis',
          triggerMessage: currentMessage,
        };
        const assistantMessageId = addMessage(projectId, {
          role: 'assistant',
          content: ANALYSIS_PLANNING_MESSAGE,
          isStreaming: true,
          timestamp: new Date(),
          pendingAction: {
            kind: 'analysis_menu',
            status: 'planning',
            ...menuFallback,
          },
        });
        setLoading(projectId, false);

        try {
          const intent = await parseIntentForDataset(
            datasetIdForIntent,
            currentMessage,
            conversationHistory,
            projectGlossary
          );
          const parsed = assistantUpdateFromParseIntent(
            intent,
            intent.analysis_type?.replace(/_/g, ' ') ?? 'Analysis',
            currentMessage
          );
          const planOp =
            intent.analysis_type && isAnalysisKey(intent.analysis_type)
              ? intent.analysis_type
              : 'ttest_independent';
          const menuFallbackForIntent = {
            op: planOp,
            menuName: intent.analysis_type?.replace(/_/g, ' ') ?? 'Analysis',
            triggerMessage: currentMessage,
          };
          if (parsed.type === 'action') {
            try {
              const result = await executeDataActionForDataset(datasetIdForIntent, parsed.action);
              const charts: AnalysisReportChart[] = [];
              if (result.chart) {
                charts.push(result.chart as AnalysisReportChart);
              }
              const pending =
                result.ok && result.filters?.length
                  ? pendingFilterApplyFromResult(parsed.action, result)
                  : undefined;
              updateMessage(projectId, assistantMessageId, {
                content: result.answer_markdown || parsed.content,
                isStreaming: false,
                charts: charts.length ? charts : undefined,
                pendingAction: pending,
              });
            } catch (actionErr) {
              updateMessage(projectId, assistantMessageId, {
                content: parsed.content,
                isStreaming: false,
                pendingAction: {
                  kind: 'data_action',
                  status: 'failed',
                  action: parsed.action,
                  errorMessage: formatApiErrorMessage(actionErr),
                },
              });
            }
            return;
          }

          updateMessage(projectId, assistantMessageId, {
            role: 'assistant',
            content: parsed.content,
            isStreaming: false,
            timestamp: new Date(),
            ...(parsed.type === 'plan' || parsed.type === 'no_plan'
              ? {
                  pendingAction: pendingActionFromParseIntentUpdate(parsed, menuFallbackForIntent),
                }
              : {
                  pendingAction: undefined,
                }),
          });
          return;
        } catch (planError) {
          console.warn('parse-intent failed, falling through:', planError);
          updateMessage(projectId, assistantMessageId, {
            isStreaming: false,
            pendingAction: {
              kind: 'analysis_menu',
              status: 'failed',
              ...menuFallback,
              errorMessage: formatApiErrorMessage(planError),
            },
          });
        }
      }

      // Handle data quality scan
      if (isDataQualityQuery && activeTab?.data) {
        try {
          const datasetId = workspaceDatasetId;
          if (!datasetId) {
            throw new Error('Open a dataset-backed tab before running a quality scan.');
          }
          const datasetSchema = {
            datasetId,
            columns:
              activeTab.data.initialColumns?.map((col: any) => ({
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
          setError(projectId, formatApiErrorMessage(error));
          setLoading(projectId, false);
          return;
        }
      }

      // General chat: tensr-api assistant follow-up (dataset-scoped; no legacy /projects/.../agent route).
      const datasetId = workspaceDatasetId ?? getDatasetIdFromTab(activeTab);
      if (!datasetId) {
        addMessage(projectId, {
          role: 'assistant',
          content:
            'Open a **dataset-backed** tab in this workspace (import from Home or open an existing dataset) so I can read the column list and answer questions.',
          timestamp: new Date(),
        });
        setLoading(projectId, false);
        return;
      }

      const followupContext =
        activeTab?.type === ViewType.ANALYSIS_RESULT
          ? {
              analysis_key: activeTab.data?.analysisOp,
              results: activeTab.data?.analysisResult ?? null,
            }
          : null;

      const streamMessageId = addMessage(projectId, {
        role: 'assistant',
        content: '',
        isStreaming: true,
        timestamp: new Date(),
      });
      setLoading(projectId, false);

      let followup: { answer_markdown: string; source: string };
      try {
        followup = await streamAssistantFollowup(
          {
            datasetId,
            message: currentMessage,
            context: followupContext,
            conversationHistory,
          },
          {
            onDelta: (_delta, fullText) => {
              updateMessage(projectId, streamMessageId, {
                content: fullText,
                isStreaming: true,
              });
            },
          }
        );
      } catch (streamErr) {
        const status = streamErr instanceof ApiRequestError ? streamErr.status : 0;
        if (status !== 404 && status !== 405) {
          throw streamErr;
        }
        const buffered = await apiClient.assistant.followup({
          datasetId,
          message: currentMessage,
          context: followupContext,
          conversationHistory,
        });
        followup = {
          answer_markdown: buffered.answer_markdown?.trim() || '_No answer returned._',
          source: buffered.source,
        };
        await revealAssistantText(followup.answer_markdown, partial => {
          updateMessage(projectId, streamMessageId, { content: partial, isStreaming: true });
        });
      }

      let answerText = followup.answer_markdown?.trim() || '_No answer returned._';
      const stripped = stripChartBlocks(answerText);
      answerText = stripped.text || answerText;
      const inlineCharts = [...stripped.charts];
      if (isChartIntent(currentMessage) && activeTab?.data?.initialColumns) {
        const columns = activeTab.data.initialColumns.map(c => ({
          id: c.id,
          header: c.header,
        }));
        let rows = activeTab.data.initialData ?? [];
        if (!rows.length && datasetId) {
          rows = await fetchDatasetPreviewRows(datasetId);
        }
        if (rows.length) {
          const built = buildChartFromDataset(currentMessage, columns, rows);
          if (built) inlineCharts.push(built);
        }
      }
      updateMessage(projectId, streamMessageId, {
        content: answerText,
        charts: inlineCharts.length ? inlineCharts : undefined,
        isStreaming: false,
      });
      return;
    } catch (err: any) {
      setError(projectId, formatApiErrorMessage(err));
    } finally {
      setLoading(projectId, false);
    }
  };

  const patchPendingAction = (
    action: ChatPendingAction,
    patch: {
      status: ChatPendingAction['status'];
      plan?: AgentAnalysisPlan;
      errorMessage?: string;
    }
  ): ChatPendingAction => {
    const plan = patch.plan ?? (action.kind === 'analysis_plan' ? action.plan : undefined);
    if (plan) {
      const isChained = Boolean(
        plan.isChained || (action.kind === 'analysis_plan' && action.isChained)
      );
      return {
        kind: 'analysis_plan',
        status: patch.status,
        plan: isChained ? { ...plan, isChained: true } : plan,
        ...(isChained ? { isChained: true as const } : {}),
        errorMessage: patch.errorMessage,
      };
    }
    return {
      ...action,
      status: patch.status,
      errorMessage: patch.errorMessage,
    };
  };

  const getMessagePendingAction = (messageId: string): ChatPendingAction | undefined => {
    const threadId = useChatStore.getState().projects[projectId]?.activeThreadId;
    const thread = threadId
      ? useChatStore.getState().projects[projectId]?.threads[threadId]
      : undefined;
    return thread?.messages.find(m => m.id === messageId)?.pendingAction;
  };

  const resolvePendingPlan = async (
    messageId: string,
    action: ChatPendingAction
  ): Promise<AgentAnalysisPlan | null> => {
    if (action.kind === 'analysis_plan') {
      const fresh = getMessagePendingAction(messageId);
      const freshAction = fresh?.kind === 'analysis_plan' ? fresh : action;
      const plan = freshAction.plan;
      const isChained = Boolean(plan.isChained || freshAction.isChained);
      return isChained ? { ...plan, isChained: true } : plan;
    }
    if (action.kind !== 'analysis_menu' || !activeTab?.data?.initialColumns) {
      return null;
    }
    const datasetId = workspaceDatasetId;
    if (!datasetId) return null;
    const intent = await parseIntentForDataset(
      datasetId,
      action.triggerMessage,
      buildAgentConversationHistory(messages),
      projectGlossary
    );
    const agentPlan = planFromParseIntent(intent);
    if (!agentPlan) {
      return null;
    }
    updateMessage(projectId, messageId, {
      pendingAction: patchPendingAction(action, { status: 'planning', plan: agentPlan }),
    });
    return agentPlan;
  };

  const executeAnalysisPlan = async (messageId: string, plan: AgentAnalysisPlan) => {
    expirePendingSuggestionCards(projectId, messageId);

    const message = messages.find(m => m.id === messageId);
    const current = message?.pendingAction;
    const planText = (message?.content ?? plan.rationale ?? '').trim();
    const progressLines: string[] = [];
    const seenProgress = new Set<string>();

    const pushProgress = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed || seenProgress.has(trimmed)) return;
      seenProgress.add(trimmed);
      progressLines.push(trimmed);
      updateMessage(projectId, messageId, {
        thinkingLines: [...progressLines],
        isStreaming: true,
        pendingAction: current
          ? patchPendingAction(current, { status: 'running', plan })
          : undefined,
      });
    };

    if (current) {
      updateMessage(projectId, messageId, {
        pendingAction: patchPendingAction(current, { status: 'running', plan }),
        isStreaming: true,
      });
    }

    try {
      if (!getIdToken()) {
        throw new Error('Authentication required. Please log in again.');
      }

      const datasetId = workspaceDatasetId ?? getDatasetIdFromTab(activeTab);
      if (!datasetId) {
        throw new Error('Open a dataset workspace tab before running analysis.');
      }

      const analysisResult = await runAgentAnalysisPlan(datasetId, plan, {
        onProgress: (_step, progressMessage) => pushProgress(progressMessage),
      });
      if (!analysisResult) {
        throw new Error(
          `Analysis type "${plan.analysisType}" is not supported for auto-run yet. Use Manage to configure manually.`
        );
      }

      const { markdown: markdownContent } = analysisResultMarkdown(analysisResult);
      const reportChart = chartFromAnalysisEnvelope(analysisResult);

      await revealAssistantText(markdownContent, partial => {
        updateMessage(projectId, messageId, {
          resultMarkdown: partial,
          isStreaming: true,
        });
      });

      updateMessage(projectId, messageId, {
        content: planText,
        thinkingLines: [...progressLines],
        resultMarkdown: markdownContent,
        isStreaming: false,
        charts: reportChart ? [reportChart] : undefined,
        pendingAction: current
          ? patchPendingAction(current, { status: 'accepted', plan })
          : undefined,
      });

      openResultTabForPlan(plan, analysisResult, datasetId, activeTab?.name, plan.spec);

      if (activeTab?.type === ViewType.SPREADSHEET && activeTab.data) {
        const prev = activeTab.data.analysisHistory ?? [];
        const entry: AgentAnalysisHistoryEntry = {
          id: uuidv4(),
          createdAt: new Date().toISOString(),
          analysisType: plan.analysisType,
          content: markdownContent,
          subtitle: formatAgentAnalysisSubtitle(plan) || undefined,
        };
        updateTab(activeTab.id, {
          data: {
            ...activeTab.data,
            analysisHistory: [entry, ...prev].slice(0, ANALYSIS_HISTORY_LIMIT),
          },
        });
      }

      const freshAction = getMessagePendingAction(messageId);
      const completedPlan: AgentAnalysisPlan = {
        ...plan,
        isChained: Boolean(
          plan.isChained ||
          (freshAction?.kind === 'analysis_plan' && freshAction.isChained) ||
          (freshAction?.kind === 'analysis_plan' && freshAction.plan.isChained)
        ),
      };

      if (!completedPlan.isChained) {
        const followUp = suggestFollowUpPlan(
          analysisResult,
          completedPlan.analysisType,
          completedPlan.spec,
          completedPlan
        );
        if (followUp) {
          addMessage(projectId, {
            role: 'assistant',
            content: followUp.rationale,
            timestamp: new Date(),
            ...(followUp.warningOnly || !followUp.plan
              ? {}
              : {
                  pendingAction: {
                    kind: 'analysis_plan',
                    status: 'pending',
                    plan: followUp.plan,
                    isChained: true,
                  },
                }),
          });
        }
      }
    } catch (err: unknown) {
      const latestAction = getMessagePendingAction(messageId);
      if (latestAction) {
        updateMessage(projectId, messageId, {
          isStreaming: false,
          pendingAction: patchPendingAction(latestAction, {
            status: 'failed',
            plan,
            errorMessage: formatApiErrorMessage(err),
          }),
        });
      }
    } finally {
      setBusyMessageId(null);
    }
  };

  const handlePendingSkip = (messageId: string) => {
    if (busyMessageId) return;
    if (messageId !== activeApprovalMessageId) return;

    const message = messages.find(m => m.id === messageId);
    const action = message?.pendingAction;
    if (!action || (action.status !== 'pending' && action.status !== 'failed')) return;

    updateMessage(projectId, messageId, {
      pendingAction: patchPendingAction(action, { status: 'skipped' }),
    });
    setBusyMessageId(null);
  };

  const applyDataActionFilters = (
    filters: Array<{ columnId: string; operator: string; value: unknown }>
  ) => {
    if (!activeTab?.data) return;
    const newFilters: ColumnFiltersState = filters.map(filter => ({
      id: filter.columnId,
      value: {
        operator: filter.operator,
        value: filter.value,
      },
    }));
    updateTab(activeTab.id, {
      data: {
        ...activeTab.data,
        columnFilters: newFilters as any,
      },
    });
    dispatchApplyColumnFilters(
      newFilters.map(f => ({
        id: f.id,
        value: f.value as { operator: string; value: unknown },
      })),
      { showFilterBar: true }
    );
  };

  const handlePendingAccept = async (messageId: string) => {
    if (busyMessageId) return;
    if (messageId !== activeApprovalMessageId) return;

    const message = messages.find(m => m.id === messageId);
    const action = message?.pendingAction;
    if (!action || (action.status !== 'pending' && action.status !== 'failed')) return;

    if (action.kind === 'data_action') {
      setBusyMessageId(messageId);
      updateMessage(projectId, messageId, {
        pendingAction: { ...action, status: 'running', errorMessage: undefined },
      });
      try {
        const filters = (
          action.action.spec.filters as
            | Array<{ columnId?: string; column?: string; operator: string; value: unknown }>
            | undefined
        )
          ?.map(f => ({
            columnId: String(f.columnId || f.column || ''),
            operator: f.operator,
            value: f.value,
          }))
          .filter(f => f.columnId);

        if (filters?.length) {
          applyDataActionFilters(filters);
          updateMessage(projectId, messageId, {
            content:
              (message?.content ? `${message.content}\n\n` : '') +
              '✅ **Filter applied** to the spreadsheet.',
            pendingAction: { ...action, status: 'accepted' },
          });
        } else {
          const datasetId = workspaceDatasetId ?? getDatasetIdFromTab(activeTab);
          if (!datasetId) throw new Error('Open a dataset before applying this action.');
          const result = await executeDataActionForDataset(
            datasetId,
            action.action as AgentDataAction
          );
          if (result.filters?.length) {
            applyDataActionFilters(result.filters);
          }
          updateMessage(projectId, messageId, {
            content: result.answer_markdown || message?.content || 'Done.',
            pendingAction: { ...action, status: 'accepted' },
          });
        }
      } catch (err: unknown) {
        updateMessage(projectId, messageId, {
          pendingAction: {
            ...action,
            status: 'failed',
            errorMessage: formatApiErrorMessage(err),
          },
        });
      } finally {
        setBusyMessageId(null);
      }
      return;
    }

    setBusyMessageId(messageId);
    updateMessage(projectId, messageId, {
      pendingAction: patchPendingAction(action, {
        status: 'planning',
        errorMessage: undefined,
        plan: action.kind === 'analysis_plan' ? action.plan : undefined,
      }),
    });

    try {
      const plan = await resolvePendingPlan(messageId, action);
      if (!plan) {
        const latestAction = getMessagePendingAction(messageId) ?? action;
        updateMessage(projectId, messageId, {
          pendingAction: patchPendingAction(latestAction, {
            status: 'failed',
            errorMessage: 'Could not plan this analysis. Use Manage to set variables manually.',
          }),
        });
        setBusyMessageId(null);
        return;
      }
      await executeAnalysisPlan(messageId, plan);
    } catch (err: unknown) {
      const latestAction = getMessagePendingAction(messageId) ?? action;
      updateMessage(projectId, messageId, {
        pendingAction: patchPendingAction(latestAction, {
          status: 'failed',
          errorMessage: formatApiErrorMessage(err),
          plan: latestAction.kind === 'analysis_plan' ? latestAction.plan : undefined,
        }),
      });
      setBusyMessageId(null);
    }
  };

  const handlePendingManage = (messageId: string) => {
    if (busyMessageId) return;
    if (messageId !== activeApprovalMessageId) return;

    const message = messages.find(m => m.id === messageId);
    const action = message?.pendingAction;
    if (!action || action.status === 'planning' || action.status === 'running') return;

    const setupStore = useAnalysisSetupStore.getState();

    if (action.kind === 'analysis_menu') {
      setupStore.openSetup(action.op);
      updateMessage(projectId, messageId, {
        pendingAction: patchPendingAction(action, { status: 'skipped' }),
      });
      return;
    }

    if (action.kind !== 'analysis_plan') {
      updateMessage(projectId, messageId, {
        pendingAction: { ...action, status: 'skipped' },
      });
      return;
    }

    const op = isAnalysisKey(action.plan.analysisType)
      ? action.plan.analysisType
      : plannerTypeToOp(action.plan.analysisType);
    if (!op) {
      updateMessage(projectId, messageId, {
        pendingAction: patchPendingAction(action, {
          status: 'failed',
          errorMessage: `Setup is not available for "${action.plan.analysisType}". Try rephrasing your question.`,
        }),
      });
      return;
    }
    const body = isAnalysisKey(action.plan.analysisType)
      ? action.plan.spec
      : plannerSpecToSetupBody(action.plan.analysisType, action.plan.spec);
    setupStore.openSetup(op, body);
    updateMessage(projectId, messageId, {
      pendingAction: patchPendingAction(action, { status: 'skipped' }),
    });
  };

  const colCount = activeTab?.data?.initialColumns?.length ?? 0;
  const rowCount = activeTab?.data?.totalRows ?? activeTab?.data?.initialData?.length ?? 0;
  const isNotebook = variant === 'notebook';
  const suggestedPrompts = isNotebook ? NOTEBOOK_SUGGESTED_PROMPTS : SUGGESTED_PROMPTS;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="relative flex h-full w-full flex-col bg-muted/30">
        <header className="shrink-0 border-b border-border bg-card">
          <div
            className={cn(
              'flex items-center justify-between gap-2 px-3.5',
              compactHeader ? 'py-2' : 'py-3'
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
                <Sparkles className="size-3" aria-hidden />
              </span>
              <div className="min-w-0 leading-tight">
                <p className="text-[13px] font-medium text-foreground">Tensr Agent</p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {isNotebook
                    ? colCount > 0
                      ? 'Code generation · notebook'
                      : 'Notebook · needs dataset'
                    : colCount > 0
                      ? `Connected · ${analysisRuns.length} ops`
                      : 'Open a dataset tab'}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => {
                      createThread(projectId);
                      setShowRuns(false);
                    }}
                    aria-label="New chat"
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">New chat</TooltipContent>
              </Tooltip>
              {showRunsToggle ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn('relative size-7', showRuns && 'bg-muted')}
                      onClick={() => setShowRuns(v => !v)}
                      aria-label="Analysis runs"
                      aria-pressed={showRuns}
                    >
                      <History className="size-3.5" />
                      {analysisRuns.length > 0 ? (
                        <span className="absolute right-0 top-0 flex size-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-medium text-primary-foreground">
                          {analysisRuns.length > 9 ? '9+' : analysisRuns.length}
                        </span>
                      ) : null}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Analysis runs</TooltipContent>
                </Tooltip>
              ) : null}
              {!showRuns && messages.length > 0 ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => clearMessages(projectId)}
                      aria-label="Clear chat"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Clear chat</TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          </div>
          {!showRuns && chatThreads.length > 0 ? (
            <div className="flex gap-0.5 overflow-x-auto border-t border-border/80 px-1 py-1">
              {chatThreads.map(thread => {
                const isActive = thread.id === activeThreadId;
                return (
                  <div
                    key={thread.id}
                    className={cn(
                      'group flex h-7 max-w-[7rem] shrink-0 items-center rounded-md text-[11px]',
                      isActive
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted/60'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveThread(projectId, thread.id);
                        setShowRuns(false);
                      }}
                      className="min-w-0 flex-1 truncate px-2 py-1 text-left"
                      title={thread.title}
                    >
                      {thread.title}
                    </button>
                    {chatThreads.length > 1 ? (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          closeThread(projectId, thread.id);
                        }}
                        className="mr-0.5 rounded p-0.5 opacity-0 group-hover:opacity-100"
                        aria-label={`Close ${thread.title}`}
                      >
                        <X className="size-3" />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </header>

        {showRuns ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <p className="shrink-0 border-b border-border px-3 py-1.5 text-[10px] text-muted-foreground">
              Open a run in the active chat.
            </p>
            <div className="min-h-0 flex-1 overflow-auto">
              <AnalysisRunsList entries={analysisRuns} onSelect={restoreAnalysisRun} />
            </div>
          </div>
        ) : (
          <>
            <MessageScroller className="min-h-0 flex-1">
              <MessageScrollerViewport className="px-3.5 py-4">
                {messages.length === 0 && !isLoading ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border/80 bg-gradient-to-b from-primary/10 to-transparent p-4">
                      <div className="mb-2.5 flex items-center gap-2">
                        <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                          {isNotebook ? 'Code assistant' : 'Reading dataset'}
                        </p>
                      </div>
                      <p className="text-[13.5px] leading-relaxed text-foreground">
                        {isNotebook ? (
                          colCount > 0 ? (
                            <>
                              Write code to analyse your data — I&apos;ll draft cells you can run in
                              the notebook ({rowCount.toLocaleString()} rows, {colCount} columns).
                            </>
                          ) : (
                            'Open a dataset tab, then ask me to write Python or R for your notebook.'
                          )
                        ) : colCount > 0 ? (
                          <>
                            I see <strong>{rowCount.toLocaleString()}</strong> rows across{' '}
                            <strong>{colCount} columns</strong>. Ask me anything, or pick a starter:
                          </>
                        ) : (
                          'Open a spreadsheet tab with data, then ask me to analyse, filter, or explain results.'
                        )}
                      </p>
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Suggested
                    </p>
                    <div className="flex flex-col gap-2">
                      {suggestedPrompts.map(label => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => {
                            setInputMessage(label);
                          }}
                          className="rounded-lg border border-border bg-card px-3 py-2.5 text-left text-[12.5px] leading-snug text-foreground transition-colors hover:border-primary hover:bg-primary/5"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <MessageScrollerContent>
                    {messages.map(message => {
                      const pendingAction = message.pendingAction;
                      const isSupersededSuggestion =
                        pendingAction?.kind === 'analysis_plan' &&
                        pendingAction.status === 'expired';
                      const showSupersededBanner =
                        isSupersededSuggestion && message.id === firstSupersededSuggestionId;
                      const align = message.role === 'user' ? 'end' : 'start';

                      return (
                        <MessageScrollerItem key={message.id}>
                          <Message align={align} className="flex-col gap-2">
                            <MessageContent
                              className={cn(
                                'max-w-[85%] text-[13px] leading-snug',
                                message.role === 'user' ? '' : 'max-w-full'
                              )}
                            >
                              <Bubble
                                variant={message.role === 'user' ? 'default' : 'ghost'}
                                align={align}
                                className={message.role === 'user' ? '' : 'max-w-full'}
                              >
                                <BubbleContent
                                  className={cn(
                                    message.role === 'user'
                                      ? 'text-[13px] leading-snug'
                                      : 'w-full max-w-none text-[13px] leading-snug text-foreground'
                                  )}
                                >
                                  {typeof message.content === 'string' ? (
                                    <ChatMessageBody
                                      role={message.role}
                                      content={message.content}
                                      thinkingLines={message.thinkingLines}
                                      resultMarkdown={message.resultMarkdown}
                                      charts={message.charts}
                                      isStreaming={message.isStreaming}
                                      repairSuggestions={message.repairSuggestions}
                                      onRepairPick={
                                        message.repairBase
                                          ? (column: string) => {
                                              const dsId =
                                                workspaceDatasetId ??
                                                getDatasetIdFromTab(activeTab);
                                              if (!dsId) return;
                                              void (async () => {
                                                const base = message.repairBase!;
                                                const spec = {
                                                  ...base.spec,
                                                  column,
                                                  value_column: column,
                                                  y_column: column,
                                                  x_column: column,
                                                };
                                                const result = await executeDataActionForDataset(
                                                  dsId,
                                                  {
                                                    actionType: base.actionType,
                                                    spec,
                                                    rationale: `Retry with ${column}`,
                                                    autoExecute: true,
                                                  }
                                                );
                                                const charts: AnalysisReportChart[] = [];
                                                if (result.chart) {
                                                  charts.push(result.chart as AnalysisReportChart);
                                                }
                                                updateMessage(projectId, message.id, {
                                                  content: result.answer_markdown,
                                                  charts: charts.length ? charts : undefined,
                                                  repairSuggestions: undefined,
                                                  repairBase: undefined,
                                                });
                                              })();
                                            }
                                          : undefined
                                      }
                                    />
                                  ) : (
                                    <pre className="overflow-x-auto text-xs">
                                      {JSON.stringify(message.content, null, 2)}
                                    </pre>
                                  )}
                                </BubbleContent>
                              </Bubble>
                            </MessageContent>
                            {pendingAction && !isSupersededSuggestion ? (
                              <ChatAnalysisApproval
                                className="w-full"
                                action={pendingAction}
                                disabled={busyMessageId !== null && busyMessageId !== message.id}
                                onSkip={() => handlePendingSkip(message.id)}
                                onAccept={() => void handlePendingAccept(message.id)}
                                onManage={() => handlePendingManage(message.id)}
                              />
                            ) : showSupersededBanner ? (
                              <Marker role="status">
                                <MarkerContent className="text-[11px] opacity-70">
                                  Suggestion expired — ask again if needed
                                </MarkerContent>
                              </Marker>
                            ) : null}
                          </Message>
                        </MessageScrollerItem>
                      );
                    })}
                    {isLoading && !messages.some(m => m.isStreaming) ? (
                      <MessageScrollerItem>
                        <Marker
                          role="status"
                          className="rounded-2xl border border-border bg-card px-3.5 py-2.5"
                        >
                          <MarkerIcon>
                            <Spinner />
                          </MarkerIcon>
                          <MarkerContent>Thinking…</MarkerContent>
                        </Marker>
                      </MessageScrollerItem>
                    ) : null}
                  </MessageScrollerContent>
                )}
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>

            <div className="shrink-0 border-t border-border bg-card px-3.5 pt-3 pb-1">
              <div
                className={cn(
                  'rounded-xl border bg-card p-2.5 transition-shadow',
                  inputMessage.trim()
                    ? 'border-border shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]'
                    : 'border-border'
                )}
              >
                <ChatComposerInput
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                  placeholder={
                    isNotebook ? 'Write code to analyse your data…' : 'Ask about your data…'
                  }
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <div className="mt-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 font-mono text-[11px] text-muted-foreground"
                      title="Reference column"
                    >
                      @
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 font-mono text-[11px] text-muted-foreground"
                      title="Slash command"
                    >
                      /
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground"
                      title="Attach"
                    >
                      <Plus className="size-3" aria-hidden />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={isLoading || !inputMessage.trim()}
                    size="icon"
                    className={cn(
                      'size-7 rounded-md',
                      inputMessage.trim()
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <Send className="size-3" aria-hidden />
                  </Button>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                <span>claude-haiku</span>
                <span className="inline-flex items-center gap-1">
                  <Kbd className="h-4 min-w-0 px-1 font-mono text-[9px]">↵</Kbd>
                  send ·<Kbd className="h-4 min-w-0 px-1 font-mono text-[9px]">⇧↵</Kbd>
                  newline
                </span>
              </div>
            </div>

            {error ? (
              <div className="shrink-0 border-t border-border bg-background p-4 min-w-0">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </div>
            ) : null}
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
