import { redirect } from 'next/navigation';

/** This page lives in the app now. */
export default function LegacyPluginPage() {
  redirect('/flow/plugins/mine');
}
