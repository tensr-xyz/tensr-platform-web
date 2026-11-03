import { redirect } from 'next/navigation';

/** Plugin pages live in the app now. */
export default async function LegacyPluginDetail({
  params,
}: {
  params: Promise<{ pluginId: string }>;
}) {
  const { pluginId } = await params;
  redirect(`/flow/plugins/${encodeURIComponent(pluginId)}`);
}
