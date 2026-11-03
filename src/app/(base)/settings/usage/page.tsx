import { redirect } from 'next/navigation';
import { flowSettingsPath } from '@/lib/settings-redirect';

export default async function UsageSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirect(flowSettingsPath('usage', await searchParams));
}
