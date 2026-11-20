'use client';

import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { FlowComposer, readChatAttachments } from '@/components/flow/chat-composer';
import { AnalysisResult } from '@/components/flow/analysis-result';
import { exportResultAsPptx } from '@/lib/output-pptx';
import {
  answerTables,
  answerWithoutBase,
  answerWithoutTables,
  withoutResultTokens,
  outputBaseClause,
  outputCardReady,
  outputChecks,
  hasSummaryTable,
  isProcedurePlaceholder,
  EMPTY_TURN_ANSWER,
  keptModelAnswer,
  visibleTurnAnswer,
  outputKind,
  outputRunIds,
  outputStat,
  outputTakeaway,
  outputTitle,
  resultLead,
  guardUserText,
  titledWithQuestion,
} from '@/components/flow/chat-output';
import { ThreadResult, useEnrichedToolResults } from '@/components/flow/use-enriched-results';
import {
  answerResultTables,
  resultFootnote,
  resultViewFromToolResults,
  type ColumnLabels,
} from '@/components/flow/result-tables';
import { FlowMarkdown } from '@/components/flow/flow-markdown';
import { savePin, useProjectPins } from '@/components/flow/report-pins';
import { answeredTurnCount, savedChatTurn, type StoredChatTurn } from '@/lib/chat-session-turn';
import { flowJson } from '@/lib/flow-api';
import {
  downloadsFromToolResults,
  openSignedDownload,
  type ExportDownload,
} from '@/lib/excel-download';
import {
  runAgentLoop,
  type AgentLoopAttachment,
  type AgentLoopResponse,
} from '@/lib/run-agent-loop';
import { visibleAgentStep } from '@/lib/agent-step-copy';
import {
  chatTurnChangesFromToolResults,
  notifyChatRunFinished,
  numberedNextStepsFromTurn,
  resolveNumberedNextStep,
  summarizeChatSteps,
  type NumberedNextStep,
} from '@/lib/chat-turn-parity';
import { ChatTurnChangesPanel } from '@/components/flow/chat-turn-changes';
import { sortSessionsByRecency } from '@/components/flow/chat-sessions';
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
  });
}

function notifyFinishedTurn(result: AgentLoopResponse, startedAt: number): boolean {
  const body = (result.answer_markdown || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  return notifyChatRunFinished({
    title: 'Tensr finished a chat reply',
    body: body || undefined,
    startedAt,
  });
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
  return (result.tool_results || []).some(item => {
    const payload = item.result;
    if (!payload || typeof payload !== 'object') return false;
    const procedure = String(item.name || payload.procedure || '');
    if (
      procedure !== 'build_client_deck' &&
      String(payload.procedure || '') !== 'build_client_deck'
    ) {
      return false;
    }
    const status = String(payload.status || '');
    return (
      payload.pending === true ||
      status === 'pending' ||
      status === 'running' ||
      Boolean(String(payload.job_id || '').trim() && status !== 'complete' && status !== 'failed')
    );
  });
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

  const noteSession = useCallback(
    (sessionId: string, title: string) => {
      sessionRef.current = sessionId;
      rememberChat(sessionId);
      const row = {
        session_id: sessionId,
        title: title.length > 80 ? `${title.slice(0, 77)}…` : title,
        updated_at: new Date().toISOString(),
      };
      if (!aliveRef.current) return;
      setSessions(current => {
        const rest = (current || []).filter(item => item.session_id !== row.session_id);
        return sortSessionsByRecency([row, ...rest]);
      });
      onSessionRef.current?.(row);
    },
    [rememberChat]
  );

  const loadRail = useCallback(() => {
    if (!projectId) return;
    void flowJson<{ sessions?: AgentChatSession[] }>(`/api/projects/${projectId}/sessions`, {
      signal: AbortSignal.timeout(15000),
    })
      .then(page => setSessions(sortSessionsByRecency(page.sessions || [])))
      .catch(() => setSessions(current => current || []));
  }, [projectId]);

  useEffect(() => {
    loadRail();
  }, [loadRail]);

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
            if (watchToken !== turnTokenRef.current || !aliveRef.current) return;
            shown(() => {
              setSteps(current => (current.includes(message) ? current : [...current, message]));
            });
          },
          onReportPages: () => {
            if (aliveRef.current) onReportUpdatedRef.current?.();
          },
          onUpdate: next => {
            if (watchToken !== turnTokenRef.current || !aliveRef.current) return;
            const nextAnswer = visibleTurnAnswer(
              next.status,
              keptModelAnswer('', next.answer_markdown || '')
            );
            shown(() => {
              setAnswer(nextAnswer);
              setTurn(next);
              setDownloads(downloadEntries(next));
              setNextSteps(
                nextStepsForResult(next, columnLabels, reportPinsRef.current.length > 0)
              );
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
        const page = await flowJson<{ turns?: StoredChatTurn[] }>(
          `/api/projects/${projectId}/sessions/${sessionId}`
        );
        const saved = savedChatTurn(page.turns, question, nextMode, alreadyAnswered);
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
      if (!text.trim() || sendingRef.current) return false;
      const turnToken = ++turnTokenRef.current;
      if (statusRef.current === 'Thinking…' && (!projectId || chatRunInFlight(projectId)))
        return false;
      if (projectId && chatRunInFlight(projectId)) return false;
      sendingRef.current = true;
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
        if (reshapeAsk && reshapeFileId && reshapePins.length) {
          shown(() => setSteps(['Reshaping the report…']));
          publish({ steps: ['Reshaping the report…'], status: 'Thinking…' });
          const reshaped = await flowJson<{
            ok?: boolean;
            note?: string;
            variant_section?: string;
            variant_page_ids?: string[];
            document?: { pages?: unknown[] };
          }>(`/datasets/${reshapeFileId}/report/reshape`, {
            method: 'POST',
            body: JSON.stringify({
              message: text,
              kind: reshapeAsk.kind,
              max_slides: reshapeAsk.maxSlides,
              audience_label: reshapeAsk.audienceLabel,
              include_recommendations: reshapeAsk.includeRecommendations,
              recommendation_count: reshapeAsk.recommendationCount,
              placement: reshapeAsk.placement,
              document: reportDocumentForApi(documentFromPins(reshapePins)),
              persist: true,
            }),
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
        }

        const result = await runAgentLoop({
          message: text,
          mode: nextMode,
          datasetId: datasetId || null,
          attachments: turnFiles,
          agentVersion: 'v2',
          sessionId: sessionRef.current,
          signal: AbortSignal.timeout(120_000),
          recover,
          onProgress: progress => {
            const line = visibleAgentStep(progress.step, progress.message);
            if (!line) return;
            shown(() =>
              setSteps(current => (current.includes(line) ? current : [...current, line]))
            );
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
        const kept = visibleTurnAnswer(
          result.status,
          keptModelAnswer(draft, result.answer_markdown || '')
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
        const message = err instanceof Error ? err.message : 'The reply did not finish. Ask again.';
        // Clear the live panel so a failed follow-up does not keep an old deck preview.
        shown(() => {
          setStatus(message);
          setTurn(null);
          setPlan(null);
        });
        publish({ running: false, status: message });
        return true;
      } finally {
        sendingRef.current = false;
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
    if (!plan || !sent) return;
    const batch =
      plan.pending_approvals && !Array.isArray(plan.pending_approvals)
        ? plan.pending_approvals
        : null;
    const calls = Array.isArray(plan.pending_approvals) ? plan.pending_approvals : null;
    const approvedSession = plan.session_id || sessionRef.current;
    const turnToken = ++turnTokenRef.current;
    const startedAt = Date.now();
    approvingRef.current = true;
    setApproving(true);
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
      attachments: attachmentsRef.current,
      agentVersion: 'v2',
      sessionId: plan.session_id,
      approvedToolCalls: calls,
      approvedBatch:
        batch && typeof batch.mac === 'string' ? { batch: batch.batch, mac: batch.mac } : null,
      signal: AbortSignal.timeout(120_000),
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
        const traced = replyLines(result);
        const keptSteps = stepsAfterReply(stepsRef.current, traced);
        const entries = downloadEntries(result);
        const kept = visibleTurnAnswer(
          result.status,
          keptModelAnswer(streamedRef.current, result.answer_markdown || '')
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
          });
        }
        approvingRef.current = false;
      })
      .catch(err => {
        if (turnToken !== turnTokenRef.current) return;
        const message = err instanceof Error ? err.message : 'The plan did not run.';
        shown(() => {
          setApproving(false);
          setStatus(message);
        });
        const current = liveChatRun();
        if (projectId && livePublishMatches(current, projectId, approvedSession, sent)) {
          publishLiveChatRun({ ...current!, running: false, status: message });
        }
        approvingRef.current = false;
      });
  };

  const clearChat = () => {
    turnTokenRef.current += 1;
    approvingRef.current = false;
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
      void flowJson<{
        turns?: {
          user?: string;
          answer?: string;
          tool_results?: AgentLoopResponse['tool_results'];
          steps?: { name?: string; message?: string }[];
        }[];
      }>(`/api/projects/${projectId}/sessions/${sessionId}`, { signal: controller.signal })
        .then(page => {
          if (token !== openToken.current) return;
          const exchanges = (page.turns || []).flatMap(item =>
            item.user
              ? [
                  {
                    user: item.user,
                    note: '',
                    answer:
                      (item.answer || '').trim() || (item.steps?.length ? EMPTY_TURN_ANSWER : ''),
                    toolResults: item.tool_results,
                    steps: item.steps,
                  },
                ]
              : []
          );
          const last = exchanges[exchanges.length - 1];
          const restoredAnswer =
            (last?.answer || '').trim() || (last?.steps?.length ? EMPTY_TURN_ANSWER : '');
          const restoredTurn: AgentLoopResponse | null = last
            ? {
                status: 'ok',
                mode: 'agent',
                answer_markdown: restoredAnswer,
                session_id: sessionId,
                tool_results: last.toolResults,
              }
            : null;
          shown(() => {
            setPast(last ? exchanges.slice(0, -1) : exchanges);
            setSent(last?.user || '');
            setAttachedNote('');
            setAnswer(restoredAnswer);
            if (!questionRef.current && projectId) {
              setQuestion(window.sessionStorage.getItem(draftKey(projectId)) || '');
            }
            setPlan(null);
            setTurn(restoredTurn);
            setSteps(stepLines(last?.steps));
            setAwayNote(false);
            setNextSteps(
              restoredTurn
                ? nextStepsForResult(restoredTurn, columnLabels, reportPinsRef.current.length > 0)
                : []
            );
            setDownloads([]);
            setAttachments([]);
            setAttachError(null);
            setStatus(null);
            // Failed tool steps still leave tool_results; only a ready output opens the column.
            setPanelOpen(outputCardReady(restoredTurn, false));
          });
          // Resume deck progress polling when reopening a chat mid-build.
          if (restoredTurn) {
            const watchToken = ++turnTokenRef.current;
            startDeckWatch(restoredTurn, watchToken);
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
  const kind = outputKind(toolResults);
  const title = outputTitle(toolResults, answer, columnLabels);
  const takeaway = outputTakeaway(answer);
  const baseNote = outputBaseClause(toolResults, answer);
  const stat = outputStat(toolResults, answer, takeaway);
  const runIds = outputRunIds(toolResults);
  const outputReady = outputCardReady(turn, Boolean(plan));
  useEffect(() => {
    // Open on the first real output; close again if the latest turn has none (e.g. a failed run).
    setPanelOpen(outputReady);
  }, [outputReady]);
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
  const prose = answerWithoutBase(
    withoutResultTokens(
      structuredTables.length || resultCharts.length ? answerWithoutTables(answer) : answer
    )
  );
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
}: {
  thread: AgentThreadState;
  placeholder: string;
  projectHref: string;
  panel?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const [stepsOpen, setStepsOpen] = useState(true);
  const [asker, setAsker] = useState(false);
  const [askedOwner, setAskedOwner] = useState(false);
  useEffect(() => {
    if (!thread.projectId) return;
    let live = true;
    void flowJson<{ user_id?: string }>('/me')
      .then(me =>
        flowJson<{ members?: { user_id?: string; role?: string }[] }>(
          `/api/projects/${thread.projectId}/members`
        ).then(page => {
          if (!live) return;
          const mine = (page.members || []).find(member => member.user_id === me.user_id);
          setAsker(mine?.role === 'asker');
        })
      )
      .catch(() => {
        if (live) setAsker(false);
      });
    return () => {
      live = false;
    };
  }, [thread.projectId]);
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

  return (
    <div className={panel ? 'agent-thread-panel' : 'chat-column'}>
      {asker ? (
        <aside className="asker-rail">
          <p>Can ask</p>
          <p className="flow-muted">Audiences you can ask about</p>
          <p className="flow-muted">The audiences shared with this project.</p>
          <p>Your questions</p>
          {thread.past.map(item => (
            <p key={item.user}>{item.user}</p>
          ))}
          <div>
            <p>What you can do here</p>
            <p className="flow-muted">
              Ask questions and copy answers. You can&apos;t change data, weights, audiences or the
              report. Answers you mark get checked by the project owner.
            </p>
          </div>
        </aside>
      ) : null}
      <div className="chat-scroll">
        {!thread.showThread && panel ? (
          <Empty className="min-h-[280px] border-0 bg-transparent">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessageSquare />
              </EmptyMedia>
              <EmptyTitle className="text-sm">{emptyTitle}</EmptyTitle>
              <EmptyDescription>{emptyDescription}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
        {thread.past.map((item, index) => {
          const pastChanges = chatTurnChangesFromToolResults(
            (item.toolResults || []).map(entry => ({
              name: entry.name,
              result: entry.result,
            }))
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
                  disabled={thread.status === 'Thinking…'}
                  onRestored={() => thread.setStatus('Restored the previous version.')}
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
        {thread.answer && (!thread.plan || thread.approving) ? (
          thread.structuredTables.length || thread.resultCharts.length ? (
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
            />
          ) : (
            <FlowMarkdown className="chat-prose">{thread.prose}</FlowMarkdown>
          )
        ) : null}
        {asker && thread.answer && (!thread.plan || thread.approving) ? (
          <div className="asker-worked">
            <p>How it was worked out</p>
            <p>
              <span className="flow-muted">Audience</span>{' '}
              {thread.resultView.audienceDefinition ||
                thread.resultView.audience ||
                'The rows this answer used'}
            </p>
            <p>
              <span className="flow-muted">Base</span>{' '}
              {thread.resultView.base || thread.resultView.baseDetail || 'The base on this answer'}
            </p>
            <p>
              <span className="flow-muted">Weight</span>{' '}
              {thread.resultView.weight || 'The project weight'}
            </p>
            <p>
              <span className="flow-muted">Source</span>{' '}
              {[thread.resultView.wave, thread.resultView.source].filter(Boolean).join(' · ') ||
                'This project’s file'}
            </p>
          </div>
        ) : null}
        {showLiveChanges ? (
          <ChatTurnChangesPanel
            projectId={thread.projectId}
            changes={liveChanges}
            disabled={thread.status === 'Thinking…'}
            onRestored={() => thread.setStatus('Restored the previous version.')}
          />
        ) : null}
        {thread.outputReady ? (
          <div className="chat-result">
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
            <div className="chat-result-actions">
              {asker ? (
                <>
                  <span className="output-badge">Can ask · ask questions only</span>
                  <Button
                    className="flow-btn"
                    type="button"
                    onClick={() => {
                      const text = [thread.lead, thread.footnote].filter(Boolean).join('\n');
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
                  <Button
                    className="flow-btn"
                    type="button"
                    disabled={!thread.structuredTables.length && !thread.lead}
                    onClick={() => {
                      void exportResultAsPptx({
                        runId: thread.runIds[0],
                        lead: thread.lead || thread.takeaway,
                        tables: thread.structuredTables,
                        footnote: thread.footnote,
                        projectId: thread.projectId,
                      })
                        .then(() => thread.setStatus('Slide downloaded.'))
                        .catch(() => thread.setStatus('That slide could not be downloaded.'));
                    }}
                  >
                    Download slide
                  </Button>
                  <Button
                    className="flow-btn"
                    type="button"
                    onClick={() => {
                      setAskedOwner(true);
                      thread.setStatus('Sent to the owner to check.');
                    }}
                  >
                    Ask owner to check
                  </Button>
                  {askedOwner ? <span className="flow-muted">Not checked yet</span> : null}
                </>
              ) : null}
              <Link
                className="flow-btn primary"
                href={
                  thread.runIds[0]
                    ? `${projectHref}/report?pane=outputs&run=${encodeURIComponent(thread.runIds[0])}`
                    : `${projectHref}/report?pane=outputs`
                }
              >
                Open
              </Link>
              {asker ? null : (
                <>
                  <Button
                    className="flow-btn"
                    type="button"
                    disabled={!thread.runIds[0] || !thread.datasetId || inReport}
                    onClick={() => {
                      if (!thread.runIds[0] || !thread.datasetId || !thread.projectId) return;
                      void savePin(thread.projectId, thread.datasetId, {
                        id: thread.runIds[0],
                        runId: thread.runIds[0],
                        datasetId: thread.datasetId,
                        headline: thread.title,
                        support: thread.takeaway,
                        citation: thread.kind,
                        afterId: '',
                        deck: true,
                        topline: true,
                        keepLive: true,
                      })
                        .then(() => thread.setStatus('Added to the report.'))
                        .catch(() =>
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
            </div>
          </div>
        ) : null}
        {thread.status === 'Thinking…' ? <p className="flow-status">Thinking…</p> : null}
        {thread.status && thread.status !== 'Thinking…' ? (
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
                disabled={thread.status === 'Thinking…'}
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
        busy={thread.status === 'Thinking…'}
        columns={thread.columnNames}
        attachments={thread.attachments}
        onAttach={thread.attachFiles}
        onRemoveAttachment={filename =>
          thread.setAttachments(current => current.filter(item => item.filename !== filename))
        }
        attachError={thread.attachError}
      />
    </div>
  );
}

export function AgentThread({
  placeholder,
  projectHref,
  panel = true,
  emptyTitle,
  emptyDescription,
  ...options
}: AgentThreadOptions & {
  placeholder: string;
  projectHref: string;
  panel?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
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
    />
  );
}
