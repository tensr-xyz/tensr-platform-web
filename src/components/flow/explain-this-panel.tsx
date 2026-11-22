'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  buildExplainThisPanel,
  seedChatDraft,
  type ExplainThisPanelModel,
} from '@/lib/explain-this';
import {
  chatPromptForWarnings,
  explainWarnings,
  warningsFromOutputChecks,
} from '@/lib/explain-warnings';
import { getStytchBearerForTensrApi } from '@/utils/auth';

/** Paper 10g · table toolbar → Explain this. */
export function ExplainThisPanel({
  title,
  lead,
  footnote,
  checks,
  baseNote,
  projectId,
  datasetId,
  checkItems,
}: {
  title?: string;
  lead?: string;
  footnote?: string;
  checks?: string[];
  baseNote?: string;
  projectId?: string;
  datasetId?: string;
  /** Structured chips when available (warn preferred for Explain all). */
  checkItems?: Array<{ label: string; warn?: boolean }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [override, setOverride] = useState<ExplainThisPanelModel | null>(null);

  const local = useMemo(
    () =>
      buildExplainThisPanel({
        title,
        lead,
        footnote,
        checks: checks || (checkItems || []).map(item => item.label).filter(Boolean),
        baseNote,
      }),
    [title, lead, footnote, checks, checkItems, baseNote]
  );
  const panel = override || local;

  const openPanel = () => {
    setError('');
    setOverride(null);
    setOpen(true);
  };

  const explainWarningsIntoPanel = async (scope: 'one' | 'all') => {
    const token = getStytchBearerForTensrApi();
    if (!token) {
      setError('Sign in to explain warnings.');
      setOpen(true);
      return;
    }
    const chips = checkItems?.length
      ? warningsFromOutputChecks(checkItems, { all: scope === 'all' })
      : (checks || []).map(message => ({ message, source: 'output' as const }));
    if (!chips.length) {
      openPanel();
      return;
    }
    setBusy(true);
    setError('');
    setOpen(true);
    try {
      const result = await explainWarnings(
        {
          warnings: chips,
          scope,
          datasetId,
          projectId,
        },
        token
      );
      const care = result.warnings
        .map(row => row.message)
        .filter(Boolean)
        .join(' ');
      setOverride({
        ...local,
        sections: local.sections.map(section =>
          section.label === 'Read with care'
            ? { ...section, body: result.markdown || care || section.body }
            : section
        ),
        chatPrompt: result.chat_prompt || chatPromptForWarnings(chips, scope),
        reportNotePrompt: `Add this explanation to the report as a note under “${local.title}”:\n\n${result.markdown || local.markdown}`,
        markdown: result.markdown || local.markdown,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not explain the warnings.');
      setOverride(null);
    } finally {
      setBusy(false);
    }
  };

  const goChat = (prompt: string) => {
    if (!projectId) return;
    const href = seedChatDraft(projectId, prompt);
    if (href) router.push(href);
  };

  const warnCount = (checkItems || []).filter(item => item.warn).length;
  const hasChecks = Boolean((checks && checks.length) || (checkItems && checkItems.length));

  return (
    <div className="explain-this">
      {!open ? (
        <div className="explain-this-toolbar">
          <Button type="button" className="explain-this-btn" onClick={openPanel}>
            Explain this
          </Button>
          {hasChecks ? (
            <Button
              type="button"
              className="explain-this-link"
              disabled={busy}
              onClick={() => void explainWarningsIntoPanel(warnCount > 1 ? 'all' : 'one')}
            >
              {warnCount > 1 || (checks && checks.length > 1)
                ? 'Explain all warnings'
                : 'Explain this warning'}
            </Button>
          ) : null}
        </div>
      ) : null}

      {open ? (
        <div className="explain-this-card" role="region" aria-label="Explain this">
          <div className="explain-this-card-head">
            <div className="explain-this-title">{panel.title}</div>
            <Button
              type="button"
              className="explain-this-btn"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
          </div>
          {busy ? <p className="flow-muted">Writing the explanation…</p> : null}
          {error ? <p className="flow-error">{error}</p> : null}
          {!busy ? (
            <div className="explain-this-body">
              {panel.sections.map(section => (
                <p key={section.label} className="explain-this-section">
                  <span className="explain-this-label">{section.label}:</span> {section.body}
                </p>
              ))}
              <p className="explain-this-based">{panel.basedOn}</p>
            </div>
          ) : null}
          <div className="explain-this-actions">
            <Button
              type="button"
              className="explain-this-action"
              disabled={!projectId || busy}
              onClick={() => goChat(panel.reportNotePrompt)}
            >
              Add to report as a note
            </Button>
            <Button
              type="button"
              className="explain-this-action"
              disabled={!projectId || busy}
              onClick={() => goChat(panel.chatPrompt)}
            >
              Ask a follow-up in chat
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
