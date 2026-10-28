'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SubscriptionGate } from '@/components/templates/subscription-gate';
import {
  StudyShell,
  type StudyDataset,
  type StudyProject,
} from '@/components/templates/study/shell';
import { getStytchBearerForTensrApi, getTensrApiHeaders } from '@/utils/auth';
import { tensrApiUrl } from '@/lib/tensr-api-url';

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

  useEffect(() => {
    const token = getStytchBearerForTensrApi();
    fetch(tensrApiUrl(`/api/projects/${projectId}`), {
      headers: { ...getTensrApiHeaders(), Authorization: token ? `Bearer ${token}` : '' },
    })
      .then(async response => {
        if (!response.ok) throw new Error(await response.text());
        return response.json();
      })
      .then(body => {
        setProject(body.project);
        setDatasets(
          (body.datasets || []).map(
            (row: { id: string; original_filename?: string; n_rows?: number }) => ({
              id: row.id,
              original_filename: row.original_filename,
              n_rows: row.n_rows,
            })
          )
        );
      })
      .catch(err => setError(err.message));
  }, [projectId]);

  if (error) return <p className="p-8 text-sm text-destructive">{error}</p>;
  if (!project) return <p className="p-8 text-sm text-muted-foreground">Loading study…</p>;
  return (
    <StudyShell project={project} datasets={datasets} onBack={() => router.push('/studies')} />
  );
}
