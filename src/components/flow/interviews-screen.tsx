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
          <span className="flow-muted">Interviews</span>
          <span className="flow-muted">{rows.length}</span>
        </div>
        {filtered.length ? (
          filtered.map(row => (
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
              <span>
                <span className="interviews-item-name">{row.filename || 'Transcript'}</span>
                <span className="flow-muted">
                  {(row.codes || [])
                    .map(item => item.code)
                    .filter(Boolean)
                    .slice(0, 3)
                    .join(' · ') || `${row.passage_count || 0} passages`}
                </span>
              </span>
              <span className="flow-muted">{row.passage_count || 0}</span>
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
          <span className="flow-muted">.txt .vtt .docx. Audio is coming soon.</span>
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
          <Link href={`/flow/p/${projectId}/sources`}>← Sources</Link>
          <Button
            className="flow-btn"
            type="button"
            data-active={showCodes}
            onClick={() => setShowCodes(current => !current)}
          >
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
          {active?.start ? (
            <span className="flow-muted interviews-time">{active.start}</span>
          ) : null}
        </div>
        {selected ? (
          <div className="interviews-read">
            <h1 className="interviews-title">{selected.filename || 'Transcript'}</h1>
            <p className="flow-muted">
              {selected.passage_count || 0}{' '}
              {(selected.passage_count || 0) === 1 ? 'passage' : 'passages'}. Counts only. These are
              not a share of the survey.
            </p>
            {passages === null ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              shown.map(item => {
                const codes = passageCodes(selected.codes, item.passage_id);
                return (
                  <Button
                    key={item.passage_id}
                    className="interviews-passage"
                    type="button"
                    data-active={item.passage_id === active?.passage_id}
                    onClick={() => setPassageId(item.passage_id)}
                  >
                    <span className="interviews-stamp">{item.start || ''}</span>
                    <span>
                      <span className="flow-muted">{item.speaker || 'Speaker'}</span>
                      <span>{item.text || 'Passage text is not stored on this index.'}</span>
                      {showCodes && codes.length ? (
                        <span className="interviews-codes">
                          {codes.map(itemCode => (
                            <Badge key={itemCode} tone="active">
                              {itemCode}
                            </Badge>
                          ))}
                        </span>
                      ) : null}
                    </span>
                  </Button>
                );
              })
            )}
          </div>
        ) : (
          <p className="flow-muted interviews-empty">Upload a transcript to read it here.</p>
        )}
        <div className="interviews-foot">
          <span className="flow-muted">{countLabel || `${rows.length} interviews`}</span>
          <span className="flow-muted">
            {active?.start ? `Passage ${active.start} selected` : 'Counts only'}
          </span>
        </div>
      </div>
      <aside className="interviews-side">
        <div className="interviews-side-tabs">
          <span className="flow-muted">Evidence</span>
          <Badge tone="soon">Audio coming soon</Badge>
        </div>
        {active ? (
          <>
            <p className="flow-muted">
              {active.speaker || 'Speaker'}
              {active.start ? ` · ${active.start}` : ''}
              {active.end ? `–${active.end}` : ''}
            </p>
            <p>{active.text}</p>
            {showCodes && activeCodes.length ? (
              <div className="interviews-codes">
                {activeCodes.map(item => (
                  <Badge key={item} tone="active">
                    {item}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="flow-muted">This passage has no code.</p>
            )}
            <p className="flow-muted">
              Interviews are a count. They are not added to survey percentages.
            </p>
            <Input
              value={code}
              onChange={event => setCode(event.target.value)}
              aria-label="Code"
              placeholder="Code this passage"
            />
            <div className="interviews-side-actions">
              <Button className="flow-btn" type="button" onClick={saveCode}>
                Recode
              </Button>
              <Link className="sources-ink" href={`/flow/p/${projectId}/report`}>
                Cite in report
              </Link>
            </div>
          </>
        ) : (
          <p className="flow-muted">Select a passage.</p>
        )}
        {error ? <p className="flow-error">{error}</p> : null}
      </aside>
    </section>
  );
}
