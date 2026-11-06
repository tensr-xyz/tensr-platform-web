'use client';
import { Input } from '@/components/atoms/input';
import { Button } from '@/components/atoms/button';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { FormEvent, useState, useEffect, useRef } from 'react';

import { useAuth } from '@/hooks/api/use-auth';
import {
  redeemStoredInvitation,
  sendSessionEmailCode,
  storePendingInviteToken,
} from '@/lib/business-api';
import { redeemStoredReferral, storeReferralCode } from '@/lib/referral';
import { entitlementsResolved, subscriptionRedirectPath } from '@/lib/subscription';
import { safeReturnTo } from '@/lib/safe-return-to';
import { STYTCH_SESSION_DURATION_MINUTES } from '@/lib/stytch-session';
import { stytchErrorMessage } from '@/lib/stytch-error-message';
import { dumpAuthTrace, authTrace } from '@/lib/auth-trace';
import { captureProductEvent, captureProductException, errorClass } from '@/lib/product-analytics';
import { storeSession } from '@/utils/auth';
import { SigningIn } from '@/components/molecules/signing-in';
import { isAuthReturn, markSigningIn } from '@/lib/signing-in';
import { ProviderLogo } from './provider-logos';
import Link from 'next/link';
import './signin.css';
import Image from 'next/image';
import posthog from 'posthog-js';

function emailCodeSendError(err: unknown): string {
  const message = err instanceof Error ? err.message.trim() : '';
  if (!message || /^not found$/i.test(message)) {
    return "Couldn't send the code, try again";
  }
  return message;
}

const LoginTemplate = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  // From the moment auth succeeds until /flow draws, the screen shows "Signing you in…", never a blank form.
  const [signingIn, setSigningInState] = useState(() => isAuthReturn(searchParams));
  const setSigningIn = (on: boolean) => {
    if (on) markSigningIn();
    setSigningInState(on);
  };

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const sessionToken = hash.get('session_token');
    if (!sessionToken) return;
    markSigningIn();
    setSigningInState(true);
    storeSession(sessionToken, hash.get('session_jwt') || undefined);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    router.replace(safeReturnTo(searchParams.get('returnTo')) || '/flow');
  }, [router, searchParams]);
  const {
    initiateAuth,
    verifyAuth,
    initiateGoogleAuth,
    resendVerificationCode,
    isLoading,
    isAuthenticated,
    isAuthReady,
    hasActiveSubscription,
    entitlements,
    error: authError,
    needsEmail,
    stytch,
  } = useAuth();

  const [email, setEmail] = useState(() => searchParams.get('email')?.trim() ?? '');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [methodId, setMethodId] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [codeNotice, setCodeNotice] = useState('');
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isMicrosoftLoading, setIsMicrosoftLoading] = useState(false);
  const [isGitHubLoading, setIsGitHubLoading] = useState(false);
  const [attachingEmail, setAttachingEmail] = useState(false);
  const [resendReady, setResendReady] = useState(false);
  const [resendEpoch, setResendEpoch] = useState(0);
  const otpSentAt = useRef<number | null>(null);
  const resendCount = useRef(0);
  const [showPassword, setShowPassword] = useState(false);
  const hasHandledOAuthRef = useRef(false);
  // Session bootstrap (`/me`, Stytch init) shares `isLoading` — never use that for
  // submit labels, or the form looks like it is sending before the user acts.
  const formBusy =
    isSendingCode || isVerifyingCode || isGoogleLoading || isMicrosoftLoading || isGitHubLoading;

  useEffect(() => {
    const suggested = needsEmail?.suggestedEmail?.trim();
    if (!suggested) return;
    setEmail(current => current || suggested);
  }, [needsEmail?.suggestedEmail]);

  useEffect(() => {
    if (!isVerifying) {
      setResendReady(false);
      return;
    }
    setResendReady(false);
    const timer = window.setTimeout(() => setResendReady(true), 30_000);
    return () => window.clearTimeout(timer);
  }, [isVerifying, resendEpoch]);

  // Persist invite token from email links (?invite=...) for accept after sign-in.
  useEffect(() => {
    dumpAuthTrace('Auth trace (survived redirect to login)');
    const invite = searchParams.get('invite');
    if (invite) {
      storePendingInviteToken(invite);
    }
    const referral = searchParams.get('ref');
    if (referral) {
      storeReferralCode(referral);
    }
  }, [searchParams]);

  // Redirect if already logged in (AuthProvider owns session/user sync)
  useEffect(() => {
    if (needsEmail) return;
    if (isLoading || !isAuthenticated || !isAuthReady) return;
    // Wait until /api/me has populated entitlements — null means unresolved, not unpaid.
    // Redirecting early sends entitled users (promo/manual comp) to /subscription and
    // SubscriptionGate replace()-loops them when they hit Back.
    if (!entitlementsResolved(entitlements)) return;

    authTrace('login:redirect-after-auth');
    markSigningIn();
    setSigningInState(true);

    void Promise.all([redeemStoredInvitation(), redeemStoredReferral()]).finally(() => {
      const target = safeReturnTo(searchParams.get('returnTo'));
      router.push(hasActiveSubscription ? target : subscriptionRedirectPath(target));
    });
  }, [
    isAuthenticated,
    isLoading,
    isAuthReady,
    hasActiveSubscription,
    entitlements,
    needsEmail,
    router,
    searchParams,
  ]);

  // Handle OAuth callback (Google or GitHub)
  useEffect(() => {
    if (!stytch) return;
    const tokenType = searchParams.get('stytch_token_type');
    const token = searchParams.get('token');
    if (tokenType !== 'oauth' || !token || hasHandledOAuthRef.current) {
      return;
    }
    hasHandledOAuthRef.current = true;
    markSigningIn();
    setSigningInState(true);
    setIsGoogleLoading(true);
    setIsGitHubLoading(true);
    setError('');
    stytch.oauth
      .authenticate(token, {
        session_duration_minutes: STYTCH_SESSION_DURATION_MINUTES,
      })
      .then(async response => {
        if (response.session_token) {
          storeSession(response.session_token, response.session_jwt);
        }
        await redeemStoredInvitation();
        // Identify happens in AuthProvider when /me succeeds; only record the sign-in here.
        posthog.capture('user_signed_in', { method: 'oauth' });
        // Session + profile sync handled by AuthProvider; redirect useEffect runs when ready.
      })
      .catch(err => {
        console.error('OAuth authenticate error:', err);
        setSigningIn(false);
        setError(stytchErrorMessage(err, 'Failed to authenticate'));
        hasHandledOAuthRef.current = false;
      })
      .finally(() => {
        setIsGoogleLoading(false);
        setIsGitHubLoading(false);
      });
  }, [searchParams, stytch, router]);

  // Handle Google OAuth button click
  const handleGoogleOAuth = async () => {
    if (!stytch) return;
    try {
      setIsGoogleLoading(true);
      setError('');
      posthog.capture('oauth_login_started', { provider: 'google' });
      const redirectUrl = new URL('/login', window.location.origin).toString();
      await stytch.oauth.google.start({
        login_redirect_url: redirectUrl,
        signup_redirect_url: redirectUrl,
      });
    } catch (err) {
      console.error('Google OAuth start error:', err);
      setError(stytchErrorMessage(err, 'Failed to continue with Google'));
      setIsGoogleLoading(false);
    }
  };

  // Handle GitHub OAuth button click
  const handleGitHubOAuth = async () => {
    if (!stytch) return;
    try {
      setIsGitHubLoading(true);
      setError('');
      posthog.capture('oauth_login_started', { provider: 'github' });
      const redirectUrl = new URL('/login', window.location.origin).toString();
      await stytch.oauth.github.start({
        login_redirect_url: redirectUrl,
        signup_redirect_url: redirectUrl,
      });
    } catch (err) {
      console.error('GitHub OAuth start error:', err);
      setError(stytchErrorMessage(err, 'Failed to continue with GitHub'));
      setIsGitHubLoading(false);
    }
  };

  const handleMicrosoftOAuth = async () => {
    if (!stytch) return;
    try {
      setIsMicrosoftLoading(true);
      setError('');
      posthog.capture('oauth_login_started', { provider: 'microsoft' });
      const redirectUrl = new URL('/login', window.location.origin).toString();
      await stytch.oauth.microsoft.start({
        login_redirect_url: redirectUrl,
        signup_redirect_url: redirectUrl,
      });
    } catch (err) {
      console.error('Microsoft OAuth start error:', err);
      setError(stytchErrorMessage(err, 'Failed to continue with Microsoft'));
      setIsMicrosoftLoading(false);
    }
  };

  const handleAttachEmail = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Please enter an email address');
      return;
    }
    if (isSendingCode) return;
    try {
      setError('');
      setIsSendingCode(true);
      const result = await sendSessionEmailCode(trimmedEmail);
      setEmail(trimmedEmail);
      setMethodId(result.method_id);
      setAttachingEmail(true);
      setIsVerifying(true);
      otpSentAt.current = Date.now();
      resendCount.current = 0;
      setCodeNotice('Codes can take a minute. Check spam or quarantine.');
    } catch (err) {
      setError(emailCodeSendError(err));
      setIsVerifying(false);
    } finally {
      setIsSendingCode(false);
    }
  };

  // Handle email submission (first step)
  const handleEmailSubmit = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter an email address');
      return;
    }

    if (!stytch) {
      setError('Authentication service not ready. Please refresh the page.');
      return;
    }

    if (isSendingCode) {
      return;
    }

    try {
      setError('');
      setIsSendingCode(true);
      const result = await initiateAuth(trimmedEmail.toLowerCase());

      if (result && result.methodId) {
        setMethodId(result.methodId);
        setIsVerifying(true);
        setError('');
        otpSentAt.current = Date.now();
        resendCount.current = 0;
        setCodeNotice('Codes can take a minute. Check spam or quarantine.');
        posthog.capture('login_initiated', { method: 'email_otp' });
        captureProductEvent('otp_sent', { resend: false });
      } else {
        setError('Failed to initialize authentication. Please try again.');
        captureProductEvent('otp_send_failed', { resend: false, error_class: 'missing_method_id' });
        console.error('No methodId returned from initiateAuth', result);
      }
    } catch (err) {
      console.error('Failed to initiate auth:', err);
      captureProductException(err, { where: 'otp_send' });
      captureProductEvent('otp_send_failed', { resend: false, error_class: errorClass(err) });
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to send verification email. Please try again.';
      setError(errorMessage);
      setIsVerifying(false);
    } finally {
      setIsSendingCode(false);
    }
  };

  // Handle verification submission (second step)
  const handleVerificationSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!verificationCode) {
      setError('Please enter the verification code');
      return;
    }

    if (!methodId) {
      setError('Session expired. Please request a new code.');
      return;
    }

    try {
      setIsVerifyingCode(true);
      const result = await verifyAuth(email, verificationCode, methodId);

      if (result.success) {
        setSigningIn(true);
        const sentAt = otpSentAt.current;
        captureProductEvent('otp_verified', {
          elapsed_ms: sentAt == null ? null : Date.now() - sentAt,
          resend_count: resendCount.current,
        });
        // Do not push to /dashboard here — unpaid users must go to /subscription.
        // The authenticated redirect useEffect above routes once profile/entitlements sync.
        // Leave the button in a verifying state until that redirect runs.
        return;
      }
      setError(result.message || 'Verification failed. Please check your code and try again.');
      setIsVerifyingCode(false);
    } catch (err) {
      console.error('Failed to verify code:', err);
      setError('Failed to verify code. Please try again.');
      setIsVerifyingCode(false);
    }
  };

  // Handle back to login
  const handleBackToLogin = () => {
    setIsVerifying(false);
    setVerificationCode('');
    setError('');
    setCodeNotice('');
    setMethodId('');
    otpSentAt.current = null;
    resendCount.current = 0;
  };

  // Handle resend email
  const handleResendEmail = async () => {
    if (!email) {
      setError('Email address is missing');
      return;
    }

    try {
      setIsSendingCode(true);
      setError('');
      captureProductEvent('otp_resend_clicked', {});
      if (attachingEmail) {
        const sent = await sendSessionEmailCode(email.trim().toLowerCase());
        setMethodId(sent.method_id);
        resendCount.current += 1;
        setResendEpoch(epoch => epoch + 1);
        setCodeNotice('Codes can take a minute. Check spam or quarantine.');
        captureProductEvent('otp_sent', { resend: true, resend_count: resendCount.current });
        return;
      }
      const result = await resendVerificationCode(email.trim().toLowerCase());
      if (result && result.methodId) {
        setMethodId(result.methodId);
        resendCount.current += 1;
        setResendEpoch(epoch => epoch + 1);
        setCodeNotice('Codes can take a minute. Check spam or quarantine.');
        captureProductEvent('otp_sent', { resend: true, resend_count: resendCount.current });
      } else {
        setError('Could not resend the code. Please try again.');
        captureProductEvent('otp_send_failed', { resend: true, error_class: 'missing_method_id' });
      }
    } catch (err) {
      console.error('Failed to resend code:', err);
      captureProductException(err, { where: 'otp_resend' });
      captureProductEvent('otp_send_failed', { resend: true, error_class: errorClass(err) });
      setError(stytchErrorMessage(err, 'Failed to resend verification email. Please try again.'));
    } finally {
      setIsSendingCode(false);
    }
  };

  const providers = [
    { key: 'google' as const, label: 'Google', loading: isGoogleLoading, run: handleGoogleOAuth },
    {
      key: 'microsoft' as const,
      label: 'Microsoft',
      loading: isMicrosoftLoading,
      run: handleMicrosoftOAuth,
    },
    {
      key: 'github' as const,
      label: 'GitHub',
      loading: isGitHubLoading,
      run: handleGitHubOAuth,
    },
  ];
  const digits = Array.from({ length: 6 }, (_, index) => verificationCode[index] || '');

  // Adding an email after OAuth is still a form; anything else after auth succeeds is "Signing you in…".
  if (signingIn && !needsEmail && !error) return <SigningIn />;

  return (
    <div className="signin">
      <section className="signin-pane">
        <header className="signin-head">
          <a href="https://tensr.xyz" className="signin-logo" aria-label="Tensr">
            <svg width="24" height="24" viewBox="0 0 48 48" aria-hidden="true">
              <rect x="4" y="5" width="12" height="12" rx="2.5" fill="#23463B" />
              <rect x="18" y="5" width="12" height="12" rx="2.5" fill="#23463B" />
              <rect x="32" y="5" width="12" height="12" rx="2.5" fill="#6FC2A6" />
              <rect x="18" y="19" width="12" height="12" rx="2.5" fill="#23463B" />
              <rect x="18" y="33" width="12" height="12" rx="2.5" fill="#23463B" />
            </svg>
            <span>tensr</span>
          </a>
          <a href="https://tensr.xyz" className="signin-back">
            Back to site
          </a>
        </header>

        <div className="signin-card">
          {needsEmail && !isVerifying ? (
            <form
              onSubmit={event => {
                event.preventDefault();
                void handleAttachEmail();
              }}
              className="signin-form"
            >
              <h1>Add your email</h1>
              <p className="signin-lede">
                We will send a code to this address. If a Tensr account already uses it, you will
                sign into that account.
              </p>
              <label className="signin-label" htmlFor="attach-email">
                Work email
              </label>
              <Input
                id="attach-email"
                className="signin-input"
                type="email"
                autoComplete="email"
                placeholder="Email address"
                value={email}
                onChange={event => setEmail(event.target.value)}
                required
              />
              <Button type="submit" className="signin-primary" disabled={formBusy}>
                {isSendingCode ? 'Sending code...' : 'Send code'}
              </Button>
            </form>
          ) : !isVerifying ? (
            <form
              onSubmit={e => {
                e.preventDefault();
                handleEmailSubmit();
              }}
              className="signin-form"
              noValidate
            >
              <h1>Sign in to Tensr</h1>
              <p className="signin-lede">
                Pick up where you left off. No password, we&apos;ll send you a code.
              </p>
              <div className="signin-oauth">
                {providers.map(provider => (
                  <Button
                    key={provider.key}
                    type="button"
                    className="signin-provider"
                    onClick={provider.run}
                    disabled={formBusy}
                  >
                    <ProviderLogo provider={provider.key} className="signin-mark" />
                    {provider.loading ? 'Continuing...' : `Continue with ${provider.label}`}
                  </Button>
                ))}
              </div>
              <div className="signin-or">
                <span />
                or
                <span />
              </div>
              <label htmlFor="email" className="signin-label">
                Work email
              </label>
              <Input
                id="email"
                className="signin-input"
                type="email"
                placeholder="you@agency.co.uk"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && email && !formBusy) {
                    e.preventDefault();
                    handleEmailSubmit();
                  }
                }}
                disabled={formBusy}
                autoFocus
                required
              />
              <Button type="submit" disabled={formBusy} className="signin-primary">
                {isSendingCode ? 'Sending...' : 'Email me a code'}
                {isSendingCode ? null : <span aria-hidden="true">→</span>}
              </Button>
              <p className="signin-new">
                New here? <Link href="/signup">Start a 30-day free trial</Link>
              </p>
              <p className="signin-terms">
                By continuing you agree to our{' '}
                <Link
                  href="https://tensr-1.gitbook.io/tensr/legal-policies/terms-of-service"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Terms
                </Link>{' '}
                and{' '}
                <Link
                  href="https://tensr-1.gitbook.io/tensr/legal-policies/privacy-policy"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Privacy Policy
                </Link>
                .
              </p>
            </form>
          ) : (
            <form onSubmit={handleVerificationSubmit} className="signin-form">
              <h1>Check your email</h1>
              <p className="signin-lede">
                We sent a 6-digit code to <span className="signin-ink">{email}</span>. It expires in
                10 minutes.
              </p>
              <label htmlFor="code" className="signin-label">
                6-digit code
              </label>
              <div className="signin-code">
                <Input
                  id="code"
                  className="signin-code-input"
                  type="text"
                  value={verificationCode}
                  onChange={e => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={formBusy}
                  autoFocus
                  required
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                />
                <div className="signin-boxes" aria-hidden="true">
                  {digits.map((digit, index) => (
                    <span
                      key={index}
                      data-active={index === Math.min(verificationCode.length, 5) || undefined}
                    >
                      {digit ||
                        (index === verificationCode.length ? <i className="signin-caret" /> : null)}
                    </span>
                  ))}
                </div>
              </div>
              <Button type="submit" disabled={formBusy} className="signin-primary">
                {isVerifyingCode ? 'Verifying...' : 'Verify'}
                {isVerifyingCode ? null : <span aria-hidden="true">→</span>}
              </Button>
              <div className="signin-row">
                <Button
                  type="button"
                  className="signin-resend"
                  onClick={handleResendEmail}
                  disabled={formBusy || !resendReady}
                >
                  {isSendingCode
                    ? 'Sending...'
                    : resendReady
                      ? 'Resend code'
                      : 'Resend code in 0:30'}
                </Button>
                <Button type="button" className="signin-link" onClick={handleBackToLogin}>
                  Use a different email
                </Button>
              </div>
              <p className="signin-help" role="status">
                {codeNotice || 'Can’t find it? Check your spam or promotions folder.'}
              </p>
            </form>
          )}
          {error || authError ? <p className="signin-error">{error || authError}</p> : null}
        </div>

        <footer className="signin-foot">
          <span>© 2026 Tensr · Made in Preston</span>
          <span>
            <Link
              href="https://tensr-1.gitbook.io/tensr/legal-policies/terms-of-service"
              rel="noopener noreferrer"
              target="_blank"
            >
              Terms
            </Link>
            <Link
              href="https://tensr-1.gitbook.io/tensr/legal-policies/privacy-policy"
              rel="noopener noreferrer"
              target="_blank"
            >
              Privacy
            </Link>
          </span>
        </footer>
      </section>
      <aside className="signin-side" aria-hidden="true">
        <Image src="/login-preview.png" alt="" width={656} height={600} unoptimized priority />
        <div className="signin-side-copy">
          <p className="signin-side-title">Every number, traced to the people behind it.</p>
          <p>Encrypted at rest. Your data is never used to train models.</p>
        </div>
      </aside>
    </div>
  );
};

export default LoginTemplate;
