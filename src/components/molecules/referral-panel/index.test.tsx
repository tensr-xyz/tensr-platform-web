import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import posthog from 'posthog-js';

import type { ReferralPanelData } from '@/lib/referral';
import { ReferButton, ReferralPanelBody } from './index';

jest.mock('posthog-js', () => ({ capture: jest.fn() }));

function panel(overrides: Partial<ReferralPanelData> = {}): ReferralPanelData {
  return {
    enabled: true,
    code: 'TENSR-ABC1234567',
    link_path: '/login?ref=TENSR-ABC1234567',
    reward: {
      referrer_months: 1,
      referee_months: 1,
      cap_months: 6,
      cap_window_days: 365,
      reversal_window_days: 30,
      attribution_window_days: 30,
      excluded_plans: ['teams'],
    },
    referrals: [],
    months_earned: 0,
    referred_by: null,
    ...overrides,
  };
}

describe('ReferButton', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens a panel with the personal link, reward copy and a working copy button', async () => {
    const copyText = jest.fn().mockResolvedValue(undefined);
    render(
      <ReferButton
        loadPanel={() => Promise.resolve(panel())}
        copyText={copyText}
        origin="https://app.tensr.test"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /refer/i }));

    const input = await screen.findByLabelText('Your referral link');
    expect(input).toHaveValue('https://app.tensr.test/login?ref=TENSR-ABC1234567');
    expect(
      screen.getByText(/You both get 1 month free once they make their first payment/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Refunds within 30 days reverse it/)).toBeInTheDocument();
    expect(screen.getByText(/teams plans are excluded/)).toBeInTheDocument();
    expect(screen.getByText('No referrals yet.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copy referral link' }));
    await waitFor(() =>
      expect(copyText).toHaveBeenCalledWith('https://app.tensr.test/login?ref=TENSR-ABC1234567')
    );
    expect(await screen.findByText('Copied')).toBeInTheDocument();
    expect(posthog.capture).toHaveBeenCalledWith('referral_link_copied', {
      surface: 'header_panel',
    });
  });
});

describe('ReferralPanelBody', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the loader while referral details are still loading', () => {
    render(<ReferralPanelBody loadPanel={() => new Promise(() => undefined)} />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });

  it('lists referrals with their status and months earned', async () => {
    const data = panel({
      months_earned: 1,
      referrals: [
        {
          id: 'r1',
          referee: 'bo***@other.com',
          status: 'reward_granted',
          signed_up_at: null,
          paid_at: null,
          reward_status: 'granted',
          reward_months: 1,
          reward_granted_at: null,
        },
        {
          id: 'r2',
          referee: 'ca***@third.com',
          status: 'trialling',
          signed_up_at: null,
          paid_at: null,
          reward_status: null,
          reward_months: 0,
          reward_granted_at: null,
        },
        {
          id: 'r3',
          referee: 'da***@fourth.com',
          status: 'signed_up',
          signed_up_at: null,
          paid_at: null,
          reward_status: null,
          reward_months: 0,
          reward_granted_at: null,
        },
        {
          id: 'r4',
          referee: 'ed***@fifth.com',
          status: 'paid',
          signed_up_at: null,
          paid_at: null,
          reward_status: 'pending',
          reward_months: 1,
          reward_granted_at: null,
        },
      ],
    });
    render(<ReferralPanelBody loadPanel={() => Promise.resolve(data)} origin="https://x.test" />);

    const list = await screen.findByRole('list', { name: 'Referrals' });
    expect(list).toHaveTextContent('bo***@other.com');
    expect(list).toHaveTextContent('Reward granted');
    expect(list).toHaveTextContent('Trialling');
    expect(list).toHaveTextContent('Signed up');
    expect(list).toHaveTextContent('Paid');
    expect(screen.getByText(/1 month earned/)).toBeInTheDocument();
  });

  it('shows the referee their own reward once granted', async () => {
    const data = panel({
      referred_by: {
        status: 'reward_granted',
        reward_status: 'granted',
        reward_months: 1,
        reward_granted_at: null,
      },
    });
    render(<ReferralPanelBody loadPanel={() => Promise.resolve(data)} origin="https://x.test" />);
    expect(await screen.findByTestId('referral-referred-by')).toHaveTextContent(
      'Your reward: 1 month free, credited to your next invoice.'
    );
  });

  it('tells a referee who has not paid yet when their reward arrives', async () => {
    const data = panel({
      referred_by: {
        status: 'trialling',
        reward_status: null,
        reward_months: 0,
        reward_granted_at: null,
      },
    });
    render(<ReferralPanelBody loadPanel={() => Promise.resolve(data)} origin="https://x.test" />);
    expect(await screen.findByTestId('referral-referred-by')).toHaveTextContent(
      /after your first payment/
    );
  });

  it('describes unequal rewards from config', async () => {
    const data = panel({
      reward: { ...panel().reward, referrer_months: 2, referee_months: 1, excluded_plans: [] },
    });
    render(<ReferralPanelBody loadPanel={() => Promise.resolve(data)} origin="https://x.test" />);
    expect(
      await screen.findByText(/You get 2 months free, they get 1 month free/)
    ).toBeInTheDocument();
  });

  it('shows an error when the panel cannot load', async () => {
    render(
      <ReferralPanelBody
        loadPanel={() => Promise.reject(new Error('Referral details are unavailable right now.'))}
      />
    );
    expect(
      await screen.findByText('Referral details are unavailable right now.')
    ).toBeInTheDocument();
  });

  it('explains a failed copy instead of failing silently', async () => {
    render(
      <ReferralPanelBody
        loadPanel={() => Promise.resolve(panel())}
        copyText={() => Promise.reject(new Error('denied'))}
        origin="https://x.test"
      />
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Copy referral link' }));
    expect(await screen.findByText(/Could not copy/)).toBeInTheDocument();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('says referrals are paused when disabled by config', async () => {
    render(<ReferralPanelBody loadPanel={() => Promise.resolve(panel({ enabled: false }))} />);
    expect(await screen.findByText('Referrals are paused right now.')).toBeInTheDocument();
  });
});
