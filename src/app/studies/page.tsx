'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SubscriptionGate } from '@/components/templates/subscription-gate';
import { Button } from '@/components/atoms/button';
import { getStytchBearerForTensrApi, getTensrApiHeaders } from '@/utils/auth';
import { tensrApiUrl } from '@/lib/tensr-api-url';
import { fetchStudyJson, studiesWithDatasets, studyRowText } from '@/lib/study-session';

type ProjectRow = {
  id: string;
  name: string;
  status?: string;
  updated_at?: string;
  dataset_count?: number;
};

export default function StudiesPage() {
  return (
    <SubscriptionGate>
      <StudiesList />
    </SubscriptionGate>
  );
}

function StudiesList() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [cursor, setCursor] = useState('');
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);

  function load(nextCursor = '') {
    const params = new URLSearchParams({ limit: '50' });
    if (nextCursor) params.set('cursor', nextCursor);
    return fetchStudyJson<{ projects?: ProjectRow[]; next_cursor?: string }>(
      `/api/projects?${params}`
    )
      .then(body => {
        const page = studiesWithDatasets(body.projects || []);
        setProjects(current => (nextCursor ? [...current, ...page] : page));
        setCursor(String(body.next_cursor || ''));
      })
      .catch(err => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ limit: '50' });
    fetchStudyJson<{ projects?: ProjectRow[]; next_cursor?: string }>(`/api/projects?${params}`)
      .then(body => {
        if (cancelled) return;
        setProjects(studiesWithDatasets(body.projects || []));
        setCursor(String(body.next_cursor || ''));
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 font-sans">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-medium tracking-tight">Studies</h1>
        <Button type="button" variant="outline" onClick={() => router.push('/dashboard')}>
          Datasets
        </Button>
      </div>
      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
      <ul className="divide-y divide-border rounded-xl border border-border">
        {projects.map(project => (
          <li key={project.id}>
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left"
              onClick={() => router.push(`/studies/${project.id}`)}
            >
              <span>{studyRowText(project)}</span>
              <span className="text-xs text-muted-foreground">{project.status || 'active'}</span>
            </button>
          </li>
        ))}
        {loading ? (
          <li className="px-4 py-6 text-sm text-muted-foreground">Loading studies…</li>
        ) : null}
        {!loading && !projects.length ? (
          <li className="px-4 py-6 text-sm text-muted-foreground">No studies yet.</li>
        ) : null}
      </ul>
      {cursor ? (
        <Button type="button" variant="outline" className="mt-3" onClick={() => load(cursor)}>
          Load more
        </Button>
      ) : null}
      <form
        className="mt-4 flex gap-2"
        onSubmit={event => {
          event.preventDefault();
          const token = getStytchBearerForTensrApi();
          fetch(tensrApiUrl('/api/projects'), {
            method: 'POST',
            headers: {
              ...getTensrApiHeaders(),
              Authorization: token ? `Bearer ${token}` : '',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name }),
          })
            .then(response => response.json())
            .then(body => {
              if (body.project?.id) router.push(`/studies/${body.project.id}`);
            })
            .catch(err => setError(err.message));
        }}
      >
        <input
          className="flex-1 rounded-md border border-border bg-background px-3 py-2"
          placeholder="New study"
          value={name}
          onChange={event => setName(event.target.value)}
        />
        <Button type="submit">Create</Button>
      </form>
    </div>
  );
}
