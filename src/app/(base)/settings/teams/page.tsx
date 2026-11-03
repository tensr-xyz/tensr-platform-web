import { redirect } from 'next/navigation';
import { flowSettingsPath } from '@/lib/settings-redirect';

export default async function TeamsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirect(flowSettingsPath('teams', await searchParams));
}
