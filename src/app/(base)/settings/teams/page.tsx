import { redirect } from 'next/navigation';

// The old Teams screen called /api/teams, which the API maps onto whole organisations
// (deleting a "team" deleted the organisation and its datasets).
export default function TeamsPage() {
  redirect('/settings/members');
}
