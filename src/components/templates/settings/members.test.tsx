import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import TeamMembers from './members';
import { mapApiInvitation } from '@/lib/organization-invitations';

const toast = jest.fn();
const createInvitation = jest.fn();
const listInvitations = jest.fn();
const resendInvitation = jest.fn();
const deleteInvitation = jest.fn();
const fetchMembers = jest.fn();
let invitations: ReturnType<typeof mapApiInvitation>[] = [];

jest.mock('posthog-js', () => ({ capture: jest.fn() }));
jest.mock('@/hooks/ui/use-toast', () => ({ toast: (...a: unknown[]) => toast(...a) }));
jest.mock('@/hooks/api/use-organisation', () => ({
  useOrganization: () => ({
    activeOrganization: { id: 'org-1', name: 'Prolific' },
    members: [],
    seatUsage: null,
    fetchMembers,
    createInvitation,
    removeMember: jest.fn(),
    updateMemberRole: jest.fn(),
    invitations,
    listInvitations,
    resendInvitation,
    deleteInvitation,
  }),
}));

const future = new Date(Date.now() + 5 * 86_400_000).toISOString();

function invitation(overrides: Record<string, unknown>) {
  return mapApiInvitation({
    id: 'inv-1',
    organization_id: 'org-1',
    email: 'ada@example.com',
    role: 'member',
    status: 'PENDING',
    token: 'tok-1',
    expires_at: future,
    created_at: future,
    updated_at: future,
    ...overrides,
  });
}

describe('TeamMembers pending invitations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invitations = [];
  });

  it('loads invitations and shows the real email status for each one', () => {
    invitations = [
      invitation({ id: 'a', token: 'a', email: 'sent@example.com', email_status: 'sent' }),
      invitation({
        id: 'b',
        token: 'b',
        email: 'failed@example.com',
        email_status: 'failed',
        email_error: 'Email address is not verified',
      }),
      invitation({ id: 'c', token: 'c', email: 'legacy@example.com' }),
    ];
    render(<TeamMembers />);

    expect(listInvitations).toHaveBeenCalledWith('org-1');
    const table = screen.getByRole('region', { name: /pending invitations/i });
    const row = (email: string) => within(table).getByText(email).closest('tr') as HTMLElement;
    expect(within(row('sent@example.com')).getByText('Email sent')).toBeInTheDocument();
    expect(within(row('failed@example.com')).getByText('Email failed')).toBeInTheDocument();
    expect(
      within(row('failed@example.com')).getByText('Email address is not verified')
    ).toBeInTheDocument();
    expect(within(row('legacy@example.com')).getByText('No email on record')).toBeInTheDocument();
  });

  it('hides accepted and cancelled invitations', () => {
    invitations = [
      invitation({ status: 'ACCEPTED' }),
      invitation({ id: 'x', status: 'CANCELLED' }),
    ];
    render(<TeamMembers />);
    expect(screen.queryByRole('region', { name: /pending invitations/i })).not.toBeInTheDocument();
  });

  it('resends and reports a failed send as a failure', async () => {
    invitations = [invitation({ email_status: 'failed', email_error: 'Throttling' })];
    resendInvitation.mockResolvedValue(
      invitation({ email_status: 'failed', email_error: 'Still throttled' })
    );
    render(<TeamMembers />);

    fireEvent.click(screen.getByRole('button', { name: /resend invitation to ada@example.com/i }));

    await waitFor(() => expect(resendInvitation).toHaveBeenCalledWith('org-1', 'tok-1'));
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Email not sent',
        description: 'Still throttled',
        variant: 'destructive',
      })
    );
  });

  it('disables resend for an expired invitation', () => {
    invitations = [invitation({ expires_at: '2020-01-01T00:00:00+00:00' })];
    render(<TeamMembers />);
    expect(
      screen.getByRole('button', { name: /resend invitation to ada@example.com/i })
    ).toBeDisabled();
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('does not say "emailed" after adding someone when the email failed', async () => {
    createInvitation.mockResolvedValue(
      invitation({ email: 'new@example.com', email_status: 'failed', email_error: 'Sandbox' })
    );
    render(<TeamMembers />);

    fireEvent.click(screen.getByRole('button', { name: /add member/i }));
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'new@example.com' },
    });
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /add member/i }));

    await waitFor(() => expect(createInvitation).toHaveBeenCalled());
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Invitation saved, but not emailed',
          variant: 'destructive',
        })
      )
    );
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Invitation sent' }));
  });
});
