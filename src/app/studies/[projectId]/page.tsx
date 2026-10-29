'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SubscriptionGate } from '@/components/templates/subscription-gate';
import {
  StudyShell,
  type StudyDataset,
  type StudyProject,
} from '@/components/templates/study/shell';
import { fetchStudy } from '@/lib/study-session';

export default function StudyPage() {
  return (
    <SubscriptionGate>
      <StudyLoader />
    </SubscriptionGate>
  );
}

function StudyLoader() {
  const params = useParams();
  const router = useRouter();
  const projectId = String(params.projectId || '');
  const [project, setProject] = useState<StudyProject | null>(null);
  const [datasets, setDatasets] = useState<StudyDataset[]>([]);
  const [error, setError] = useState('');

  function applyBody(body: {
    project: StudyProject;
    datasets?: {
      id: string;
      original_filename?: string;
      n_rows?: number;
      lineage_label?: string | null;
      updated_at?: string | null;
    }[];
  }) {
    setProject(body.project);
    setDatasets(
      (body.datasets || []).map(row => ({
        id: row.id,
        original_filename: row.original_filename,
        n_rows: row.n_rows,
        lineage_label: row.lineage_label,
        updated_at: row.updated_at,
      }))
    );
  }

  useEffect(() => {
    let cancelled = false;
    fetchStudy(`/api/projects/${projectId}`)
      .then(async response => {
        if (!response.ok) throw new Error(await response.text());
        return response.json();
      })
      .then(body => {
        if (!cancelled) applyBody(body);
      })
      .catch(err => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (error) return <p className="p-8 text-sm text-destructive">{error}</p>;
  if (!project) return <p className="p-8 text-sm text-muted-foreground">Loading study…</p>;
  return (
    <StudyShell
      project={project}
      datasets={datasets}
      onBack={() => router.push('/studies')}
      onAdopted={dataset => {
        setDatasets(current =>
          current.some(row => row.id === dataset.id)
            ? current.map(row => (row.id === dataset.id ? { ...row, ...dataset } : row))
            : [...current, dataset]
        );
        setProject(current => (current ? { ...current, active_dataset_id: dataset.id } : current));
      }}
    />
  );
}
