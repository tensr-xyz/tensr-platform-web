import { redirect } from 'next/navigation';
import { flowSettingsPath } from '@/lib/settings-redirect';

export default async function GeneralSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirect(flowSettingsPath('general', await searchParams));
}
