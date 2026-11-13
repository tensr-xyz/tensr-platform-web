'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { flowJson } from '@/lib/flow-api';

type Brief = {
  audience?: string;
  question?: string;
  weight?: string;
};

/** The two study questions, saved once and shown on the report. */
export function StudyBrief({ projectId }: { projectId: string }) {
  const [audience, setAudience] = useState('');
  const [question, setQuestion] = useState('');
  const [weight, setWeight] = useState('');
  const [status, setStatus] = useState('');
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirtyRef = useRef(false);

  useEffect(() => {
    let live = true;
    dirtyRef.current = false;
    void flowJson<{ brief?: Brief | null }>(`/api/projects/${projectId}/study-brief`)
      .then(body => {
        if (!live || dirtyRef.current) return;
        const brief = body.brief;
        setAudience(brief?.audience || '');
        setQuestion(brief?.question || '');
        setWeight(brief?.weight || '');
        setLoaded(true);
      })
      .catch(() => {
        if (!live) return;
        setFailed(true);
        setStatus('Could not load the brief.');
      });
    return () => {
      live = false;
    };
  }, [projectId]);

  function edit(setter: (value: string) => void, value: string) {
    dirtyRef.current = true;
    setter(value);
  }

  async function save() {
    if (!loaded || saving) return;
    setSaving(true);
    setFailed(false);
    setStatus('Saving…');
    try {
      await flowJson(`/api/projects/${projectId}/study-brief`, {
        method: 'PUT',
        body: JSON.stringify({ audience, question, weight }),
      });
      dirtyRef.current = false;
      setStatus('Saved');
    } catch {
      setFailed(true);
      setStatus('Could not save the brief.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="report-block" aria-label="Study brief">
      <div className="report-head">
        <div>
          <h2>Study brief</h2>
          <p className="flow-muted">Saved once and read by later analysis</p>
        </div>
        <Button
          className="flow-btn"
          type="button"
          disabled={!loaded || saving}
          onClick={() => void save()}
        >
          Save brief
        </Button>
      </div>
      <label className="flow-field">
        Who was surveyed, and are there targets?
        <Textarea
          value={audience}
          onChange={event => edit(setAudience, event.target.value)}
          rows={2}
        />
      </label>
      <label className="flow-field">
        What should the study answer?
        <Textarea
          value={question}
          onChange={event => edit(setQuestion, event.target.value)}
          rows={2}
        />
      </label>
      <label className="flow-field">
        Weight
        <Input value={weight} onChange={event => edit(setWeight, event.target.value)} />
      </label>
      {status ? (
        <p className={failed ? 'flow-error' : 'flow-muted'} role={failed ? 'alert' : 'status'}>
          {status}
        </p>
      ) : null}
    </section>
  );
}
