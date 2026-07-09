import { redirect } from 'next/navigation';

/** App-only entry: marketing lives on www.tensr.xyz (tensr-landing-ui). */
export default function RootPage() {
  redirect('/dashboard');
}
