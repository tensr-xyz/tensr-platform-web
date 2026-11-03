import { redirect } from 'next/navigation';

/** New projects start from the dialog in the app. */
export default function NewProjectPage() {
  redirect('/flow?new=1');
}
