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
  publishLiveChatRun,
  subscribeLiveChatRun,
} from '@/components/flow/chat-live-run';
import { FlowComposer, readChatAttachments } from '@/components/flow/chat-composer';
import { AnalysisResult } from '@/components/flow/analysis-result';
import {
  answerTables,
  answerWithoutBase,
  answerWithoutTables,
  outputBaseClause,
  outputCardReady,
  outputChecks,
  outputKind,
  outputRunIds,
  outputStat,
  outputTakeaway,
  outputTitle,
  titledWithQuestion,
} from '@/components/flow/chat-output';
import { ThreadResult, useEnrichedToolResults } from '@/components/flow/use-enriched-results';
import {
  resultFootnote,
  resultViewFromToolResults,
  type ColumnLabels,
} from '@/components/flow/result-tables';
import { FlowMarkdown } from '@/components/flow/flow-markdown';
import { savePin } from '@/components/flow/report-pins';
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

export type AgentChatSession = { session_id: string; title?: string; updated_at?: string };

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
};

function replyLines(result: AgentLoopResponse): string[] {
  const summary = result.execution_summary?.trim();
  if (summary) {
    return summary.split('\n').flatMap(line => {
      const visible = visibleAgentStep('', line.replace(/^[\s\-*•]+/, '').trim());
      return visible ? [visible] : [];
    });
  }
  return (result.tool_trace || []).flatMap(item => {
    const message = item.message || item.summary;
    const name = item.name || item.tool;
    const line = visibleAgentStep(
      typeof name === 'string' ? name : '',
      typeof message === 'string' ? message : ''
    );
    return line ? [line] : [];
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
}: AgentThreadOptions) {
  const [question, setQuestion] = useState('');
  const [sent, setSent] = useState('');
  const [past, setPast] = useState<ChatExchange[]>([]);
  const [mode, setMode] = useState<Mode>('agent');
  const [answer, setAnswer] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [downloads, setDownloads] = useState<ExportDownload[]>([]);
  const [plan, setPlan] = useState<AgentLoopResponse | null>(null);
  const [turn, setTurn] = useState<AgentLoopResponse | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
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
  const answerRef = useRef('');
  const stepsRef = useRef<string[]>([]);
  const noteRef = useRef('');
  const toolResultsRef = useRef(turn?.tool_results);
  toolResultsRef.current = turn?.tool_results;
  sentRef.current = sent;
  answerRef.current = answer;
  stepsRef.current = steps;
  noteRef.current = attachedNote;
  const askedRef = useRef<string | null>(null);
  const sendingRef = useRef(false);
  const approvingRef = useRef(false);
  const aliveRef = useRef(true);
  const statusRef = useRef<string | null>(null);
  const modeRef = useRef<Mode>('agent');
  const openToken = useRef(0);
  const openAbort = useRef<AbortController | null>(null);
  const onSessionRef = useRef(onSession);
  const onFinishedRef = useRef(onFinished);
  const onAskedRef = useRef(onAsked);
  const openChatRef = useRef<(sessionId: string) => void>(() => undefined);
  statusRef.current = status;
  modeRef.current = mode;
  onSessionRef.current = onSession;
  onFinishedRef.current = onFinished;
  onAskedRef.current = onAsked;

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      openToken.current += 1;
      openAbort.current?.abort();
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
      };
      if (!aliveRef.current) return;
      setSessions(current => {
        const rest = (current || []).filter(item => item.session_id !== row.session_id);
        return [row, ...rest];
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
      .then(page => setSessions(page.sessions || []))
      .catch(() => setSessions(current => current || []));
  }, [projectId]);

  useEffect(() => {
    loadRail();
  }, [loadRail]);

  const attachFiles = (list: FileList | null) => {
    void readChatAttachments(list).then(result => {
      setAttachError(result.rejected.length ? result.rejected.join(' ') : null);
      if (result.accepted.length) {
        setAttachments(current => [...current, ...result.accepted]);
      }
    });
  };

  const sendText = useCallback(
    async (text: string, nextMode: Mode = modeRef.current) => {
      if (!text.trim() || sendingRef.current) return false;
      if (statusRef.current === 'Thinking…' && (!projectId || chatRunInFlight(projectId)))
        return false;
      if (projectId && chatRunInFlight(projectId)) return false;
      sendingRef.current = true;
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
      setMode(nextMode);
      setPlan(null);
      setTurn(null);
      setSteps([]);
      setDownloads([]);
      setStatus('Thinking…');
      setAnswer('');
      let draft = '';
      try {
        const result = await runAgentLoop({
          message: text,
          mode: nextMode,
          datasetId: datasetId || null,
          attachments: turnFiles,
          agentVersion: 'v2',
          sessionId: sessionRef.current,
          signal: AbortSignal.timeout(120_000),
          onProgress: progress => {
            const line = visibleAgentStep(progress.step, progress.message);
            if (!line) return;
            shown(() =>
              setSteps(current => (current.includes(line) ? current : [...current, line]))
            );
            const prior = liveChatRun();
            publish({
              steps: prior?.steps.includes(line) ? prior.steps : [...(prior?.steps || []), line],
              status: null,
              answer: draft,
            });
          },
          onDelta: chunk => {
            draft += chunk;
            shown(() => {
              setAnswer(draft);
              setStatus(null);
            });
            publish({ answer: draft, status: null });
          },
          onReplace: next => {
            draft = next;
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
            const previewText = preview.text || draft;
            if (previewText) draft = previewText;
            shown(() => {
              if (previewText) setAnswer(previewText);
              setStatus(null);
              if (preview.tool_results?.length) {
                setTurn({
                  status: 'ok',
                  mode: nextMode,
                  answer_markdown: previewText,
                  session_id: sessionRef.current || undefined,
                  tool_results: preview.tool_results,
                });
              }
            });
            publish({ answer: previewText, status: null });
          },
        });
        if (result.session_id) noteSession(result.session_id, text.trim());
        const traced = replyLines(result);
        const entries = downloadEntries(result);
        shown(() => {
          setAnswer(result.answer_markdown || '');
          setPlan(result.status === 'awaiting_approval' ? result : null);
          setTurn(result.status === 'awaiting_approval' ? null : result);
          if (traced.length) setSteps(traced);
          setDownloads(entries);
          if (result.status !== 'awaiting_approval') setAttachments([]);
          setStatus(null);
        });
        if (result.status !== 'awaiting_approval' && aliveRef.current)
          onFinishedRef.current?.(result);
        publish({
          running: false,
          status: null,
          answer: result.answer_markdown || draft,
          sessionId: result.session_id || sessionRef.current,
        });
        if (aliveRef.current) loadRail();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'The reply did not finish. Ask again.';
        shown(() => setStatus(message));
        publish({ running: false, status: message });
        return true;
      } finally {
        sendingRef.current = false;
      }
    },
    [datasetId, loadRail, projectId, noteSession, shown]
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
    approvingRef.current = true;
    setStatus('Thinking…');
    if (projectId) {
      publishLiveChatRun({
        projectId,
        sessionId: plan.session_id || sessionRef.current,
        question: sent,
        answer: answerRef.current,
        steps: stepsRef.current,
        status: 'Thinking…',
        running: true,
      });
    }
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
      onDelta: chunk => {
        shown(() => {
          setAnswer(current => current + chunk);
          setStatus(null);
        });
      },
    })
      .then(result => {
        const traced = replyLines(result);
        const entries = downloadEntries(result);
        shown(() => {
          setAnswer(result.answer_markdown || '');
          setPlan(result.status === 'awaiting_approval' ? result : null);
          setTurn(result.status === 'awaiting_approval' ? null : result);
          if (traced.length) setSteps(traced);
          setDownloads(entries);
          if (result.status !== 'awaiting_approval') setAttachments([]);
          setStatus(null);
        });
        if (result.status !== 'awaiting_approval' && aliveRef.current)
          onFinishedRef.current?.(result);
        const current = liveChatRun();
        if (projectId && current?.projectId === projectId) {
          publishLiveChatRun({
            ...current,
            running: false,
            status: null,
            answer: result.answer_markdown || current.answer,
            steps: stepsRef.current,
          });
        }
        approvingRef.current = false;
      })
      .catch(err => {
        const message = err instanceof Error ? err.message : 'The plan did not run.';
        shown(() => setStatus(message));
        const current = liveChatRun();
        if (projectId && current?.projectId === projectId) {
          publishLiveChatRun({ ...current, running: false, status: message });
        }
        approvingRef.current = false;
      });
  };

  const clearChat = () => {
    sessionRef.current = null;
    publishLiveChatRun(null);
    rememberChat(null);
    setPast([]);
    setSent('');
    setAttachedNote('');
    setAnswer('');
    setQuestion('');
    setPlan(null);
    setTurn(null);
    setSteps([]);
    setDownloads([]);
    setAttachments([]);
    setAttachError(null);
    setStatus(null);
    setPanelOpen(false);
  };

  const openChat = useCallback(
    (sessionId: string) => {
      if (!projectId || !sessionId) return;
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
                    answer: item.answer || '',
                    toolResults: item.tool_results,
                  },
                ]
              : []
          );
          const last = exchanges[exchanges.length - 1];
          shown(() => {
            setPast(last ? exchanges.slice(0, -1) : exchanges);
            setSent(last?.user || '');
            setAttachedNote('');
            setAnswer(last?.answer || '');
            setQuestion('');
            setPlan(null);
            setTurn(
              last
                ? {
                    status: 'ok',
                    mode: 'agent',
                    answer_markdown: last.answer,
                    session_id: sessionId,
                    tool_results: last.toolResults,
                  }
                : null
            );
            setSteps([]);
            setDownloads([]);
            setAttachments([]);
            setAttachError(null);
            setStatus(null);
            setPanelOpen(Boolean(last?.toolResults?.length));
          });
        })
        .catch(err => {
          if (token !== openToken.current) return;
          if (err instanceof DOMException && err.name === 'AbortError') return;
          shown(() => setStatus('That chat could not be opened.'));
        });
    },
    [projectId, rememberChat, shown]
  );
  openChatRef.current = openChat;

  useEffect(() => {
    const apply = () => {
      const run = liveChatRun();
      if (!run || run.projectId !== projectId) return;
      // This screen is sending or approving. Its own state is the thread.
      // Reloading the saved session here clears the plan before the column is saved.
      if (sendingRef.current || approvingRef.current) return;
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
    if (sessionId) openChat(sessionId);
    // Read the open chat once for this project. A later keystroke must not reload it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, syncAddress]);

  const toolResults = useEnrichedToolResults(turn?.tool_results);
  const kind = outputKind(toolResults);
  const title = outputTitle(toolResults, answer, columnLabels);
  const takeaway = outputTakeaway(answer);
  const baseNote = outputBaseClause(toolResults, answer);
  const stat = outputStat(toolResults, answer, takeaway);
  const runIds = outputRunIds(toolResults);
  const outputReady = outputCardReady(turn, Boolean(plan));
  useEffect(() => {
    if (outputReady) setPanelOpen(true);
  }, [outputReady]);
  const checks = outputChecks(toolResults);
  const tables = answerTables(answer);
  const prose = answerWithoutBase(panelOpen && tables ? answerWithoutTables(answer) : answer);
  const tableMode = kind === 'Crosstab' && Boolean(tables);
  const ledger = (turn?.turn_state?.ledger || {}) as { weight?: string | null };
  const resultView = resultViewFromToolResults(toolResults);
  const structuredTables = resultView.tables.map(table => ({
    ...table,
    title: titledWithQuestion(table.title, columnLabels),
  }));
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
    setPlan,
    turn,
    steps,
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
    tableMode,
    ledger,
    resultView,
    structuredTables,
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
  return text;
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

  return (
    <div className={panel ? 'agent-thread-panel' : 'chat-column'}>
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
        {thread.past.map((item, index) => (
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
          </div>
        ))}
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
              Ran {thread.steps.length} {thread.steps.length === 1 ? 'step' : 'steps'}
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
                {thread.steps.map(step => (
                  <div key={step}>{step}</div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {thread.answer && !thread.plan ? (
          thread.structuredTables.length ? (
            <AnalysisResult
              lead={thread.takeaway}
              tables={thread.structuredTables}
              footnote={thread.footnote}
              checks={thread.resultChecks}
              script={thread.resultView.script}
              rCheck={thread.resultView.rCheck}
              rStatement={thread.resultView.rStatement}
              runId={thread.runIds[0]}
            />
          ) : (
            <FlowMarkdown className="chat-prose">{thread.prose}</FlowMarkdown>
          )
        ) : null}
        {thread.plan ? (
          <div className="chat-plan">
            <strong>Waiting for approval · Plan</strong>
            <FlowMarkdown>{planCopy(thread.answer)}</FlowMarkdown>
            <div className="flow-row">
              <Button className="flow-btn primary" type="button" onClick={thread.approve}>
                Approve
              </Button>
              <Button className="flow-btn" type="button" onClick={() => thread.setPlan(null)}>
                Edit plan
              </Button>
            </div>
          </div>
        ) : null}
        {thread.outputReady ? (
          <div className="chat-result">
            <div className="chat-result-top">
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
              <span className="chat-viewing">Viewing</span>
            </div>
            <div className="chat-result-actions">
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
              <Button
                className="flow-btn"
                type="button"
                disabled={!thread.runIds[0] || !thread.datasetId}
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
                    .catch(() => thread.setStatus('That result could not be added to the report.'));
                }}
              >
                Add to report
              </Button>
              <Button
                className="flow-btn"
                type="button"
                disabled={!thread.datasetId}
                onClick={saveTable}
              >
                Save table
              </Button>
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
