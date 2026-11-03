'use client';

import { useParams } from 'next/navigation';
import { LegacyRedirect } from '@/components/flow/legacy-redirect';

/** Old workspace project links open the project in the app. */
export default function ProjectWorkspaceRedirect() {
  const params = useParams<{ projectId: string }>();
  return <LegacyRedirect target={{ kind: 'project', id: String(params.projectId || '') }} />;
}
