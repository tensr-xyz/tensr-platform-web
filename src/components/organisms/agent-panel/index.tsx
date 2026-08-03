import { Button } from '@/components/atoms/button';
import { Alert, AlertDescription } from '@/components/atoms/alert';
import { ChatComposerInput } from '@/components/molecules/chat-composer-input';
import { PillToggle } from '@/components/molecules/analysis-dialog';
import { Send, Loader2, AlertCircle, Trash2, History, Plus, X, Sparkles } from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTabsStore, ViewType, type AgentAnalysisHistoryEntry } from '@/stores/tabs-store';
import { useProjectStore } from '@/stores/project-store';
import { ColumnFiltersState } from '@tanstack/react-table';
import { v4 as uuidv4 } from 'uuid';
import { apiClient } from '@/lib/api-client';
import { getIdToken } from '@/utils/auth';
import { useChatStore } from '@/stores/chat-store';
import { useAgentModeStore, type AgentMode } from '@/stores/agent-mode-store';
import { ChatAnalysisApproval } from '@/components/molecules/chat-analysis-approval';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/atoms/tooltip';
import { cn } from '@/utils';
import { getDatasetIdFromTab, resolveWorkspaceDatasetId } from '@/lib/workspace-dataset';
import { formatApiErrorMessage } from '@/lib/api-error';
import { dispatchApplyColumnFilters } from '@/lib/spreadsheet-commands';
import { useAnalysisSetupStore } from '@/stores/analysis-setup-store';
import { AgentInlineChart } from '@/components/organisms/agent-inline-chart';
import type { AnalysisReportChart } from '@/lib/analysis-report-types';
import { chartFromAnalysisEnvelope } from '@/lib/agent-chart-from-dataset';
import type {
  AgentAnalysisPlan,
  ChatPendingAction,
  PrepPlaybookStep,
} from '@/lib/chat-pending-action';
import { plannerSpecToSetupBody, plannerTypeToOp } from '@/lib/chat-pending-action';
import { isAnalysisKey } from '@/lib/analysis-definitions';
import {
  analysisResultMarkdown,
  openResultTabForPlan,
  parseIntentForDataset,
  planFromParseIntent,
  runAgentAnalysisPlan,
  suggestFollowUpPlan,
} from '@/lib/run-agent-analysis-plan';
import { executeDataActionForDataset } from '@/lib/run-agent-data-action';
import { revealAssistantText } from '@/lib/stream-assistant-followup';
import { buildAgentConversationHistory } from '@/lib/agent-conversation-history';
import type { AgentDataAction } from '@/lib/chat-pending-action';
import { useRouter } from 'next/navigation';
import {
  PREP_PLAYBOOK_STEPS,
  applyPlaybookProposedAction,
  buildPrepPlaybookReport,
  describePlaybookApplyResult,
  fetchPlaybookStep,
  nextPlaybookStep,
} from '@/lib/prep-playbook';
import {
  collectOpenDatasetsFromTabs,
  deriveMessageUpdateFromLoopResponse,
  runAgentLoop,
  type AgentLoopApprovedToolCall,
} from '@/lib/run-agent-loop';

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
          {showPlan ? (
            <div className="prose prose-sm dark:prose-invert [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          ) : null}

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
            <div
              className={cn(
                'max-w-none',
                (showPlan || hasThinking) && 'mt-2',
                streamingResult
                  ? 'whitespace-pre-wrap leading-5 text-sm'
                  : 'prose prose-sm dark:prose-invert [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_pre]:my-2 [&_pre]:max-h-48 [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-background/80 [&_pre]:p-2 [&_pre]:text-xs'
              )}
            >
              {streamingResult ? (
                <>
                  {resultMarkdown}
                  <span
                    className="ml-0.5 inline-block h-[1.1em] w-0.5 animate-pulse bg-primary align-text-bottom"
                    aria-hidden
                  />
                </>
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{resultMarkdown!}</ReactMarkdown>
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
      <p className="px-4 py-8 text-center text-[11px] text-muted-foreground">
        No runs yet — ask the agent to analyze your data.
      </p>
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
  const router = useRouter();
  const { tabs, activeTabId, updateTab } = useTabsStore();
  const activeTab = tabs.find(tab => tab.id === activeTabId);
  const { currentProject } = useProjectStore();
  const fileSystem = useProjectStore(s => s.fileSystem);
  const projectId = currentProject?.id || 'default-project';
  const projectGlossary = currentProject?.description?.trim() || null;
  const agentMode = useAgentModeStore(s => s.getMode(projectId));
  const setAgentMode = useAgentModeStore(s => s.setMode);

  const AGENT_MODE_OPTIONS: { value: AgentMode; label: string }[] = [
    { value: 'ask', label: 'Ask' },
    { value: 'plan', label: 'Plan' },
    { value: 'agent', label: 'Agent' },
  ];

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

  // Message handling — single agent-loop API (replaces legacy gate cascade).
  const invokeAgentLoop = useCallback(
    async (opts: {
      message: string;
      assistantMessageId?: string;
      approvedToolCall?: AgentLoopApprovedToolCall;
      triggerMessage?: string;
      conversationHistory?: ReturnType<typeof buildAgentConversationHistory>;
    }) => {
      const datasetId = workspaceDatasetId ?? getDatasetIdFromTab(activeTab);
      const openDatasets = collectOpenDatasetsFromTabs(tabs);
      const conversationHistory =
        opts.conversationHistory ?? buildAgentConversationHistory(messages);
      const mode = useAgentModeStore.getState().getMode(projectId);

      const assistantMessageId =
        opts.assistantMessageId ??
        addMessage(projectId, {
          role: 'assistant',
          content: '',
          isStreaming: true,
          timestamp: new Date(),
        });

      setLoading(projectId, false);

      try {
        const response = await runAgentLoop({
          message: opts.message,
          mode,
          datasetId,
          openDatasets,
          conversationHistory,
          glossary: projectGlossary,
          approvedToolCall: opts.approvedToolCall ?? null,
        });

        const triggerMessage = opts.triggerMessage ?? opts.message;
        const patch = deriveMessageUpdateFromLoopResponse(response, {
          triggerMessage,
          datasetId,
        });
        updateMessage(projectId, assistantMessageId, patch);

        for (const entry of response.tool_results ?? []) {
          if (entry.name !== 'run_analysis' || !entry.result?.result) continue;
          const analysisType = String(entry.result.analysis_type ?? '');
          const requestBody = entry.result.request_body as Record<string, unknown> | undefined;
          if (!analysisType || !requestBody || !datasetId) continue;
          openResultTabForPlan(
            { analysisType, spec: requestBody },
            entry.result.result as Record<string, unknown>,
            datasetId,
            activeTab?.name,
            requestBody
          );
        }
      } catch (err: unknown) {
        updateMessage(projectId, assistantMessageId, {
          content: formatApiErrorMessage(err),
          isStreaming: false,
        });
        throw err;
      }
    },
    [
      activeTab,
      addMessage,
      messages,
      projectGlossary,
      projectId,
      setLoading,
      tabs,
      updateMessage,
      workspaceDatasetId,
    ]
  );

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      role: 'user' as const,
      content: inputMessage,
      timestamp: new Date(),
    };

    addMessage(projectId, userMessage);
    expirePendingSuggestionCards(projectId);

    const currentMessage = inputMessage;
    setInputMessage('');
    setLoading(projectId, true);
    setError(projectId, null);

    try {
      // Single POST /assistant/agent-loop replaces gates 1–5, menu steal, prep trigger,
      // data-intent, exploratory, analysis, quality scan, and tutor fallback.
      // (Removing the cascade also eliminates the old Gate 4 catch fall-through bug.)
      await invokeAgentLoop({
        message: currentMessage,
        triggerMessage: currentMessage,
        conversationHistory: buildAgentConversationHistory([...messages, userMessage]),
      });
    } catch (err: unknown) {
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

  /** Data-prep playbook (Track C step 2): inspects the given step and either auto-advances
   *  past a clean step, posts a confirm card for an issue, or (on the last clean step)
   *  finishes the run with a synthesized narrative. Never mutates data itself. */
  const advancePrepPlaybook = async (
    datasetId: string,
    triggerMessage: string,
    logEntries: string[],
    fromStep: PrepPlaybookStep = PREP_PLAYBOOK_STEPS[0]
  ): Promise<void> => {
    let currentDatasetId = datasetId;
    let step: PrepPlaybookStep = fromStep;
    let log = logEntries;

    // Loop rather than recurse so a run of clean steps doesn't pile up call stacks or
    // re-enter setLoading/addMessage in a way that could race with the user's next message.
    for (;;) {
      let result: Awaited<ReturnType<typeof fetchPlaybookStep>>;
      try {
        result = await fetchPlaybookStep(currentDatasetId, step);
      } catch (err) {
        addMessage(projectId, {
          role: 'assistant',
          content: `I couldn't inspect the next data-prep step (${formatApiErrorMessage(err)}).`,
          timestamp: new Date(),
        });
        return;
      }

      if (result.status === 'clean') {
        log = [...log, `${result.title}: ${result.summary}`];
        addMessage(projectId, {
          role: 'assistant',
          content: `**${result.title}** — ${result.summary}`,
          timestamp: new Date(),
        });
        if (result.is_last_step) {
          await finishPrepPlaybook(currentDatasetId, triggerMessage, log);
          return;
        }
        const next = nextPlaybookStep(step);
        if (!next) return;
        step = next;
        continue;
      }

      const detailsBlock = result.details.length
        ? `\n\n${result.details.map(d => `- ${d}`).join('\n')}`
        : '';
      addMessage(projectId, {
        role: 'assistant',
        content: `**Step ${result.step_index + 1}/${result.total_steps} — ${result.title}**\n\n${result.summary}${detailsBlock}`,
        timestamp: new Date(),
        pendingAction: {
          kind: 'prep_playbook',
          status: 'pending',
          step: result.step,
          stepIndex: result.step_index,
          totalSteps: result.total_steps,
          title: result.title,
          summaryText: result.summary,
          proposedAction: result.proposed_action,
          datasetId: currentDatasetId,
          triggerMessage,
          logEntries: log,
          isLastStep: result.is_last_step,
        },
      });
      return;
    }
  };

  /** Closing step: writes a grounded prep+analysis narrative via the existing
   *  synthesize-report assistant (Track C step 3), falling back to a plain log on failure. */
  const finishPrepPlaybook = async (
    finalDatasetId: string,
    triggerMessage: string,
    logEntries: string[]
  ): Promise<void> => {
    const messageId = addMessage(projectId, {
      role: 'assistant',
      content: 'Data prep complete. Writing a summary of what changed…',
      isStreaming: true,
      timestamp: new Date(),
    });
    try {
      // Fold in this session's completed analyses (real result summaries from
      // `analysisHistory`, e.g. regression/ANOVA runs) so the closing narrative covers
      // prep AND subsequent analysis, not prep alone. Falls back to prep-only when the
      // tab has no analysis history yet.
      const analysisEntries = activeTab?.data?.analysisHistory ?? [];
      const report = buildPrepPlaybookReport(logEntries, triggerMessage, analysisEntries);
      const { markdown } = await apiClient.assistant.synthesizeReport({
        report,
        datasetId: finalDatasetId,
        userQuestion: triggerMessage,
        prepLog: logEntries.join('\n'),
      });
      updateMessage(projectId, messageId, {
        content: markdown,
        isStreaming: false,
      });
    } catch (err) {
      const bulletLog = logEntries.length
        ? logEntries.map(l => `- ${l}`).join('\n')
        : '- No changes were needed.';
      updateMessage(projectId, messageId, {
        content:
          `Data prep complete.\n\n${bulletLog}\n\n` +
          `_Could not generate the narrative summary: ${formatApiErrorMessage(err)}_`,
        isStreaming: false,
      });
    }
    if (finalDatasetId !== workspaceDatasetId) {
      router.push(`/workspace/dataset/${finalDatasetId}`);
    }
  };

  const handlePendingSkip = (messageId: string) => {
    if (busyMessageId) return;
    if (messageId !== activeApprovalMessageId) return;

    const message = messages.find(m => m.id === messageId);
    const action = message?.pendingAction;
    if (!action || (action.status !== 'pending' && action.status !== 'failed')) return;

    if (action.kind === 'prep_playbook') {
      updateMessage(projectId, messageId, {
        pendingAction: { ...action, status: 'skipped' },
      });
      const log = [...action.logEntries, `${action.title}: skipped by user, no changes made.`];
      if (action.isLastStep) {
        void finishPrepPlaybook(action.datasetId, action.triggerMessage, log);
        return;
      }
      const next = nextPlaybookStep(action.step);
      if (next) {
        void advancePrepPlaybook(action.datasetId, action.triggerMessage, log, next);
      }
      return;
    }

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

    if (action.kind === 'prep_playbook') {
      setBusyMessageId(messageId);
      updateMessage(projectId, messageId, {
        pendingAction: { ...action, status: 'running', errorMessage: undefined },
      });
      try {
        let nextDatasetId = action.datasetId;
        let log = action.logEntries;
        if (action.proposedAction) {
          const result = await applyPlaybookProposedAction(action.proposedAction);
          const derivedId =
            typeof result.dataset_id === 'string' ? result.dataset_id : action.datasetId;
          nextDatasetId = derivedId;
          log = [...log, describePlaybookApplyResult(action, result)];
        }
        updateMessage(projectId, messageId, {
          pendingAction: { ...action, status: 'accepted' },
        });
        if (action.isLastStep) {
          await finishPrepPlaybook(nextDatasetId, action.triggerMessage, log);
        } else {
          const next = nextPlaybookStep(action.step);
          if (next) {
            await advancePrepPlaybook(nextDatasetId, action.triggerMessage, log, next);
          }
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

    if (action.kind === 'agent_tool_approval') {
      setBusyMessageId(messageId);
      updateMessage(projectId, messageId, {
        pendingAction: { ...action, status: 'running', errorMessage: undefined },
        isStreaming: true,
      });
      try {
        await invokeAgentLoop({
          message: action.triggerMessage,
          assistantMessageId: messageId,
          approvedToolCall: {
            tool_call_id: action.toolCallId,
            name: action.name,
            args: action.args,
            rationale: action.rationale,
            why_this_test: action.whyThisTest,
          },
          triggerMessage: action.triggerMessage,
        });
        const latest = getMessagePendingAction(messageId);
        if (latest?.kind === 'agent_tool_approval') {
          updateMessage(projectId, messageId, {
            pendingAction: { ...action, status: 'accepted' },
            isStreaming: false,
          });
        }
      } catch (err: unknown) {
        updateMessage(projectId, messageId, {
          pendingAction: {
            ...action,
            status: 'failed',
            errorMessage: formatApiErrorMessage(err),
          },
          isStreaming: false,
        });
      } finally {
        setBusyMessageId(null);
      }
      return;
    }

    if (action.kind === 'proposed_action') {
      setBusyMessageId(messageId);
      updateMessage(projectId, messageId, {
        pendingAction: { ...action, status: 'running', errorMessage: undefined },
      });
      try {
        const result = await applyPlaybookProposedAction(action.proposedAction);
        const derivedId = typeof result.dataset_id === 'string' ? result.dataset_id : null;
        updateMessage(projectId, messageId, {
          content: `${message?.content ?? ''}\n\n✅ **Change applied.**`.trim(),
          pendingAction: { ...action, status: 'accepted' },
        });
        if (derivedId && derivedId !== workspaceDatasetId) {
          router.push(`/workspace/dataset/${derivedId}`);
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

    if (action.kind === 'prep_playbook') {
      updateMessage(projectId, messageId, {
        pendingAction: { ...action, status: 'skipped' },
        content: `${message?.content ?? ''}\n\n_Playbook cancelled._`.trim(),
      });
      return;
    }

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
            <div className="min-h-0 flex-1 overflow-auto px-3.5 py-4">
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
                <div className="space-y-4">
                  {messages.map(message => {
                    const pendingAction = message.pendingAction;
                    const isSupersededSuggestion =
                      pendingAction?.kind === 'analysis_plan' && pendingAction.status === 'expired';
                    const showSupersededBanner =
                      isSupersededSuggestion && message.id === firstSupersededSuggestionId;

                    return (
                      <div
                        key={message.id}
                        className={cn(
                          'flex w-full flex-col gap-2',
                          message.role === 'user' ? 'items-end' : 'items-stretch'
                        )}
                      >
                        <div
                          className={cn(
                            'max-w-[85%] break-words text-[13px] leading-snug',
                            message.role === 'user'
                              ? 'rounded-xl bg-primary px-3 py-2 text-primary-foreground'
                              : 'text-foreground'
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
                                        workspaceDatasetId ?? getDatasetIdFromTab(activeTab);
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
                                        const result = await executeDataActionForDataset(dsId, {
                                          actionType: base.actionType,
                                          spec,
                                          rationale: `Retry with ${column}`,
                                          autoExecute: true,
                                        });
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
                        </div>
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
                          <p className="text-[11px] text-muted-foreground opacity-70">
                            Suggestion expired — ask again if needed
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                  {isLoading && !messages.some(m => m.isStreaming) ? (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3.5 py-2.5 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        Thinking…
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-border bg-card px-3.5 pt-3 pb-1">
              <div className="mb-2 max-w-[11rem]">
                <PillToggle
                  value={agentMode}
                  onChange={mode => setAgentMode(projectId, mode)}
                  options={AGENT_MODE_OPTIONS}
                  aria-label="Agent mode"
                />
              </div>
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
                <span>
                  <kbd className="rounded border border-border bg-muted px-1 font-mono text-[9px]">
                    ↵
                  </kbd>{' '}
                  send ·{' '}
                  <kbd className="rounded border border-border bg-muted px-1 font-mono text-[9px]">
                    ⇧↵
                  </kbd>{' '}
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
