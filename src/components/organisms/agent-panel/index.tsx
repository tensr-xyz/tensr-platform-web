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
import { Send, AlertCircle, Trash2, History, Plus } from 'lucide-react';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/atoms/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/molecules/command';
import { AgentMarkdown } from '@/components/molecules/agent-markdown';
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
import { adoptDerivedDataset, type DerivedDatasetPayload } from '@/lib/adopt-derived-dataset';
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
import {
  attachApproachToReport,
  chatFieldsAfterRunAnalysis,
  logAgentChatRenderPayload,
  preferRicherPlan,
} from '@/lib/agent-analysis-chat-fields';
import {
  analysisTabLabel,
  enrichmentCompletionNote,
  wireAnalysisChainLinks,
  type OpenedAnalysisTab,
} from '@/lib/analysis-chain-links';
import { analysisRunFingerprint } from '@/lib/open-analysis-result-tab';
import type { AnalysisReport } from '@/lib/analysis-report-types';
import { executeDataActionForDataset } from '@/lib/run-agent-data-action';
import { revealAssistantText } from '@/lib/reveal-assistant-text';
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
import { AgentWorkingLabel, ChatThreadCloseButton } from './agent-chat-chrome';

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
            <AgentWorkingLabel className={cn((showPlan || hasThinking) && 'mt-1 block')} />
          ) : null}

          {showResult ? (
            <div className={cn('max-w-none', (showPlan || hasThinking) && 'mt-2')}>
              {streamingResult ? (
                <div className="whitespace-pre-wrap text-sm leading-5">
                  {resultMarkdown}
                  <AgentWorkingLabel className="ml-1" />
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
  const router = useRouter();
  const { tabs, activeTabId, updateTab } = useTabsStore();
  const activeTab = tabs.find(tab => tab.id === activeTabId);
  const { currentProject } = useProjectStore();
  const fileSystem = useProjectStore(s => s.fileSystem);
  const projectId = currentProject?.id || 'default-project';
  const projectGlossary = currentProject?.description?.trim() || null;
  const agentMode = useAgentModeStore(s => s.getMode(projectId));
  const setAgentMode = useAgentModeStore(s => s.setMode);

  const AGENT_MODE_OPTIONS: { value: AgentMode; label: string; hint: string }[] = [
    { value: 'ask', label: 'Ask', hint: 'Read-only answers — no edits or analyses run' },
    { value: 'plan', label: 'Plan', hint: 'Propose a pipeline; approve before anything runs' },
    { value: 'agent', label: 'Agent', hint: 'Execute when confident; ask when ambiguous' },
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
  const [slashColumnsOpen, setSlashColumnsOpen] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const composerColumns = useMemo(() => {
    const cols = activeTab?.data?.initialColumns ?? [];
    return cols.map(c => String(c.header || c.id || '').trim()).filter(Boolean);
  }, [activeTab?.data?.initialColumns]);

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
      approvedToolCalls?: AgentLoopApprovedToolCall[];
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
          approvedToolCalls: opts.approvedToolCalls ?? null,
          onProgress: progress => {
            updateMessage(projectId, assistantMessageId, {
              content: progress.message,
              isStreaming: true,
            });
          },
        });

        const triggerMessage = opts.triggerMessage ?? opts.message;
        // Capture Plan/Why BEFORE the response patch overwrites chat content with
        // answer_markdown (often why_this_test alone) and clears pendingAction.
        const priorMessage = useChatStore
          .getState()
          .getMessages(projectId)
          .find(m => m.id === assistantMessageId);
        const priorContent = priorMessage?.content ?? '';
        const priorPending =
          priorMessage?.pendingAction?.kind === 'agent_tool_approval'
            ? priorMessage.pendingAction
            : null;

        const patch = deriveMessageUpdateFromLoopResponse(response, {
          triggerMessage,
          datasetId,
        });
        updateMessage(projectId, assistantMessageId, patch);

        const execSummary = String(response.execution_summary || '').trim();
        const openedTabs: OpenedAnalysisTab[] = [];
        const enrichmentNotes: string[] = [];
        let primaryChatFields: { content: string; resultMarkdown: string } | null = null;

        for (const entry of response.tool_results ?? []) {
          // Need the full tool envelope ({ result, report, run_id }), not nested
          // stats-only `result` — otherwise the tab opens without analysisReport
          // and stays on the permanent "Results loading" placeholder.
          if (entry.name !== 'run_analysis' || !entry.result?.ok || !entry.result?.result) {
            continue;
          }
          const isEnrichment = Boolean(
            (entry.args as { enrichment_step?: boolean } | undefined)?.enrichment_step
          );
          const analysisType = String(entry.result.analysis_type ?? '');
          const requestBody = entry.result.request_body as Record<string, unknown> | undefined;
          if (!analysisType || !requestBody || !datasetId) continue;

          // Prefer the pre-Approve Plan (includes Exploration step / Rejected…)
          // over a rematerialized args.rationale that may have dropped it.
          const planSummary =
            preferRicherPlan(
              priorPending?.rationale,
              String(
                (entry.args as { rationale?: string } | undefined)?.rationale ||
                  entry.result.rationale ||
                  ''
              )
            ) || null;
          const whyThisTest =
            String(
              entry.result.why_this_test ||
                (entry.args as { why_this_test?: string } | undefined)?.why_this_test ||
                priorPending?.whyThisTest ||
                ''
            ).trim() || null;
          const rejectedAlternative =
            String(
              (entry.args as { rejected_alternative?: string } | undefined)?.rejected_alternative ||
                (entry.result.report as AnalysisReport | undefined)?.approach
                  ?.rejected_alternative ||
                ''
            ).trim() || null;

          const reportWithApproach = attachApproachToReport(
            entry.result.report as AnalysisReport | undefined,
            {
              plan: isEnrichment ? null : planSummary,
              whyThisTest,
              exploration: execSummary || null,
              rejectedAlternative: isEnrichment ? null : rejectedAlternative,
            }
          );
          let report = reportWithApproach as AnalysisReport | undefined;
          if (report && execSummary) {
            report = {
              ...report,
              session_trace: report.session_trace || execSummary,
              approach: {
                ...(report.approach || {}),
                exploration: report.approach?.exploration || execSummary,
              },
            };
          }
          const envelope = {
            ...(entry.result as Record<string, unknown>),
            ...(report ? { report } : {}),
            ...(execSummary ? { execution_summary: execSummary } : {}),
          };

          // Enrichment opens in the background so the primary fit keeps focus.
          const tabId = openResultTabForPlan(
            { analysisType, spec: requestBody },
            envelope,
            datasetId,
            activeTab?.name,
            requestBody,
            { activate: !isEnrichment }
          );
          if (tabId) {
            openedTabs.push({
              tabId,
              isEnrichment,
              label: analysisTabLabel(analysisType, requestBody),
              fingerprint: analysisRunFingerprint(analysisType, requestBody),
              runId: typeof entry.result.run_id === 'string' ? entry.result.run_id : undefined,
            });
          }

          if (isEnrichment) {
            enrichmentNotes.push(enrichmentCompletionNote(analysisType, requestBody));
            continue;
          }

          // ChatMessageBody renders content AND resultMarkdown. Setting both to the
          // same report markdown is the live double-render bug — keep Plan in
          // content, report once in resultMarkdown.
          const { markdown } = analysisResultMarkdown(envelope);
          primaryChatFields = chatFieldsAfterRunAnalysis({
            priorContent,
            planSummary,
            whyThisTest,
            reportMarkdown: markdown,
          });
        }

        wireAnalysisChainLinks(openedTabs);

        if (primaryChatFields) {
          const contentWithEnrichment = enrichmentNotes.length
            ? `${primaryChatFields.content}\n\n${enrichmentNotes.join('\n')}`.trim()
            : primaryChatFields.content;
          const chatFields = {
            content: contentWithEnrichment,
            resultMarkdown: primaryChatFields.resultMarkdown,
          };
          logAgentChatRenderPayload(chatFields);
          updateMessage(projectId, assistantMessageId, {
            ...chatFields,
            isStreaming: false,
          });
        } else if (enrichmentNotes.length) {
          // Enrichment-only edge case — still acknowledge in chat.
          updateMessage(projectId, assistantMessageId, {
            content: enrichmentNotes.join('\n'),
            isStreaming: false,
          });
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

      const planSummary = String(plan.rationale || planText || '').trim() || null;
      const reportWithApproach = attachApproachToReport(
        analysisResult.report as AnalysisReport | undefined,
        { plan: planSummary, whyThisTest: null }
      );
      const analysisEnvelope = {
        ...analysisResult,
        ...(reportWithApproach ? { report: reportWithApproach } : {}),
      };
      const { markdown: markdownContent } = analysisResultMarkdown(analysisEnvelope);
      const reportChart = chartFromAnalysisEnvelope(analysisEnvelope);
      const chatFields = chatFieldsAfterRunAnalysis({
        priorContent: planText,
        planSummary,
        reportMarkdown: markdownContent,
      });
      logAgentChatRenderPayload(chatFields);

      await revealAssistantText(markdownContent, partial => {
        updateMessage(projectId, messageId, {
          resultMarkdown: partial,
          isStreaming: true,
        });
      });

      updateMessage(projectId, messageId, {
        ...chatFields,
        thinkingLines: [...progressLines],
        isStreaming: false,
        charts: reportChart ? [reportChart] : undefined,
        pendingAction: current
          ? patchPendingAction(current, { status: 'accepted', plan })
          : undefined,
      });

      openResultTabForPlan(plan, analysisEnvelope, datasetId, activeTab?.name, plan.spec);

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
        executionSummary:
          (report as { session_trace?: string }).session_trace ||
          (report as { approach?: { exploration?: string } }).approach?.exploration ||
          null,
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
        const pipeline = action.pipelineSteps;
        await invokeAgentLoop({
          message: action.triggerMessage,
          assistantMessageId: messageId,
          approvedToolCall: pipeline?.length
            ? undefined
            : {
                tool_call_id: action.toolCallId,
                name: action.name,
                args: action.args,
                rationale: action.rationale,
                why_this_test: action.whyThisTest,
              },
          approvedToolCalls: pipeline?.length ? pipeline : undefined,
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
          const adopted = adoptDerivedDataset({
            dataset_id: derivedId,
            original_filename:
              typeof result.original_filename === 'string' ? result.original_filename : undefined,
            n_rows: typeof result.n_rows === 'number' ? result.n_rows : undefined,
            n_cols: typeof result.n_cols === 'number' ? result.n_cols : undefined,
            preview: result.preview as DerivedDatasetPayload['preview'],
          });
          if (!adopted) {
            router.push(`/workspace/dataset/${derivedId}`);
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
      <div className="relative flex h-full w-full flex-col bg-background">
        <header
          className={cn(
            'flex shrink-0 items-center gap-1 border-b border-border bg-background px-2',
            compactHeader ? 'py-1' : 'py-1.5'
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
            {chatThreads.map(thread => {
              const isActive = thread.id === activeThreadId && !showRuns;
              return (
                <div
                  key={thread.id}
                  className={cn(
                    'group flex h-7 max-w-[7.5rem] shrink-0 items-center rounded-md text-[11px]',
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
                    <ChatThreadCloseButton
                      title={thread.title}
                      onClick={e => {
                        e.stopPropagation();
                        closeThread(projectId, thread.id);
                      }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
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

            <div className="shrink-0 bg-background px-3.5 pt-2 pb-1">
              <div
                className={cn(
                  'grid gap-x-1.5 gap-y-2 rounded-xl border border-border bg-muted/40 px-2 py-1.5 transition-shadow',
                  'grid-cols-[auto_minmax(0,1fr)_auto]',
                  composerExpanded ? 'items-end' : 'items-center',
                  inputMessage.trim()
                    ? 'border-border shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]'
                    : 'border-border'
                )}
                style={{
                  gridTemplateAreas: composerExpanded
                    ? `"text text text" "plus . send"`
                    : `"plus text send"`,
                }}
              >
                <div style={{ gridArea: 'plus' }}>
                  <Popover open={plusMenuOpen} onOpenChange={setPlusMenuOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 text-muted-foreground"
                        title="Choose mode"
                        aria-label="Choose Ask, Plan, or Agent mode"
                      >
                        <Plus className="size-3" aria-hidden />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-72 p-0" side="top">
                      <Command>
                        <CommandInput placeholder="Switch mode…" />
                        <CommandList>
                          <CommandEmpty>No matches</CommandEmpty>
                          <CommandGroup heading="Mode">
                            {AGENT_MODE_OPTIONS.map(opt => (
                              <CommandItem
                                key={opt.value}
                                value={`${opt.label} ${opt.hint}`}
                                onSelect={() => {
                                  setAgentMode(projectId, opt.value);
                                  setPlusMenuOpen(false);
                                  requestAnimationFrame(() => composerRef.current?.focus());
                                }}
                              >
                                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium">{opt.label}</span>
                                    {agentMode === opt.value ? (
                                      <span className="font-mono text-[10px] text-primary">
                                        active
                                      </span>
                                    ) : null}
                                  </div>
                                  <span className="text-[11px] leading-snug text-muted-foreground">
                                    {opt.hint}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div
                  style={{ gridArea: 'text' }}
                  className={cn('min-w-0', !composerExpanded && 'flex items-center')}
                >
                  <Popover open={slashColumnsOpen} onOpenChange={setSlashColumnsOpen}>
                    <PopoverAnchor asChild>
                      <div className="min-w-0 w-full">
                        <ChatComposerInput
                          ref={composerRef}
                          value={inputMessage}
                          onExpandedChange={setComposerExpanded}
                          onChange={e => {
                            const next = e.target.value;
                            setInputMessage(next);
                            if (!next.trim()) setComposerExpanded(false);
                            // Cursor-style: type / to insert a column (⌘K opens analyses).
                            if (next.endsWith('/')) setSlashColumnsOpen(true);
                          }}
                          placeholder={
                            isNotebook ? 'Write code to analyse your data…' : 'Ask about your data…'
                          }
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey && !slashColumnsOpen) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                        />
                      </div>
                    </PopoverAnchor>
                    <PopoverContent align="start" className="w-64 p-0" side="top">
                      <Command>
                        <CommandInput placeholder="Search columns…" />
                        <CommandList>
                          <CommandEmpty>
                            {composerColumns.length
                              ? 'No matching columns'
                              : 'Open a spreadsheet to pick columns'}
                          </CommandEmpty>
                          <CommandGroup heading="Columns">
                            {composerColumns.map(name => (
                              <CommandItem
                                key={name}
                                value={name}
                                onSelect={() => {
                                  setInputMessage(prev => {
                                    const base = prev.endsWith('/') ? prev.slice(0, -1) : prev;
                                    const needsSpace = Boolean(base) && !/\s$/.test(base);
                                    return `${base}${needsSpace ? ' ' : ''}${name}`;
                                  });
                                  setSlashColumnsOpen(false);
                                  requestAnimationFrame(() => composerRef.current?.focus());
                                }}
                              >
                                {name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div style={{ gridArea: 'send' }}>
                  <Button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={isLoading || !inputMessage.trim()}
                    size="icon"
                    className={cn(
                      'size-7 shrink-0 rounded-md',
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
                <span>{AGENT_MODE_OPTIONS.find(o => o.value === agentMode)?.label ?? 'Agent'}</span>
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
