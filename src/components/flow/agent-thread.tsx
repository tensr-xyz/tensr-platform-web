'use client';

import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useDatasetAudiences,
  useMe,
  useProjectMembers,
  useProjectSessions,
} from '@/hooks/api/use-project-data';
import { invalidateProjectSessions, projectQueryKeys } from '@/lib/project-query-cache';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/atoms/empty';
import { Button } from '@/components/ui/button';
import { archiveChatTurn, type ChatExchange } from '@/components/flow/chat-thread';
import {
  chatRunInFlight,
  liveChatRun,
  livePublishMatches,
  publishLiveChatRun,
  subscribeLiveChatRun,
} from '@/components/flow/chat-live-run';
import { answerIsNotInData, stripNotInDataLead } from '@/components/flow/asker-answer';
import { FlowComposer, readChatAttachments } from '@/components/flow/chat-composer';
import { AnalysisResult } from '@/components/flow/analysis-result';
import {
  answerTables,
  answerWithoutBase,
  answerWithoutTables,
  withoutResultTokens,
  withoutStrayEnding,
  outputBaseClause,
  analysisFailureMessage,
  outputCardReady,
  outputChecks,
  hasSummaryTable,
  isAnalysisPending,
  isClientDeckResult,
  analysisReportHref,
  analysisSlideHref,
  clientDeckReportHref,
  isProcedurePlaceholder,
  keptModelAnswer,
  readableTurnAnswer,
  EMPTY_TURN_ANSWER,
  CONTINUING_TURN_ANSWER,
  UNFINISHED_TURN_ANSWER,
  outputKind,
  outputRunIds,
  outputStat,
  outputTakeaway,
  outputTitle,
  resultLead,
  guardUserText,
  isDeferredResultProse,
  titledWithQuestion,
} from '@/components/flow/chat-output';
import { BuildingTableCard } from '@/components/organisms/agent-panel/agent-chat-chrome';
import { ThreadResult, useEnrichedToolResults } from '@/components/flow/use-enriched-results';
import {
  answerResultTables,
  resultFootnote,
  resultViewFromToolResults,
  type ColumnLabels,
} from '@/components/flow/result-tables';
import { FlowMarkdown } from '@/components/flow/flow-markdown';
import { savePin, useProjectPins } from '@/components/flow/report-pins';
import {
  answeredTurnCount,
  restoredChatAnswer,
  savedChatTurn,
  type StoredChatSession,
  type StoredChatTurn,
} from '@/lib/chat-session-turn';
import { flowJson } from '@/lib/flow-api';
import { clientDeckFinishedSummary, clientDeckNeedsLiveResolve } from '@/lib/client-deck-job';
import {
  downloadsFromToolResults,
  openSignedDownload,
  type ExportDownload,
} from '@/lib/excel-download';
import { formatApiErrorMessage } from '@/lib/api-error';
import {
  AGENT_LOOP_RETRYING_MESSAGE,
  runAgentLoop,
  type AgentLoopAttachment,
  type AgentLoopResponse,
  type AgentLoopToolResult,
} from '@/lib/run-agent-loop';
import { visibleAgentStep } from '@/lib/agent-step-copy';
import {
  chatRunFinishedWhileAway,
  chatTurnChangesFromToolResults,
  ensureChatNotificationPermission,
  notifyChatRunFinished,
  numberedNextStepsFromTurn,
  resolveNumberedNextStep,
  summarizeChatSteps,
  type NumberedNextStep,
} from '@/lib/chat-turn-parity';
import { ChatTurnChangesPanel } from '@/components/flow/chat-turn-changes';
import { DATASET_VERSION_RESTORED_NOTE } from '@/lib/dataset-version-undo';
import { keepFirstSessionTitle, sortSessionsByRecency } from '@/components/flow/chat-sessions';
import {
  documentFromPins,
  parseReportReshapeRequest,
  reportDocumentForApi,
} from '@/lib/report-document';

export type AgentChatSession = { session_id: string; title?: string; updated_at?: string };

/** A finished run from another screen must not replace the chat that is already open. */
export function liveRunShouldReplaceChat(openSessionId: string, liveSessionId: string): boolean {
  if (!liveSessionId) return false;
  if (!openSessionId) return true;
  return openSessionId === liveSessionId;
}

function draftKey(projectId: string): string {
  return `tensr-chat-draft:${projectId}`;
}

type Mode = 'ask' | 'plan' | 'agent';

export type AgentThreadOptions = {
  projectId: string;
  datasetId?: string | null;
  columnNames: string[] | null;
  columnLabels: ColumnLabels[];
  syncAddress?: boolean;
  pendingAsk?: string | null;
  onAsked?: () => void;
  onSession?: (session: AgentChatSession) => void;
  onFinished?: (result: AgentLoopResponse) => void;
  /** Report pages/tables changed mid-deck — bump Report reload. */
  onReportUpdated?: () => void;
};

/** A list key. The same step name can run twice, so the index keeps the rows apart. */
export function stepRowKey(index: number, step: string): string {
  return `${index}:${step}`;
}

export function stepLines(steps: { name?: string; message?: string }[] | undefined): string[] {
  return (steps || []).flatMap(step => {
    const line = visibleAgentStep(step.name || '', step.message || '');
    return line ? [line] : [];
  });
}

function traceField(item: Record<string, unknown>, key: string): string {
  const value = item[key];
  return typeof value === 'string' ? value.trim() : '';
}

/** Step lines from a finished reply. Prefer the procedure the person saw over wrapper tool names. */
export function replyLines(result: AgentLoopResponse): string[] {
  const summary = result.execution_summary?.trim();
  if (summary) {
    return summary.split('\n').flatMap(line => {
      const visible = visibleAgentStep('', line.replace(/^[\s\-*•]+/, '').trim());
      return visible ? [visible] : [];
    });
  }
  return (result.tool_trace || []).flatMap(item => {
    const nested =
      item.result && typeof item.result === 'object'
        ? (item.result as Record<string, unknown>)
        : {};
    const args =
      item.args && typeof item.args === 'object' ? (item.args as Record<string, unknown>) : {};
    const message =
      traceField(item, 'message') ||
      traceField(item, 'summary') ||
      traceField(nested, 'message') ||
      '';
    const wrapper = traceField(item, 'name') || traceField(item, 'tool');
    const procedure = traceField(args, 'analysis_type');
    const name =
      (wrapper === 'run_analysis' || wrapper === 'run_operations') && procedure
        ? procedure
        : wrapper || procedure;
    const line = visibleAgentStep(name, message);
    return line ? [line] : [];
  });
}

/** Keep the lines shown while the turn ran; only fall back to the finished trace. */
export function stepsAfterReply(live: string[], traced: string[]): string[] {
  return live.length ? live : traced;
}

function nextStepsForResult(
  result: AgentLoopResponse,
  columnLabels: ColumnLabels[],
  hasReportPins = false
): NumberedNextStep[] {
  return numberedNextStepsFromTurn({
    toolResults: result.tool_results,
    steps: replyLines(result),
    hasOutput: outputCardReady(result, false),
    columnLabels: columnLabels.map(column => column.label || column.name).filter(Boolean),
    hasReportPins,
    hasReportDocument: reportPagesFromResult(result) > 0,
  });
}

function notifyFinishedTurn(result: AgentLoopResponse, startedAt: number): boolean {
  const body = (result.answer_markdown || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const away = chatRunFinishedWhileAway({ startedAt });
  notifyChatRunFinished({
    title: 'Tensr finished a chat reply',
    body: body || undefined,
    startedAt,
  });
  // In-thread banner whenever a long run finished in a hidden tab (Paper 9e),
  // even if the OS blocked the desktop notification.
  return away;
}

function downloadEntries(result: AgentLoopResponse): ExportDownload[] {
  const entries = (result.tool_results || []).flatMap(item => {
    const nested =
      item.result && typeof item.result === 'object'
        ? [item.result as Record<string, unknown>]
        : [];
    return [item as unknown as Record<string, unknown>, ...nested];
  });
  return downloadsFromToolResults(entries);
}

function clientDeckStillPending(result: AgentLoopResponse): boolean {
  return clientDeckNeedsLiveResolve(result.tool_results);
}

function reportPagesFromResult(result: AgentLoopResponse): number {
  for (const item of result.tool_results || []) {
    const pages = item.result?.report_pages;
    if (typeof pages === 'number' && pages > 0) return pages;
  }
  return 0;
}

export function useAgentThread({
  projectId,
  datasetId,
  columnNames,
  columnLabels,
  syncAddress = false,
  pendingAsk,
  onAsked,
  onSession,
  onFinished,
  onReportUpdated,
}: AgentThreadOptions) {
  const [question, setQuestion] = useState('');
  const [sent, setSent] = useState('');
  const [past, setPast] = useState<ChatExchange[]>([]);
  const [mode, setMode] = useState<Mode>('agent');
  const [answer, setAnswer] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  /** Composer lock for the whole send/approve flight (status alone clears on first token). */
  const [runBusy, setRunBusy] = useState(false);
  const [downloads, setDownloads] = useState<ExportDownload[]>([]);
  const [plan, setPlan] = useState<AgentLoopResponse | null>(null);
  const [approving, setApproving] = useState(false);
  const [turn, setTurn] = useState<AgentLoopResponse | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [nextSteps, setNextSteps] = useState<NumberedNextStep[]>([]);
  const [awayNote, setAwayNote] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [attachments, setAttachments] = useState<AgentLoopAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attachedNote, setAttachedNote] = useState('');
  const [sessions, setSessions] = useState<AgentChatSession[] | null>(null);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const attachmentsRef = useRef<AgentLoopAttachment[]>([]);
  attachmentsRef.current = attachments;
  const sessionRef = useRef<string | null>(null);
  const sentRef = useRef('');
  const questionRef = useRef('');
  const answerRef = useRef('');
  const stepsRef = useRef<string[]>([]);
  const nextStepsRef = useRef<NumberedNextStep[]>([]);
  const noteRef = useRef('');
  const toolResultsRef = useRef(turn?.tool_results);
  toolResultsRef.current = turn?.tool_results;
  sentRef.current = sent;
  questionRef.current = question;
  answerRef.current = answer;
  stepsRef.current = steps;
  nextStepsRef.current = nextSteps;
  noteRef.current = attachedNote;
  const askedRef = useRef<string | null>(null);
  const sendingRef = useRef(false);
  const approvingRef = useRef(false);
  const turnTokenRef = useRef(0);
  const streamedRef = useRef('');
  const aliveRef = useRef(true);
  const statusRef = useRef<string | null>(null);
  const modeRef = useRef<Mode>('agent');
  const openToken = useRef(0);
  const openAbort = useRef<AbortController | null>(null);
  const onSessionRef = useRef(onSession);
  const onFinishedRef = useRef(onFinished);
  const onReportUpdatedRef = useRef(onReportUpdated);
  const onAskedRef = useRef(onAsked);
  const deckWatchAbort = useRef<AbortController | null>(null);
  const openChatRef = useRef<(sessionId: string, opts?: { allowFallback?: boolean }) => void>(
    () => undefined
  );
  const reportPins = useProjectPins(projectId || '', datasetId ? [datasetId] : []);
  const reportPinsRef = useRef(reportPins);
  reportPinsRef.current = reportPins;
  const datasetIdRef = useRef(datasetId);
  datasetIdRef.current = datasetId;
  statusRef.current = status;
  modeRef.current = mode;
  onSessionRef.current = onSession;
  onFinishedRef.current = onFinished;
  onReportUpdatedRef.current = onReportUpdated;
  onAskedRef.current = onAsked;

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      openToken.current += 1;
      openAbort.current?.abort();
      deckWatchAbort.current?.abort();
    };
  }, []);

  const shown = useCallback((update: () => void) => {
    if (aliveRef.current) update();
  }, []);

  const showThread = Boolean(past.length || sent || answer || plan || status);

  const rememberChat = useCallback(
    (sessionId: string | null) => {
      if (!projectId || typeof window === 'undefined') return;
      const key = `tensr-open-chat:${projectId}`;
      if (sessionId) window.sessionStorage.setItem(key, sessionId);
      else window.sessionStorage.removeItem(key);
      setOpenSessionId(sessionId);
      if (!syncAddress) return;
      const url = new URL(window.location.href);
      if (!url.pathname.endsWith('/chat')) return;
      if (sessionId) url.searchParams.set('session', sessionId);
      else url.searchParams.delete('session');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
    },
    [projectId, syncAddress]
  );

  const queryClient = useQueryClient();
  const sessionsQuery = useProjectSessions(projectId || null);
  useEffect(() => {
    if (!sessionsQuery.data) {
      if (sessionsQuery.isError) setSessions(current => current || []);
      return;
    }
    setSessions(sortSessionsByRecency(sessionsQuery.data));
  }, [sessionsQuery.data, sessionsQuery.isError]);

  const noteSession = useCallback(
    (sessionId: string, title: string) => {
      sessionRef.current = sessionId;
      rememberChat(sessionId);
      const clipped = title.length > 80 ? `${title.slice(0, 77)}…` : title;
      if (!aliveRef.current) return;
      let row: AgentChatSession = {
        session_id: sessionId,
        title: clipped,
        updated_at: new Date().toISOString(),
      };
      setSessions(current => {
        const existing = (current || []).find(item => item.session_id === sessionId);
        row = {
          session_id: sessionId,
          title: keepFirstSessionTitle(existing?.title, clipped),
          updated_at: new Date().toISOString(),
        };
        const rest = (current || []).filter(item => item.session_id !== row.session_id);
        const next = sortSessionsByRecency([row, ...rest]);
        if (projectId) queryClient.setQueryData(projectQueryKeys.sessions(projectId), next);
        return next;
      });
      onSessionRef.current?.(row);
    },
    [rememberChat, projectId, queryClient]
  );

  const loadRail = useCallback(() => {
    if (!projectId) return;
    void invalidateProjectSessions(queryClient, projectId);
  }, [projectId, queryClient]);

  const startDeckWatch = useCallback(
    (result: AgentLoopResponse, watchToken: number) => {
      if (!clientDeckStillPending(result)) return;
      deckWatchAbort.current?.abort();
      const watch = new AbortController();
      deckWatchAbort.current = watch;
      void import('@/lib/client-deck-job').then(({ watchClientDeckJobInBackground }) =>
        watchClientDeckJobInBackground(result, {
          datasetId: datasetIdRef.current,
          signal: watch.signal,
          onProgress: (_step, message) => {
            // Keep polling until the job finishes even if a follow-up turn bumped
            // turnToken — otherwise status questions orphan the progress card.
            if (!aliveRef.current) return;
            shown(() => {
              setSteps(current => (current.includes(message) ? current : [...current, message]));
            });
          },
          onReportPages: () => {
            if (aliveRef.current) onReportUpdatedRef.current?.();
          },
          onUpdate: next => {
            if (!aliveRef.current) return;
            // Follow-up turns bump turnToken; still refresh while this deck job is live.
            if (watchToken !== turnTokenRef.current && !clientDeckStillPending(next)) {
              return;
            }
            const nextAnswer = readableTurnAnswer(
              next.status,
              keptModelAnswer('', next.answer_markdown || ''),
              next.tool_results
            );
            shown(() => {
              setAnswer(nextAnswer);
              setTurn(next);
              setDownloads(downloadEntries(next));
              if (watchToken === turnTokenRef.current) {
                setNextSteps(
                  nextStepsForResult(next, columnLabels, reportPinsRef.current.length > 0)
                );
              }
            });
            onFinishedRef.current?.(next);
          },
        })
      );
    },
    [columnLabels, shown]
  );

  const attachFiles = (list: FileList | null) => {
    void readChatAttachments(list).then(result => {
      setAttachError(result.rejected.length ? result.rejected.join(' ') : null);
      if (result.accepted.length) {
        setAttachments(current => [...current, ...result.accepted]);
      }
    });
  };

  const loadSavedTurn = useCallback(
    async (question: string, nextMode: Mode, alreadyAnswered: number) => {
      const sessionId = sessionRef.current;
      if (!projectId || !sessionId) return null;
      try {
        const page = await flowJson<StoredChatSession>(
          `/api/projects/${projectId}/sessions/${sessionId}`
        );
        const saved = savedChatTurn(page.turns, question, nextMode, alreadyAnswered, page);
        if (saved) saved.session_id = sessionId;
        return saved;
      } catch {
        return null;
      }
    },
    [projectId]
  );

  const sendText = useCallback(
    async (rawText: string, nextMode: Mode = modeRef.current) => {
      const resolved = resolveNumberedNextStep(rawText, nextStepsRef.current);
      const text = resolved || rawText;
      if (!text.trim() || sendingRef.current || approvingRef.current) return false;
      if (projectId && chatRunInFlight(projectId)) return false;
      if (statusRef.current === 'Thinking…') return false;
      // Lock before bumping the turn token so a second Enter cannot slip through.
      sendingRef.current = true;
      setRunBusy(true);
      const turnToken = ++turnTokenRef.current;
      ensureChatNotificationPermission();
      const startedAt = Date.now();
      const publish = (patch: Partial<NonNullable<ReturnType<typeof liveChatRun>>>) => {
        if (!projectId) return;
        const prior = liveChatRun();
        publishLiveChatRun({
          projectId,
          sessionId: prior?.projectId === projectId ? prior.sessionId : sessionRef.current,
          question: text,
          answer: prior?.projectId === projectId ? prior.answer : '',
          steps: prior?.projectId === projectId ? prior.steps : [],
          status: 'Thinking…',
          running: true,
          ...patch,
        });
      };
      publish({ answer: '', steps: [], status: 'Thinking…', running: true });
      const turnFiles = attachmentsRef.current;
      setPast(current =>
        archiveChatTurn(
          current,
          sentRef.current
            ? {
                user: sentRef.current,
                note: noteRef.current,
                answer: answerRef.current,
                toolResults: toolResultsRef.current,
              }
            : null
        )
      );
      setSent(text);
      setAttachedNote(
        turnFiles.length ? `Attached: ${turnFiles.map(item => item.filename).join(', ')}` : ''
      );
      setQuestion('');
      if (projectId) window.sessionStorage.removeItem(draftKey(projectId));
      setMode(nextMode);
      setPlan(null);
      setTurn(null);
      setSteps([]);
      setNextSteps([]);
      setAwayNote(false);
      setDownloads([]);
      setStatus('Thinking…');
      setApproving(false);
      setAnswer('');
      streamedRef.current = '';
      let draft = '';
      const alreadyAnswered =
        answeredTurnCount(past, text) +
        (sentRef.current.trim() === text.trim() &&
        (answerRef.current.trim() || (toolResultsRef.current || []).length)
          ? 1
          : 0);
      const recover = () => loadSavedTurn(text, nextMode, alreadyAnswered);
      const reshapeAsk = parseReportReshapeRequest(text);
      const reshapeFileId = datasetIdRef.current;
      const reshapePins = reportPinsRef.current;
      try {
        // Always intercept reshape asks — never fall through to the agent
        // (which would start a headline scan). The API prefers the stored report.
        if (reshapeAsk) {
          if (!reshapeFileId) {
            const needFile =
              'Open a survey file first, then ask for a board, short, or audience version of the report.';
            shown(() => {
              setAnswer(needFile);
              setApproving(false);
              setPlan(null);
              setTurn(null);
              setSteps([]);
              setNextSteps([]);
              setDownloads([]);
              setAttachments([]);
              setStatus(null);
            });
            publish({
              running: false,
              status: null,
              answer: needFile,
              steps: [],
              sessionId: sessionRef.current,
            });
            return true;
          }
          shown(() => setSteps(['Reshaping the report…']));
          publish({ steps: ['Reshaping the report…'], status: 'Thinking…' });
          try {
            const reshapeBody: Record<string, unknown> = {
              message: text,
              kind: reshapeAsk.kind,
              max_slides: reshapeAsk.maxSlides,
              audience_label: reshapeAsk.audienceLabel,
              include_recommendations: reshapeAsk.includeRecommendations,
              recommendation_count: reshapeAsk.recommendationCount,
              placement: reshapeAsk.placement,
              persist: true,
            };
            if (reshapePins.length) {
              reshapeBody.document = reportDocumentForApi(documentFromPins(reshapePins));
            }
            const reshaped = await flowJson<{
              ok?: boolean;
              note?: string;
              variant_section?: string;
              variant_page_ids?: string[];
              document?: { pages?: unknown[] };
            }>(`/datasets/${reshapeFileId}/report/reshape`, {
              method: 'POST',
              body: JSON.stringify(reshapeBody),
              signal: AbortSignal.timeout(60_000),
            });
            if (turnToken !== turnTokenRef.current) return true;
            const section = reshaped.variant_section || 'Board';
            const nVariant = (reshaped.variant_page_ids || []).length;
            const nPages = Array.isArray(reshaped.document?.pages)
              ? reshaped.document.pages.length
              : nVariant;
            const kept =
              reshaped.note ||
              `${section} version added at the front. Full report kept (${nPages} pages).`;
            const suggestions = numberedNextStepsFromTurn({
              hasReportPins: true,
              hasOutput: false,
            });
            shown(() => {
              setAnswer(kept);
              setApproving(false);
              setPlan(null);
              setTurn(null);
              setSteps(['Reshaped the report']);
              setNextSteps(suggestions);
              setDownloads([]);
              setAttachments([]);
              setStatus(null);
            });
            publish({
              running: false,
              status: null,
              answer: kept,
              steps: ['Reshaped the report'],
              sessionId: sessionRef.current,
            });
            if (aliveRef.current) loadRail();
            return true;
          } catch (reshapeErr) {
            if (turnToken !== turnTokenRef.current) return true;
            const detail =
              reshapeErr instanceof Error && reshapeErr.message.trim()
                ? reshapeErr.message.trim()
                : 'Add findings to the report before reshaping it.';
            shown(() => {
              setAnswer(detail);
              setApproving(false);
              setPlan(null);
              setTurn(null);
              setSteps([]);
              setNextSteps([]);
              setDownloads([]);
              setAttachments([]);
              setStatus(null);
            });
            publish({
              running: false,
              status: null,
              answer: detail,
              steps: [],
              sessionId: sessionRef.current,
            });
            return true;
          }
        }

        let previewResults: AgentLoopResponse['tool_results'] | undefined;
        const result = await runAgentLoop({
          message: text,
          mode: nextMode,
          datasetId: datasetId || null,
          projectId: projectId || null,
          attachments: turnFiles,
          agentVersion: 'v2',
          sessionId: sessionRef.current,
          // Wide banners often exceed two minutes; keep the stream open (TEN-242).
          signal: AbortSignal.timeout(300_000),
          recover,
          onProgress: progress => {
            if (progress.step === 'retry' && progress.message) {
              shown(() => setStatus(progress.message));
              publish({ status: progress.message, answer: draft });
              return;
            }
            const line = visibleAgentStep(progress.step, progress.message);
            if (!line) return;
            shown(() => {
              setStatus('Thinking…');
              setSteps(current => (current.includes(line) ? current : [...current, line]));
            });
            const prior = liveChatRun();
            publish({
              steps: prior?.steps.includes(line) ? prior.steps : [...(prior?.steps || []), line],
              status: 'Thinking…',
              answer: draft,
            });
          },
          onDelta: chunk => {
            if (turnToken !== turnTokenRef.current) return;
            draft += chunk;
            streamedRef.current = draft;
            if (isProcedurePlaceholder(draft)) return;
            shown(() => {
              setAnswer(draft);
              setStatus(null);
            });
            publish({ answer: draft, status: null });
          },
          onReplace: next => {
            if (turnToken !== turnTokenRef.current) return;
            draft = next;
            streamedRef.current = next;
            if (isProcedurePlaceholder(next)) return;
            shown(() => {
              setAnswer(next);
              setStatus(null);
            });
            publish({ answer: next, status: null });
          },
          onSession: sessionId => {
            noteSession(sessionId, text.trim());
            publish({ sessionId });
          },
          onPreview: preview => {
            if (turnToken !== turnTokenRef.current) return;
            const previewText = preview.text || draft;
            const tables = hasSummaryTable(preview.tool_results);
            if (preview.tool_results?.length) previewResults = preview.tool_results;
            if ((!previewText || isProcedurePlaceholder(previewText)) && !tables) return;
            if (previewText && !isProcedurePlaceholder(previewText)) {
              draft = previewText;
              streamedRef.current = previewText;
              shown(() => {
                setAnswer(previewText);
                setStatus(null);
              });
              publish({ answer: previewText, status: null });
            }
            if (tables) {
              shown(() => {
                setTurn({
                  status: 'ok',
                  mode,
                  answer_markdown: previewText,
                  tool_results: preview.tool_results,
                });
              });
            }
          },
        });
        if (turnToken !== turnTokenRef.current) return true;
        if (result.session_id) noteSession(result.session_id, text.trim());
        const traced = replyLines(result);
        const keptSteps = stepsAfterReply(stepsRef.current, traced);
        const entries = downloadEntries(result);
        const kept = readableTurnAnswer(
          result.status,
          keptModelAnswer(draft, result.answer_markdown || ''),
          result.tool_results?.length ? result.tool_results : previewResults
        );
        const suggestions =
          result.status === 'awaiting_approval'
            ? []
            : nextStepsForResult(result, columnLabels, reportPinsRef.current.length > 0);
        const shownTurn =
          result.status === 'awaiting_approval'
            ? null
            : result.tool_results?.length
              ? result
              : previewResults?.length
                ? {
                    ...result,
                    status: result.status === 'llm_unavailable' ? ('ok' as const) : result.status,
                    tool_results: previewResults,
                    answer_markdown: kept,
                  }
                : result;
        shown(() => {
          setAnswer(kept);
          setApproving(false);
          setPlan(result.status === 'awaiting_approval' ? result : null);
          setTurn(shownTurn);
          if (keptSteps.length) setSteps(keptSteps);
          setNextSteps(suggestions);
          setDownloads(entries);
          if (result.status !== 'awaiting_approval') setAttachments([]);
          setStatus(null);
        });
        if (result.status !== 'awaiting_approval' && aliveRef.current) {
          onFinishedRef.current?.(shownTurn || result);
          if (reportPagesFromResult(shownTurn || result) > 0) onReportUpdatedRef.current?.();
          if (notifyFinishedTurn(shownTurn || result, startedAt)) {
            shown(() => setAwayNote(true));
          }
          startDeckWatch(shownTurn || result, turnToken);
        }
        publish({
          running: false,
          status: null,
          answer: kept,
          steps: keptSteps,
          sessionId: result.session_id || sessionRef.current,
        });
        if (aliveRef.current) loadRail();
        return true;
      } catch (err) {
        const message = formatApiErrorMessage(err);
        // TEN-242: when a table already landed in preview, keep it and salvage a lead.
        const preview = toolResultsRef.current;
        const salvaged = preview?.length
          ? readableTurnAnswer('ok', draft || streamedRef.current || '', preview)
          : '';
        if (salvaged && !/model call failed|this turn stopped|did not finish/i.test(salvaged)) {
          shown(() => {
            setAnswer(salvaged);
            setStatus(null);
            setPlan(null);
            if (preview?.length) {
              setTurn({
                status: 'ok',
                mode: nextMode,
                answer_markdown: salvaged,
                tool_results: preview,
              });
            }
          });
          publish({ running: false, status: null, answer: salvaged });
          return true;
        }
        shown(() => {
          setStatus(message);
          setPlan(null);
          if (!preview?.length) setTurn(null);
        });
        publish({ running: false, status: message });
        return true;
      } finally {
        sendingRef.current = false;
        setRunBusy(false);
      }
    },
    [
      columnLabels,
      datasetId,
      loadRail,
      loadSavedTurn,
      past,
      projectId,
      noteSession,
      shown,
      startDeckWatch,
    ]
  );

  useEffect(() => {
    if (!pendingAsk || askedRef.current === pendingAsk) return;
    const text = pendingAsk;
    let cancelled = false;
    const trySend = () => {
      if (cancelled || askedRef.current === text) return;
      if (projectId && chatRunInFlight(projectId)) return;
      void sendText(text, 'agent').then(started => {
        if (!started || cancelled) return;
        askedRef.current = text;
        onAskedRef.current?.();
      });
    };
    const handle = window.setTimeout(trySend, 0);
    const unsubscribe = subscribeLiveChatRun(trySend);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
      unsubscribe();
    };
  }, [pendingAsk, projectId, sendText]);

  const send = (text?: string) => void sendText(text ?? question);

  const approve = () => {
    if (!plan || !sent || approvingRef.current || sendingRef.current) return;
    const batch =
      plan.pending_approvals && !Array.isArray(plan.pending_approvals)
        ? plan.pending_approvals
        : null;
    const calls = Array.isArray(plan.pending_approvals) ? plan.pending_approvals : null;
    const approvedSession = plan.session_id || sessionRef.current;
    approvingRef.current = true;
    setApproving(true);
    setRunBusy(true);
    const turnToken = ++turnTokenRef.current;
    const startedAt = Date.now();
    setStatus('Thinking…');
    setAnswer('');
    setNextSteps([]);
    setAwayNote(false);
    streamedRef.current = '';
    if (projectId) {
      publishLiveChatRun({
        projectId,
        sessionId: approvedSession,
        question: sent,
        answer: '',
        steps: stepsRef.current,
        status: 'Thinking…',
        running: true,
      });
    }
    const writeStream = (next: string) => {
      if (turnToken !== turnTokenRef.current) return;
      streamedRef.current = next;
      if (isProcedurePlaceholder(next)) return;
      shown(() => {
        setAnswer(next);
        setStatus(null);
      });
    };
    void runAgentLoop({
      message: sent,
      mode,
      datasetId: datasetId || null,
      projectId: projectId || null,
      attachments: attachmentsRef.current,
      agentVersion: 'v2',
      sessionId: plan.session_id || sessionRef.current,
      approvedToolCalls: calls,
      approvedBatch:
        batch && typeof batch.mac === 'string' ? { batch: batch.batch, mac: batch.mac } : null,
      signal: AbortSignal.timeout(300_000),
      onProgress: progress => {
        if (turnToken !== turnTokenRef.current) return;
        if (progress.step === 'retry' && progress.message) {
          shown(() => setStatus(progress.message));
          if (projectId) {
            const current = liveChatRun();
            if (livePublishMatches(current, projectId, approvedSession, sent)) {
              publishLiveChatRun({ ...current!, status: progress.message, running: true });
            }
          }
          return;
        }
        const line = visibleAgentStep(progress.step, progress.message);
        if (!line) return;
        shown(() => {
          setStatus('Thinking…');
          setSteps(current => (current.includes(line) ? current : [...current, line]));
        });
      },
      onSession: sessionId => {
        noteSession(sessionId, sent.trim());
      },
      onDelta: chunk => writeStream(streamedRef.current + chunk),
      onReplace: next => writeStream(next),
      onPreview: preview => {
        if (turnToken !== turnTokenRef.current) return;
        const previewText = preview.text || streamedRef.current;
        if (previewText && !isProcedurePlaceholder(previewText)) writeStream(previewText);
        if (hasSummaryTable(preview.tool_results)) {
          shown(() => {
            setTurn({
              status: 'ok',
              mode,
              answer_markdown: previewText,
              tool_results: preview.tool_results,
            });
          });
        }
      },
    })
      .then(result => {
        if (turnToken !== turnTokenRef.current) return;
        if (result.session_id) noteSession(result.session_id, sent.trim());
        const traced = replyLines(result);
        const keptSteps = stepsAfterReply(stepsRef.current, traced);
        const entries = downloadEntries(result);
        const kept = readableTurnAnswer(
          result.status,
          keptModelAnswer(streamedRef.current, result.answer_markdown || ''),
          result.tool_results
        );
        const suggestions =
          result.status === 'awaiting_approval'
            ? []
            : nextStepsForResult(result, columnLabels, reportPinsRef.current.length > 0);
        shown(() => {
          setAnswer(kept);
          setApproving(false);
          setPlan(result.status === 'awaiting_approval' ? result : null);
          setTurn(result.status === 'awaiting_approval' ? null : result);
          if (keptSteps.length) setSteps(keptSteps);
          setNextSteps(suggestions);
          setDownloads(entries);
          if (result.status !== 'awaiting_approval') setAttachments([]);
          setStatus(null);
        });
        if (result.status !== 'awaiting_approval' && aliveRef.current) {
          onFinishedRef.current?.(result);
          if (reportPagesFromResult(result) > 0) onReportUpdatedRef.current?.();
          if (notifyFinishedTurn(result, startedAt)) {
            shown(() => setAwayNote(true));
          }
          startDeckWatch(result, turnToken);
        }
        const current = liveChatRun();
        if (projectId && livePublishMatches(current, projectId, approvedSession, sent)) {
          publishLiveChatRun({
            ...current!,
            running: false,
            status: null,
            answer: kept,
            steps: keptSteps,
            sessionId: result.session_id || approvedSession,
          });
        }
        approvingRef.current = false;
        setRunBusy(false);
      })
      .catch(err => {
        if (turnToken !== turnTokenRef.current) return;
        const message = formatApiErrorMessage(err);
        shown(() => {
          setApproving(false);
          setStatus(message);
        });
        const current = liveChatRun();
        if (projectId && livePublishMatches(current, projectId, approvedSession, sent)) {
          publishLiveChatRun({ ...current!, running: false, status: message });
        }
        approvingRef.current = false;
        setRunBusy(false);
      });
  };

  const clearChat = () => {
    turnTokenRef.current += 1;
    approvingRef.current = false;
    sendingRef.current = false;
    sessionRef.current = null;
    publishLiveChatRun(null);
    rememberChat(null);
    setPast([]);
    setSent('');
    setAttachedNote('');
    setAnswer('');
    setNextSteps([]);
    setAwayNote(false);
    setQuestion('');
    if (projectId) window.sessionStorage.removeItem(draftKey(projectId));
    setPlan(null);
    setApproving(false);
    setRunBusy(false);
    setTurn(null);
    setSteps([]);
    setDownloads([]);
    setAttachments([]);
    setAttachError(null);
    setStatus(null);
    setPanelOpen(false);
  };

  const resetToEmptyChat = useCallback(() => {
    sessionRef.current = null;
    rememberChat(null);
    setPast([]);
    setSent('');
    setAttachedNote('');
    setAnswer('');
    setPlan(null);
    setTurn(null);
    setSteps([]);
    setNextSteps([]);
    setDownloads([]);
    setAttachments([]);
    setAttachError(null);
    setPanelOpen(false);
    setStatus(null);
  }, [rememberChat]);

  const openChat = useCallback(
    (sessionId: string, opts?: { allowFallback?: boolean }) => {
      if (!projectId || !sessionId) return;
      const allowFallback = opts?.allowFallback !== false;
      const token = ++openToken.current;
      openAbort.current?.abort();
      const controller = new AbortController();
      openAbort.current = controller;
      sessionRef.current = sessionId;
      rememberChat(sessionId);
      void flowJson<
        {
          turns?: {
            user?: string;
            answer?: string;
            tool_results?: AgentLoopResponse['tool_results'];
            steps?: { name?: string; message?: string }[];
          }[];
        } & StoredChatSession
      >(`/api/projects/${projectId}/sessions/${sessionId}`, {
        signal: controller.signal,
      })
        .then(page => {
          if (token !== openToken.current) return;
          const exchanges = (page.turns || []).flatMap(item =>
            item.user
              ? [
                  {
                    user: item.user,
                    note: '',
                    answer: restoredChatAnswer(item),
                    toolResults: item.tool_results,
                    steps: item.steps,
                  },
                ]
              : []
          );
          const last = exchanges[exchanges.length - 1];
          const pending =
            page.status === 'awaiting_approval' && page.pending_approvals
              ? page.pending_approvals
              : null;
          const restoredAnswer = pending
            ? String(page.answer_markdown || last?.answer || '').trim()
            : last?.answer || '';
          const restoredTurn: AgentLoopResponse | null = last
            ? {
                status: pending ? 'awaiting_approval' : 'ok',
                mode: 'agent',
                answer_markdown: restoredAnswer,
                session_id: sessionId,
                tool_results: last.toolResults,
                pending_approvals: pending || undefined,
              }
            : pending
              ? {
                  status: 'awaiting_approval',
                  mode: 'agent',
                  answer_markdown: restoredAnswer,
                  session_id: sessionId,
                  pending_approvals: pending,
                }
              : null;
          shown(() => {
            setPast(last ? exchanges.slice(0, -1) : exchanges);
            setSent(last?.user || '');
            setAttachedNote('');
            setAnswer(pending ? '' : restoredAnswer);
            if (!questionRef.current && projectId) {
              setQuestion(window.sessionStorage.getItem(draftKey(projectId)) || '');
            }
            setPlan(pending ? restoredTurn : null);
            setTurn(pending ? null : restoredTurn);
            setSteps(stepLines(last?.steps));
            setAwayNote(false);
            setNextSteps(
              restoredTurn && !pending
                ? nextStepsForResult(restoredTurn, columnLabels, reportPinsRef.current.length > 0)
                : []
            );
            // Hydrate from exports.key even when the saved turn omitted downloads[].
            setDownloads(restoredTurn && !pending ? downloadEntries(restoredTurn) : []);
            setAttachments([]);
            setAttachError(null);
            setStatus(null);
            setRunBusy(false);
            // Failed tool steps still leave tool_results; only a ready output opens the column.
            // Decks stay on the chat card — Open goes to Report, not the empty inspector.
            const restoredDeck = isClientDeckResult(restoredTurn?.tool_results);
            setPanelOpen(outputCardReady(restoredTurn, Boolean(pending)) && !restoredDeck);
          });
          // Reopen: resolve a finished job immediately, then keep watching if still live.
          // Saved turns often stay on mid-build status after the job completed in the background.
          if (restoredTurn && !pending && clientDeckStillPending(restoredTurn)) {
            const watchToken = ++turnTokenRef.current;
            void import('@/lib/client-deck-job').then(
              async ({ resolvePendingClientDeckInResponse }) => {
                if (token !== openToken.current || controller.signal.aborted) return;
                const resolved = await resolvePendingClientDeckInResponse(restoredTurn, {
                  datasetId: datasetIdRef.current,
                  signal: controller.signal,
                });
                if (token !== openToken.current || controller.signal.aborted) return;
                const nextAnswer = readableTurnAnswer(
                  resolved.status,
                  keptModelAnswer('', resolved.answer_markdown || ''),
                  resolved.tool_results
                );
                shown(() => {
                  setAnswer(nextAnswer);
                  setTurn(resolved);
                  setDownloads(downloadEntries(resolved));
                  setNextSteps(
                    nextStepsForResult(resolved, columnLabels, reportPinsRef.current.length > 0)
                  );
                  setPanelOpen(
                    outputCardReady(resolved, false) && !isClientDeckResult(resolved.tool_results)
                  );
                });
                onFinishedRef.current?.(resolved);
                if (clientDeckStillPending(resolved)) {
                  startDeckWatch(resolved, watchToken);
                }
              }
            );
          }
        })
        .catch(err => {
          if (token !== openToken.current) return;
          if (err instanceof DOMException && err.name === 'AbortError') return;
          // Prefer empty chat or one other session over "That chat could not be opened."
          const fallback = allowFallback
            ? (sessions || []).find(item => item.session_id !== sessionId)
            : null;
          if (fallback?.session_id) {
            // One fallback attempt only — avoid A↔B loops when both sessions 404.
            openChatRef.current(fallback.session_id, { allowFallback: false });
            return;
          }
          shown(() => resetToEmptyChat());
        });
    },
    [columnLabels, projectId, rememberChat, resetToEmptyChat, sessions, shown, startDeckWatch]
  );
  openChatRef.current = openChat;

  useEffect(() => {
    const apply = () => {
      const run = liveChatRun();
      if (!run || run.projectId !== projectId) return;
      // This screen is sending or approving. Its own state is the thread.
      // Reloading the saved session here clears the plan before the column is saved.
      if (sendingRef.current || approvingRef.current) return;
      const stored = projectId
        ? window.sessionStorage.getItem(`tensr-open-chat:${projectId}`) || ''
        : '';
      const draft = projectId ? window.sessionStorage.getItem(draftKey(projectId)) || '' : '';
      const openId = sessionRef.current || stored;
      if (draft && openId !== (run.sessionId || '')) return;
      if (!liveRunShouldReplaceChat(openId, run.sessionId || '')) return;
      setSent(run.question);
      setAnswer(run.answer);
      setSteps(run.steps);
      setStatus(run.status);
      if (run.sessionId) {
        sessionRef.current = run.sessionId;
        rememberChat(run.sessionId);
      }
      // This screen did not send the run. Load the finished thread, including its card.
      if (!run.running && run.sessionId && !sendingRef.current) openChatRef.current(run.sessionId);
    };
    apply();
    return subscribeLiveChatRun(apply);
  }, [projectId, rememberChat]);

  useEffect(() => {
    if (!projectId || chatRunInFlight(projectId)) return;
    const fromUrl = syncAddress ? new URLSearchParams(window.location.search).get('session') : null;
    const stored = window.sessionStorage.getItem(`tensr-open-chat:${projectId}`);
    const sessionId = fromUrl || stored;
    const draft = window.sessionStorage.getItem(draftKey(projectId)) || '';
    if (draft) setQuestion(draft);
    if (sessionId) openChat(sessionId);
    // Read the open chat once for this project. A later keystroke must not reload it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, syncAddress]);

  const draftReady = useRef(false);
  useEffect(() => {
    if (!projectId) return;
    if (!draftReady.current) {
      draftReady.current = true;
      return;
    }
    const key = draftKey(projectId);
    if (question) window.sessionStorage.setItem(key, question);
    else window.sessionStorage.removeItem(key);
  }, [projectId, question]);

  const toolResults = useEnrichedToolResults(turn?.tool_results);
  // TEN-192: when a pending banner finishes on poll, replace deferred / empty chat prose with the lead.
  useEffect(() => {
    if (!toolResults?.length || runBusy) return;
    const next = readableTurnAnswer(turn?.status || 'ok', answer, toolResults);
    if (!next || next === answer) return;
    const blank = !String(answer || '').trim();
    const failedModel = /model call failed|this turn stopped/i.test(answer || '');
    if (
      !blank &&
      !failedModel &&
      !isDeferredResultProse(answer) &&
      answer !== EMPTY_TURN_ANSWER &&
      answer !== CONTINUING_TURN_ANSWER &&
      answer !== UNFINISHED_TURN_ANSWER &&
      !/\{\{|\}\}/.test(answer)
    ) {
      return;
    }
    if (
      isDeferredResultProse(next) ||
      next === EMPTY_TURN_ANSWER ||
      next === CONTINUING_TURN_ANSWER ||
      /model call failed|this turn stopped/i.test(next)
    ) {
      return;
    }
    setAnswer(next);
  }, [toolResults, answer, turn?.status, runBusy]);
  const kind = outputKind(toolResults);
  const clientDeck = isClientDeckResult(toolResults);
  const clientDeckSummary = clientDeck ? clientDeckFinishedSummary(toolResults) : null;
  const title = clientDeck ? 'Client deck' : outputTitle(toolResults, answer, columnLabels);
  const takeaway = outputTakeaway(answer);
  const baseNote = outputBaseClause(toolResults, answer);
  const stat = outputStat(toolResults, answer, takeaway);
  const runIds = outputRunIds(toolResults);
  const outputReady = outputCardReady(turn, Boolean(plan));
  useEffect(() => {
    // Open on the first real output; close again if the latest turn has none (e.g. a failed run).
    // Client decks open in Report (Paper 2c Open → slides), not the empty Outputs inspector.
    setPanelOpen(outputReady && !clientDeck);
  }, [outputReady, clientDeck]);
  const checks = outputChecks(toolResults);
  const tables = answerTables(answer);
  const tableMode = kind === 'Crosstab' && Boolean(tables);
  const ledger = (turn?.turn_state?.ledger || {}) as { weight?: string | null };
  const resultView = resultViewFromToolResults(toolResults);
  const resultTables = resultView.tables.length ? resultView.tables : answerResultTables(answer);
  const structuredTables = resultTables.map(table => ({
    ...table,
    title: titledWithQuestion(table.title, columnLabels),
  }));
  const resultCharts = resultView.charts;
  const proseRaw = withoutStrayEnding(
    answerWithoutBase(
      withoutResultTokens(
        structuredTables.length || resultCharts.length ? answerWithoutTables(answer) : answer
      )
    )
  );
  // Never leave a pending/deferred / "did not finish" stub as the chat body (TEN-242).
  const prose =
    proseRaw === EMPTY_TURN_ANSWER ||
    proseRaw === CONTINUING_TURN_ANSWER ||
    proseRaw === UNFINISHED_TURN_ANSWER ||
    isDeferredResultProse(proseRaw)
      ? ''
      : proseRaw;
  const lead = resultLead(answer, toolResults, resultTables);
  const footnote = resultFootnote(
    { ...resultView, weight: resultView.weight || String(ledger.weight || '') },
    baseNote,
    kind,
    columnLabels
  );
  const resultChecks = resultView.checks.length
    ? resultView.checks
    : checks.map(check => check.label);

  return {
    question,
    setQuestion,
    sent,
    past,
    mode,
    setMode,
    answer,
    status,
    setStatus,
    runBusy,
    downloads,
    plan,
    approving,
    setPlan,
    turn,
    steps,
    nextSteps,
    awayNote,
    setAwayNote,
    panelOpen,
    setPanelOpen,
    attachments,
    setAttachments,
    attachError,
    attachedNote,
    sessions,
    openSessionId,
    columnNames,
    columnLabels,
    showThread,
    attachFiles,
    sendText,
    send,
    approve,
    clearChat,
    openChat,
    loadRail,
    rememberChat,
    toolResults,
    kind,
    clientDeck,
    clientDeckSummary,
    title,
    takeaway,
    baseNote,
    stat,
    runIds,
    outputReady,
    checks,
    tables,
    prose,
    lead,
    tableMode,
    ledger,
    resultView,
    structuredTables,
    resultCharts,
    footnote,
    resultChecks,
    datasetId,
    projectId,
  };
}

export type AgentThreadState = ReturnType<typeof useAgentThread>;

function planCopy(answer: string): string {
  let text = answer.trim();
  const waiting = 'Waiting for approval:';
  if (text.startsWith(waiting)) text = text.slice(waiting.length).trim();
  if (text === 'Plan' || text.startsWith('Plan\n')) text = text.slice(4).trim();
  return guardUserText(text);
}

export function AgentThreadColumn({
  thread,
  placeholder,
  projectHref,
  panel = false,
  emptyTitle = 'Ask about the open file',
  emptyDescription = 'Questions here stay in the same chat as Chat and Tables.',
  emptySuggestions = [],
}: {
  thread: AgentThreadState;
  placeholder: string;
  projectHref: string;
  panel?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptySuggestions?: string[];
}) {
  const router = useRouter();
  const [stepsOpen, setStepsOpen] = useState(true);
  const [askedOwner, setAskedOwner] = useState(false);
  const meQuery = useMe(Boolean(thread.projectId));
  const membersQuery = useProjectMembers(thread.projectId || null);
  const userId = meQuery.data?.user_id || meQuery.data?.user?.id || '';
  const asker =
    (membersQuery.data || []).find(member => member.user_id === userId)?.role === 'asker';
  const audiencesQuery = useDatasetAudiences(asker ? thread.datasetId || null : null);
  const audiences = (audiencesQuery.data?.audiences || [])
    .map(item => ({
      name: String(item.name || '').trim(),
      label: String(item.label || item.name || '').trim(),
      description: String(item.description || '').trim(),
    }))
    .filter(item => item.label);
  const notInData =
    asker &&
    Boolean(thread.answer) &&
    (!thread.plan || thread.approving) &&
    answerIsNotInData(thread.answer);
  const reportPins = useProjectPins(
    thread.projectId || '',
    thread.datasetId ? [thread.datasetId] : []
  );
  const inReport = Boolean(
    thread.runIds[0] && reportPins.some(pin => pin.runId === thread.runIds[0])
  );
  const saveTable = () => {
    if (!thread.datasetId) return;
    void import('@/components/flow/survey-screens').then(({ tableBodyFromAgentRun }) => {
      const request = tableBodyFromAgentRun(thread.turn?.tool_results);
      if (!request || !thread.datasetId) {
        thread.setStatus('This result is not a table that can be saved.');
        return;
      }
      void flowJson(`/datasets/${thread.datasetId}/tables`, {
        method: 'POST',
        body: JSON.stringify(request),
      })
        .then(() => thread.setStatus('Saved to Tables.'))
        .catch(() => thread.setStatus('That table could not be saved.'));
    });
  };
  const liveChanges = chatTurnChangesFromToolResults(thread.toolResults);
  const showLiveChanges = liveChanges.length > 0 && Boolean(thread.projectId) && !thread.plan;

  const askerRail = asker ? (
    <aside className="asker-rail" aria-label="Asker rail">
      <div className="asker-rail-block">
        <p className="asker-rail-label">Audiences you can ask about</p>
        {audiences.length ? (
          audiences.map(audience => (
            <div key={audience.name || audience.label} className="asker-audience-card">
              <strong>{audience.label}</strong>
              {audience.description ? (
                <span className="flow-muted">{audience.description}</span>
              ) : null}
            </div>
          ))
        ) : (
          <p className="flow-muted">The audiences shared with this project.</p>
        )}
      </div>
      <div className="asker-rail-block">
        <p className="asker-rail-label">Your questions</p>
        {thread.past.length ? (
          thread.past.map(item => (
            <p key={item.user} className="asker-question-link">
              {item.user}
            </p>
          ))
        ) : (
          <p className="flow-muted">Questions you ask stay here.</p>
        )}
      </div>
      <div className="asker-rail-note">
        <p>What you can do here</p>
        <p className="flow-muted">
          Ask questions and copy answers. You can&apos;t change data, weights, audiences or the
          report.
        </p>
      </div>
    </aside>
  ) : null;

  const mainBody = (
    <>
      <div className="chat-scroll">
        {!thread.showThread && panel ? (
          emptySuggestions.length ? (
            <div className="tables-agent-empty" data-testid="tables-agent-empty">
              <p className="tables-agent-empty-title">{emptyTitle}</p>
              <p className="tables-agent-empty-copy">{emptyDescription}</p>
              <div className="tables-agent-empty-suggestions">
                {emptySuggestions.map(prompt => (
                  <Button
                    key={prompt}
                    className="tables-agent-empty-chip"
                    type="button"
                    onClick={() => thread.send(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <Empty className="min-h-[280px] border-0 bg-transparent">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MessageSquare />
                </EmptyMedia>
                <EmptyTitle className="text-sm">{emptyTitle}</EmptyTitle>
                <EmptyDescription>{emptyDescription}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )
        ) : null}
        {thread.past.map((item, index) => {
          // Keep slim/history lineage fields (derived/parent ids, procedure, weight label).
          const pastChanges = chatTurnChangesFromToolResults(
            item.toolResults as AgentLoopToolResult[] | undefined
          );
          return (
            <div key={`${index}-${item.user.slice(0, 24)}`}>
              <div className="chat-bubble">
                {item.user}
                {item.note ? <div className="flow-muted">{item.note}</div> : null}
              </div>
              <ThreadResult
                results={item.toolResults}
                answer={item.answer}
                columns={thread.columnLabels}
              />
              {pastChanges.length && thread.projectId ? (
                <ChatTurnChangesPanel
                  projectId={thread.projectId}
                  changes={pastChanges}
                  responsesHref={`${projectHref}/responses`}
                  disabled={thread.runBusy || thread.status === 'Thinking…'}
                  onRestored={() => thread.setStatus(DATASET_VERSION_RESTORED_NOTE)}
                />
              ) : null}
            </div>
          );
        })}
        {thread.sent ? (
          <div className="chat-bubble">
            {thread.sent}
            {thread.attachedNote ? <div className="flow-muted">{thread.attachedNote}</div> : null}
          </div>
        ) : null}
        {thread.steps.length > 0 ? (
          <div className="chat-steps">
            <Button
              className="chat-steps-head"
              type="button"
              aria-expanded={stepsOpen}
              onClick={() => setStepsOpen(current => !current)}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path
                  d="M2.5 6.5l2.2 2.2L9.5 3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {summarizeChatSteps(thread.steps)}
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <path
                  d={stepsOpen ? 'M3 4l2 2 2-2' : 'M4 3l2 2-2 2'}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Button>
            {stepsOpen ? (
              <div className="chat-steps-list">
                {thread.steps.map((step, index) => (
                  <div key={stepRowKey(index, step)}>{step}</div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {thread.plan ? (
          <div className="chat-plan">
            <strong>{thread.approving ? 'Approved · Plan' : 'Waiting for approval · Plan'}</strong>
            <FlowMarkdown>{planCopy(thread.plan.answer_markdown || '')}</FlowMarkdown>
            {thread.approving ? null : (
              <div className="flow-row">
                <Button className="flow-btn primary" type="button" onClick={thread.approve}>
                  Approve
                </Button>
                <Button className="flow-btn" type="button" onClick={() => thread.setPlan(null)}>
                  Edit plan
                </Button>
              </div>
            )}
          </div>
        ) : null}
        {(() => {
          const pendingScan = isAnalysisPending(thread.toolResults);
          const failure = analysisFailureMessage(thread.toolResults);
          // Paper 14b: Building card only while the scan is still open. Once the
          // standout card or a finished lead is on screen, drop the progress block.
          const answerLanded = Boolean(
            thread.resultView.standout ||
            (thread.lead && /x the average|× the average/i.test(thread.lead))
          );
          if (pendingScan && !answerLanded && !thread.plan) {
            const lines = thread.steps.length
              ? thread.steps
              : ['Building standout stats', 'Scanning questions across the file'];
            return <BuildingTableCard lines={lines} isStreaming={thread.runBusy || pendingScan} />;
          }
          if (failure && !thread.resultView.standout && !thread.plan) {
            return (
              <div
                className="chat-analysis-failed"
                data-testid="analysis-failure-card"
                role="alert"
              >
                <p>{failure}</p>
                <Button
                  className="flow-btn primary"
                  type="button"
                  disabled={!thread.sent || thread.runBusy}
                  onClick={() => thread.send(thread.sent)}
                >
                  Retry
                </Button>
              </div>
            );
          }
          return null;
        })()}
        {(thread.answer ||
          thread.structuredTables.length ||
          thread.resultCharts.length ||
          thread.resultView.duplication ||
          thread.resultView.standout ||
          thread.lead) &&
        (!thread.plan || thread.approving) ? (
          notInData ? (
            <div className="asker-not-in-data" role="status">
              <p>
                <strong>Not in this data.</strong> {stripNotInDataLead(thread.answer)}
              </p>
            </div>
          ) : thread.structuredTables.length ||
            thread.resultCharts.length ||
            thread.resultView.duplication ||
            thread.resultView.standout ? (
            <AnalysisResult
              lead={thread.lead || thread.takeaway}
              tables={thread.structuredTables}
              charts={thread.resultCharts}
              footnote={thread.footnote}
              checks={thread.resultChecks}
              script={thread.resultView.script}
              rCheck={thread.resultView.rCheck}
              rStatement={thread.resultView.rStatement}
              runId={thread.runIds[0]}
              datasetId={thread.datasetId || undefined}
              projectId={thread.projectId || undefined}
              duplication={thread.resultView.duplication}
              standout={thread.resultView.standout}
              audience={thread.resultView.audience}
            />
          ) : thread.prose || thread.lead ? (
            thread.prose ? (
              <FlowMarkdown className="chat-prose">{thread.prose}</FlowMarkdown>
            ) : (
              <AnalysisResult
                lead={thread.lead}
                tables={[]}
                footnote={thread.footnote}
                checks={thread.resultChecks}
                runId={thread.runIds[0]}
                datasetId={thread.datasetId || undefined}
                projectId={thread.projectId || undefined}
                audience={thread.resultView.audience}
              />
            )
          ) : null
        ) : null}
        {asker && thread.answer && !notInData && (!thread.plan || thread.approving) ? (
          <div className="asker-chips" aria-label="How this answer was worked out">
            {(
              [
                [
                  'Audience',
                  thread.resultView.audienceDefinition ||
                    thread.resultView.audience ||
                    thread.resultView.filter,
                ],
                ['Base', thread.resultView.base || thread.resultView.baseDetail],
                ['Weight', thread.resultView.weight],
                ['Wave', thread.resultView.wave],
                ['Source', thread.resultView.source],
                ['Test', thread.resultView.test],
              ] as const
            )
              .filter(([, value]) => Boolean(value))
              .map(([label, value]) => (
                <span key={label} className="asker-chip">
                  <span className="flow-muted">{label}</span> {value}
                </span>
              ))}
          </div>
        ) : null}
        {asker && thread.answer && (!thread.plan || thread.approving) && !thread.outputReady ? (
          <div className="chat-result-actions asker-answer-actions">
            <span className="output-badge">Asker · ask questions only</span>
            <Button
              className="flow-btn"
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(thread.answer);
              }}
            >
              Copy answer
            </Button>
            {notInData ? null : (
              <Button
                className="flow-btn"
                type="button"
                disabled={askedOwner || !thread.projectId}
                onClick={() => {
                  if (!thread.projectId) return;
                  void flowJson(`/api/projects/${thread.projectId}/asker-log/request-check`, {
                    method: 'POST',
                    body: '{}',
                  })
                    .then(() => {
                      setAskedOwner(true);
                      thread.setStatus('Sent to the owner to check.');
                    })
                    .catch(() => thread.setStatus('Could not ask the owner to check that answer.'));
                }}
              >
                Ask owner to check
              </Button>
            )}
            {askedOwner ? <span className="flow-muted">Not checked yet</span> : null}
          </div>
        ) : null}
        {showLiveChanges ? (
          <ChatTurnChangesPanel
            projectId={thread.projectId}
            changes={liveChanges}
            responsesHref={`${projectHref}/responses`}
            disabled={thread.runBusy || thread.status === 'Thinking…'}
            onRestored={() => thread.setStatus(DATASET_VERSION_RESTORED_NOTE)}
          />
        ) : null}
        {thread.outputReady ? (
          <div className="chat-result">
            {thread.clientDeck ? (
              <Link
                className="chat-result-top"
                href={clientDeckReportHref(projectHref)}
                aria-label={`Open in Report: ${thread.title}`}
              >
                <span className="chat-result-icon" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 14 14">
                    <path
                      d="M3 11V7M6 11V4M9 11V6M12 11V3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <div>
                  <strong>{thread.title}</strong>
                  <div className="flow-muted">
                    {thread.clientDeckSummary?.slideCount
                      ? `Done · ${thread.clientDeckSummary.slideCount} slides`
                      : `${thread.kind} · Output`}
                  </div>
                </div>
              </Link>
            ) : (
              <Button
                type="button"
                className="chat-result-top"
                aria-pressed={thread.panelOpen}
                aria-label={
                  thread.panelOpen ? `${thread.title}, output open` : `Show output: ${thread.title}`
                }
                onClick={() => thread.setPanelOpen(true)}
              >
                <span className="chat-result-icon" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 14 14">
                    <path
                      d="M3 11V7M6 11V4M9 11V6M12 11V3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <div>
                  <strong>{thread.title}</strong>
                  <div className="flow-muted">{thread.kind} · Output</div>
                </div>
                {thread.panelOpen ? <span className="chat-viewing">Viewing</span> : null}
              </Button>
            )}
            {thread.clientDeck && thread.clientDeckSummary?.preview?.length ? (
              <ul className="chat-deck-preview" aria-label="Executive summary preview">
                {thread.clientDeckSummary.preview.map(bullet => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            ) : null}
            <div className="chat-result-actions">
              {asker ? (
                <>
                  <span className="output-badge">Asker · ask questions only</span>
                  <Button
                    className="flow-btn"
                    type="button"
                    onClick={() => {
                      const text = [thread.lead || thread.answer, thread.footnote]
                        .filter(Boolean)
                        .join('\n');
                      void navigator.clipboard?.writeText(text);
                    }}
                  >
                    Copy answer
                  </Button>
                  <Button
                    className="flow-btn"
                    type="button"
                    onClick={() => {
                      const text = thread.structuredTables
                        .map(table =>
                          [table.columns.join('\t'), ...table.rows.map(row => row.join('\t'))].join(
                            '\n'
                          )
                        )
                        .join('\n\n');
                      void navigator.clipboard?.writeText(text);
                    }}
                  >
                    Copy table
                  </Button>
                  {notInData ? null : (
                    <Button
                      className="flow-btn"
                      type="button"
                      disabled={askedOwner || !thread.projectId}
                      onClick={() => {
                        if (!thread.projectId) return;
                        void flowJson(`/api/projects/${thread.projectId}/asker-log/request-check`, {
                          method: 'POST',
                          body: '{}',
                        })
                          .then(() => {
                            setAskedOwner(true);
                            thread.setStatus('Sent to the owner to check.');
                          })
                          .catch(() =>
                            thread.setStatus('Could not ask the owner to check that answer.')
                          );
                      }}
                    >
                      Ask owner to check
                    </Button>
                  )}
                  {askedOwner ? <span className="flow-muted">Not checked yet</span> : null}
                </>
              ) : null}
              {thread.clientDeck ? (
                <>
                  <Link className="flow-btn primary" href={clientDeckReportHref(projectHref)}>
                    Open in Report
                  </Link>
                  {thread.downloads[0] || thread.clientDeckSummary?.canDownload ? (
                    <Button
                      className="flow-btn"
                      type="button"
                      onClick={() => {
                        if (thread.downloads[0]) {
                          void openSignedDownload(thread.downloads[0]);
                          return;
                        }
                        if (!thread.datasetId) return;
                        thread.setStatus('Downloading PowerPoint…');
                        void import('@/lib/client-deck-job')
                          .then(({ exportClientDeckAgain }) =>
                            exportClientDeckAgain(thread.datasetId!, thread.turn?.tool_results, {
                              onProgress: message => thread.setStatus(message),
                            })
                          )
                          .then(() => thread.setStatus('PowerPoint downloaded.'))
                          .catch(() =>
                            thread.setStatus('That PowerPoint could not be downloaded.')
                          );
                      }}
                    >
                      Download .pptx
                    </Button>
                  ) : null}
                  {asker || !thread.datasetId ? null : (
                    <Button
                      className="flow-btn"
                      type="button"
                      disabled={thread.status === 'Thinking…'}
                      onClick={() => {
                        if (!thread.datasetId) return;
                        thread.setStatus('Exporting PowerPoint…');
                        void import('@/lib/client-deck-job')
                          .then(({ exportClientDeckAgain }) =>
                            exportClientDeckAgain(thread.datasetId!, thread.turn?.tool_results, {
                              onProgress: message => thread.setStatus(message),
                            })
                          )
                          .then(() => thread.setStatus('PowerPoint downloaded.'))
                          .catch(() =>
                            thread.setStatus('That PowerPoint could not be exported again.')
                          );
                      }}
                    >
                      Export again
                    </Button>
                  )}
                </>
              ) : (
                <>
                  {asker ? (
                    <Button
                      className="flow-btn primary"
                      type="button"
                      onClick={() => thread.setPanelOpen(true)}
                    >
                      Open as table
                    </Button>
                  ) : (
                    <Link
                      className="flow-btn primary"
                      href={
                        inReport
                          ? analysisSlideHref(projectHref, thread.runIds[0])
                          : analysisReportHref(projectHref, thread.runIds[0])
                      }
                    >
                      {inReport ? 'Open in report' : 'Open'}
                    </Link>
                  )}
                  {asker ? null : (
                    <>
                      <Button
                        className="flow-btn"
                        type="button"
                        disabled={!thread.runIds[0] || !thread.datasetId || inReport}
                        onClick={() => {
                          if (!thread.runIds[0] || !thread.datasetId || !thread.projectId) return;
                          const runId = thread.runIds[0];
                          const datasetId = thread.datasetId;
                          const projectId = thread.projectId;
                          void (async () => {
                            const { fetchAnalysisRun } = await import('@/lib/analysis-runs');
                            const { enrichPinFromRunDocument, runDocument } =
                              await import('@/components/flow/run-document');
                            let pin = {
                              id: `pin-${runId}`,
                              runId,
                              datasetId,
                              headline: thread.title,
                              support: thread.takeaway,
                              citation: thread.kind,
                              afterId: '',
                              deck: true,
                              topline: true,
                              keepLive: true,
                            };
                            const run = await fetchAnalysisRun(runId);
                            if (run) {
                              const enriched = enrichPinFromRunDocument(
                                pin,
                                runDocument({
                                  op: run.op,
                                  title: run.report?.meta?.title,
                                  report: run.report,
                                  result: run.result,
                                  created_at: run.created_at,
                                })
                              );
                              pin = { ...enriched, datasetId };
                            }
                            await savePin(projectId, datasetId, pin);
                            thread.setStatus('Added to the report.');
                            router.push(analysisSlideHref(projectHref, runId));
                          })().catch(() =>
                            thread.setStatus('That result could not be added to the report.')
                          );
                        }}
                      >
                        {inReport ? 'In report' : 'Add to report'}
                      </Button>
                      <Button
                        className="flow-btn"
                        type="button"
                        disabled={!thread.datasetId}
                        onClick={saveTable}
                      >
                        Save table
                      </Button>
                    </>
                  )}
                  {thread.downloads[0] ? (
                    <Button
                      className="flow-btn"
                      type="button"
                      onClick={() => void openSignedDownload(thread.downloads[0])}
                    >
                      Download {thread.downloads[0].filename}
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ) : null}
        {thread.status === 'Thinking…' || thread.status === AGENT_LOOP_RETRYING_MESSAGE ? (
          <p className="flow-status">{thread.status}</p>
        ) : null}
        {thread.status &&
        thread.status !== 'Thinking…' &&
        thread.status !== AGENT_LOOP_RETRYING_MESSAGE ? (
          <p className="flow-error">{thread.status}</p>
        ) : null}
      </div>
      {thread.nextSteps.length && thread.status !== 'Thinking…' ? (
        <div className="chat-next-steps" aria-label="Suggested next steps">
          <div className="chat-next-steps-label">Next steps</div>
          <div className="chat-next-steps-chips">
            {thread.nextSteps.map(step => (
              <Button
                key={step.n}
                className="chat-next-step"
                type="button"
                disabled={thread.runBusy || thread.status === 'Thinking…'}
                onClick={() => thread.send(step.prompt)}
              >
                {step.n} · {step.label}
              </Button>
            ))}
          </div>
          <p className="chat-next-steps-hint">Type a number to run one.</p>
        </div>
      ) : null}
      {thread.awayNote ? (
        <div className="chat-away-note" role="status">
          <span>Long run finished while you were away</span>
          <span className="chat-away-note-meta">· browser notification</span>
        </div>
      ) : null}
      <FlowComposer
        layout="thread"
        value={thread.question}
        onChange={thread.setQuestion}
        onSend={thread.send}
        placeholder={placeholder}
        mode={thread.mode}
        onMode={thread.setMode}
        busy={thread.runBusy || thread.status === 'Thinking…' || thread.approving}
        columns={thread.columnNames}
        attachments={thread.attachments}
        onAttach={thread.attachFiles}
        onRemoveAttachment={filename =>
          thread.setAttachments(current => current.filter(item => item.filename !== filename))
        }
        attachError={thread.attachError}
      />
    </>
  );

  return (
    <div className={`${panel ? 'agent-thread-panel' : 'chat-column'}${asker ? ' is-asker' : ''}`}>
      {askerRail}
      {asker ? <div className="asker-thread-main">{mainBody}</div> : mainBody}
    </div>
  );
}

export function AgentThread({
  placeholder,
  projectHref,
  panel = true,
  emptyTitle,
  emptyDescription,
  emptySuggestions,
  ...options
}: AgentThreadOptions & {
  placeholder: string;
  projectHref: string;
  panel?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptySuggestions?: string[];
}) {
  const thread = useAgentThread(options);
  return (
    <AgentThreadColumn
      thread={thread}
      placeholder={placeholder}
      projectHref={projectHref}
      panel={panel}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      emptySuggestions={emptySuggestions}
    />
  );
}
