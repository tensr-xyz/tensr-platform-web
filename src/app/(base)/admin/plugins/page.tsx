import { redirect } from 'next/navigation';

/** Prefer the plugins-area review page. */
export default function AdminPluginsPage() {
  redirect('/plugins/review');
}
