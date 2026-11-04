'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { flowJson } from '@/lib/flow-api';

type Target =
  | { kind: 'project'; id: string }
  | { kind: 'dataset'; id: string; run?: string | null };

/** Where an old workspace link lands in the new app. */
export async function legacyTarget(target: Target): Promise<string> {
  if (target.kind === 'project') {
    const page = await flowJson<{ project?: { id?: string } }>(`/api/projects/${target.id}`).catch(
      () => null
    );
    return page?.project?.id ? `/flow/p/${page.project.id}/chat` : '/flow';
  }
  const rows = await flowJson<
    | { dataset_id?: string; project_id?: string }[]
    | { datasets?: { dataset_id?: string; project_id?: string }[] }
  >('/datasets/?scope=all').catch(() => []);
  const list = Array.isArray(rows) ? rows : rows.datasets || [];
  const row = list.find(item => item.dataset_id === target.id);
  if (!row?.project_id) return '/flow/datasets';
  await flowJson(`/api/projects/${row.project_id}`, {
    method: 'PATCH',
    body: JSON.stringify({ active_dataset_id: target.id }),
  }).catch(() => undefined);
  return target.run
    ? `/flow/p/${row.project_id}/report?pane=outputs&run=${encodeURIComponent(target.run)}`
    : `/flow/p/${row.project_id}/responses`;
}

export function LegacyRedirect({ target }: { target: Target }) {
  const router = useRouter();
  const key = JSON.stringify(target);
  useEffect(() => {
    let live = true;
    void legacyTarget(JSON.parse(key) as Target).then(path => {
      if (live) router.replace(path);
    });
    return () => {
      live = false;
    };
  }, [key, router]);
  return null;
}
