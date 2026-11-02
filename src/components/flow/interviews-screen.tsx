'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChoiceSelect } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/rest';
import { flowFetch, flowJson } from '@/lib/flow-api';

type PassageIndex = {
  passage_id: string;
  speaker?: string;
  start?: string | null;
  end?: string | null;
};

type InterviewCode = { passage_id?: string; code?: string };

export type InterviewRow = {
  id: string;
  filename?: string;
  passage_count?: number;
  passages_index?: PassageIndex[];
  codes?: InterviewCode[];
  updated_at?: string;
};

type Passage = PassageIndex & { text?: string };

export function passageCodes(codes: InterviewCode[] | undefined, passageId: string): string[] {
  return (codes || [])
    .filter(row => row.passage_id === passageId && row.code)
    .map(row => String(row.code));
}

export function InterviewsScreen({ projectId }: { projectId: string }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<InterviewRow[] | null>(null);
  const [themes, setThemes] = useState<string[]>([]);
  const [countLabel, setCountLabel] = useState('');
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [passages, setPassages] = useState<Passage[] | null>(null);
  const [passageId, setPassageId] = useState('');
  const [speaker, setSpeaker] = useState('');
  const [showCodes, setShowCodes] = useState(true);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = (nextTheme = theme) => {
    const search = nextTheme ? `?theme=${encodeURIComponent(nextTheme)}` : '';
    void flowJson<{
      interviews?: InterviewRow[];
      themes?: string[];
      count_label?: string;
    }>(`/api/projects/${projectId}/interviews${search}`)
      .then(page => {
        const interviews = page.interviews || [];
        setRows(interviews);
        setThemes(page.themes || []);
        setCountLabel(page.count_label || '');
        setSelectedId(current =>
          interviews.some(row => row.id === current) ? current : interviews[0]?.id || ''
        );
      })
      .catch(err => {
        setRows([]);
        setError(err instanceof Error ? err.message : 'Could not load interviews');
      });
  };

  useEffect(() => {
    load(theme);
    // Reload when the theme filter changes. load closes over projectId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, theme]);

  const selected = (rows || []).find(row => row.id === selectedId);

  useEffect(() => {
    if (!selected) {
      setPassages([]);
      return;
    }
    const index = selected.passages_index || [];
    if (!index.length) {
      setPassages([]);
      return;
    }
    let cancelled = false;
    setPassages(null);
    void Promise.all(
      index.map(item =>
        flowJson<{ passage?: Passage }>(
          `/api/projects/${projectId}/interviews/${selected.id}/passages/${item.passage_id}`
        )
          .then(page => page.passage || item)
          .catch(() => item)
      )
    ).then(loaded => {
      if (!cancelled) setPassages(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, selected]);

  const speakers = Array.from(
    new Set((passages || []).map(item => item.speaker).filter((item): item is string => !!item))
  );
  const shown = (passages || []).filter(item => !speaker || item.speaker === speaker);
  const active = shown.find(item => item.passage_id === passageId) || shown[0];
  const activeCodes = active ? passageCodes(selected?.codes, active.passage_id) : [];
  const filtered = (rows || []).filter(row =>
    (row.filename || '').toLowerCase().includes(query.trim().toLowerCase())
  );

  const upload = (file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.txt') && !name.endsWith('.vtt') && !name.endsWith('.docx')) {
      setError('Upload a .txt, .vtt, or .docx transcript. Audio is coming soon.');
      return;
    }
    const body = new FormData();
    body.append('upload', file);
    setUploading(true);
    setError(null);
    void flowFetch(`/api/projects/${projectId}/interviews`, { method: 'POST', body })
      .then(async response => {
        if (!response.ok) throw new Error(await response.text());
        load();
      })
      .catch(err => setError(err instanceof Error ? err.message : 'The transcript did not upload.'))
      .finally(() => setUploading(false));
  };

  const saveCode = () => {
    if (!selected || !active || !code.trim()) return;
    void flowJson(`/api/projects/${projectId}/interviews/${selected.id}/codes`, {
      method: 'POST',
      body: JSON.stringify({ passage_id: active.passage_id, code: code.trim() }),
    })
      .then(() => {
        setCode('');
        load();
      })
      .catch(err => setError(err instanceof Error ? err.message : 'The code did not save.'));
  };

  if (rows === null) {
    return (
      <section className="interviews-page">
        <Skeleton className="h-full w-60" />
        <Skeleton className="h-full flex-1" />
        <Skeleton className="h-full w-80" />
      </section>
    );
  }

  const selectedIndex = filtered.findIndex(row => row.id === selectedId);
  const totalPassages = rows.reduce((sum, row) => sum + (row.passage_count || 0), 0);
  const twoDigits = (value: number) => String(value).padStart(2, '0');
  const uploaded = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? ''
      : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };
  const codedHere = (codeName: string) =>
    (passages || []).filter(item =>
      passageCodes(selected?.codes, item.passage_id).includes(codeName)
    ).length;

  return (
    <section className="interviews-page">
      <aside className="interviews-rail">
        <Input
          value={query}
          onChange={event => setQuery(event.target.value)}
          aria-label="Search interviews"
          placeholder={rows.length ? `Search ${rows.length} interviews` : 'Search interviews'}
        />
        <div className="interviews-rail-head">
          <span className="flow-muted">Depth interviews</span>
          <span className="flow-muted">{rows.length}</span>
        </div>
        {filtered.length ? (
          filtered.map((row, index) => (
            <Button
              key={row.id}
              className="interviews-item"
              type="button"
              data-active={row.id === selectedId}
              onClick={() => {
                setSelectedId(row.id);
                setPassageId('');
                setSpeaker('');
              }}
            >
              <span className="interviews-item-top">
                <span className="interviews-item-name">
                  {twoDigits(index + 1)} · {(row.filename || 'Transcript').replace(/\.[^.]+$/, '')}
                </span>
                <span className="flow-muted">{row.passage_count || 0}p</span>
              </span>
              <span className="interviews-item-codes">
                {(row.codes || [])
                  .map(item => item.code)
                  .filter(Boolean)
                  .slice(0, 3)
                  .join(' · ') || `${row.passage_count || 0} passages`}
              </span>
            </Button>
          ))
        ) : (
          <p className="flow-muted">No transcripts yet.</p>
        )}
        <Button
          className="interviews-add"
          type="button"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
        >
          <span>{uploading ? 'Uploading…' : '+ Add transcripts'}</span>
          <span className="flow-muted">.docx .txt .vtt. Audio is coming soon.</span>
        </Button>
        <Input
          ref={fileInput}
          className="sources-file-input"
          type="file"
          accept=".txt,.vtt,.docx"
          aria-label="Upload transcript"
          onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) upload(file);
          }}
        />
        {themes.length ? (
          <ChoiceSelect
            aria-label="Theme"
            value={theme}
            onValueChange={setTheme}
            options={[
              { value: '', label: 'All themes' },
              ...themes.map(item => ({ value: item, label: item })),
            ]}
          />
        ) : null}
      </aside>
      <div className="interviews-main">
        <div className="interviews-toolbar">
          <Link className="interviews-back" href={`/flow/p/${projectId}/sources`}>
            ← Sources
          </Link>
          <Button
            className="interviews-chip"
            type="button"
            data-active={showCodes}
            onClick={() => setShowCodes(current => !current)}
          >
            <i />
            {showCodes ? 'Codes shown' : 'Codes hidden'}
          </Button>
          {speakers.length > 1 ? (
            <ChoiceSelect
              aria-label="Speaker"
              value={speaker}
              onValueChange={setSpeaker}
              options={[
                { value: '', label: 'All speakers' },
                ...speakers.map(item => ({ value: item, label: `Only ${item}` })),
              ]}
            />
          ) : null}
          <span className="interviews-player" title="Audio playback is coming soon">
            ▶ {active?.start || '0:00'} / audio soon
          </span>
        </div>
        {selected ? (
          <div className="interviews-read">
            <p className="interviews-eyebrow">
              Depth interview {twoDigits(selectedIndex + 1)} of {twoDigits(rows.length)}
              {uploaded(selected.updated_at) ? ` · ${uploaded(selected.updated_at)}` : ''} ·
              transcript
            </p>
            <h1 className="interviews-title">
              {(selected.filename || 'Transcript').replace(/\.[^.]+$/, '')}
            </h1>
            <div className="interviews-tags">
              <span>
                {selected.passage_count || 0}{' '}
                {(selected.passage_count || 0) === 1 ? 'passage' : 'passages'}
              </span>
              <span>Counts only, not a survey share</span>
            </div>
            {passages === null ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              shown.map(item => {
                const codes = passageCodes(selected.codes, item.passage_id);
                const coded = showCodes && codes.length > 0;
                return (
                  <Button
                    key={item.passage_id}
                    className="interviews-passage"
                    type="button"
                    data-active={item.passage_id === active?.passage_id}
                    data-coded={coded || undefined}
                    onClick={() => setPassageId(item.passage_id)}
                  >
                    <span className="interviews-stamp">{item.start || '—'}</span>
                    <span className="interviews-passage-body">
                      <span className="interviews-speaker">{item.speaker || 'Speaker'}</span>
                      <span className="interviews-quote">
                        <span>{item.text || 'Passage text is not stored on this index.'}</span>
                        {coded ? (
                          <span className="interviews-codes">
                            {codes.map(itemCode => (
                              <span key={itemCode} className="interviews-code">
                                {itemCode}
                              </span>
                            ))}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </Button>
                );
              })
            )}
            <div className="interviews-summary" data-soon>
              <span className="interviews-summary-label">
                <i /> Agent summary of this interview
              </span>
              <p>Interview summaries are coming soon.</p>
            </div>
          </div>
        ) : (
          <p className="flow-muted interviews-empty">Upload a transcript to read it here.</p>
        )}
        <div className="interviews-foot">
          <span>{countLabel || `${rows.length} interviews`}</span>
          <span>{totalPassages} passages</span>
          <span>
            {active
              ? `Passage ${active.start ? `${active.start} ` : ''}selected`
              : 'No passage selected'}
          </span>
          <span className="interviews-foot-right">Counts only</span>
        </div>
      </div>
      <aside className="interviews-side">
        <div className="interviews-side-tabs">
          <span>Agent</span>
          <span>Variable</span>
          <span data-active>Evidence</span>
        </div>
        <div className="interviews-side-body">
          {active ? (
            <>
              <div className="interviews-side-block">
                <span className="flow-muted">
                  Selected passage{activeCodes[0] ? ` · ${activeCodes[0]}` : ''}
                </span>
                <div className="interviews-big">
                  <strong>{activeCodes[0] ? codedHere(activeCodes[0]) : 0}</strong>
                  <span>
                    {activeCodes[0]
                      ? `passage${codedHere(activeCodes[0]) === 1 ? '' : 's'} in this interview have this code`
                      : 'This passage has no code yet'}
                  </span>
                </div>
                <p className="interviews-note">
                  Interviews are a count. They are not added to survey percentages.
                </p>
              </div>
              <div className="interviews-side-block">
                <span className="flow-muted">This passage</span>
                <dl className="interviews-kv">
                  <dt>Time</dt>
                  <dd>
                    {active.start || '—'}
                    {active.end ? ` – ${active.end}` : ''}
                  </dd>
                  <dt>Speaker</dt>
                  <dd>{active.speaker || '—'}</dd>
                  <dt>Codes</dt>
                  <dd>{activeCodes.join(', ') || 'None'}</dd>
                </dl>
              </div>
              <div className="interviews-side-block">
                <span className="flow-muted">Code this passage</span>
                <Input
                  value={code}
                  onChange={event => setCode(event.target.value)}
                  aria-label="Code"
                  placeholder="Theme name"
                />
              </div>
            </>
          ) : (
            <p className="flow-muted">Select a passage.</p>
          )}
          {error ? <p className="flow-error">{error}</p> : null}
        </div>
        <div className="interviews-side-actions">
          <Button className="flow-btn" type="button" onClick={saveCode} disabled={!active}>
            Recode
          </Button>
          <Button className="flow-btn" type="button" disabled title="Clips are coming soon">
            Play clip
          </Button>
          <Link className="flow-btn primary" href={`/flow/p/${projectId}/report`}>
            Cite in report
          </Link>
        </div>
      </aside>
    </section>
  );
}
