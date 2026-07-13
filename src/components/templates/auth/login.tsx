'use client';
import { Input } from '@/components/atoms/input';
import { Button } from '@/components/atoms/button';
import { Card } from '@/components/atoms/card';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { FormEvent, useState, useEffect, useRef } from 'react';
import { ArrowLeft, Eye, EyeOff, Mail } from 'lucide-react';
import { useAuth } from '@/hooks/api/use-auth';
import { redeemStoredInvitation, storePendingInviteToken } from '@/lib/business-api';
import { subscriptionRedirectPath } from '@/lib/subscription';
import { STYTCH_SESSION_DURATION_MINUTES } from '@/lib/stytch-session';
import { dumpAuthTrace, authTrace } from '@/lib/auth-trace';
import { storeSession } from '@/utils/auth';
import Link from 'next/link';
import Image from 'next/image';

const LoginTemplate = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    initiateAuth,
    verifyAuth,
    initiateGoogleAuth,
    resendVerificationCode,
    isLoading,
    isAuthenticated,
    isAuthReady,
    hasActiveSubscription,
    error: authError,
    stytch,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [methodId, setMethodId] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGitHubLoading, setIsGitHubLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const hasHandledOAuthRef = useRef(false);

  // Persist invite token from email links (?invite=...) for accept after sign-in.
  useEffect(() => {
    dumpAuthTrace('Auth trace (survived redirect to login)');
    const invite = searchParams.get('invite');
    if (invite) {
      storePendingInviteToken(invite);
    }
  }, [searchParams]);

  // Redirect if already logged in (AuthProvider owns session/user sync)
  useEffect(() => {
    if (isLoading || !isAuthenticated || !isAuthReady) return;

    authTrace('login:redirect-after-auth');

    void redeemStoredInvitation().finally(() => {
      const returnTo = searchParams.get('returnTo');
      const target = returnTo && returnTo.startsWith('/') ? returnTo : '/dashboard';
      router.push(hasActiveSubscription ? target : subscriptionRedirectPath(target));
    });
  }, [isAuthenticated, isLoading, isAuthReady, hasActiveSubscription, router, searchParams]);

  // Handle OAuth callback (Google or GitHub)
  useEffect(() => {
    if (!stytch) return;
    const tokenType = searchParams.get('stytch_token_type');
    const token = searchParams.get('token');
    if (tokenType !== 'oauth' || !token || hasHandledOAuthRef.current) {
      return;
    }
    hasHandledOAuthRef.current = true;
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
        // Session + profile sync handled by AuthProvider; redirect useEffect runs when ready.
      })
      .catch(err => {
        console.error('OAuth authenticate error:', err);
        setError(err instanceof Error ? err.message : 'Failed to authenticate');
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
      const redirectUrl = new URL('/login', window.location.origin).toString();
      await stytch.oauth.google.start({
        login_redirect_url: redirectUrl,
        signup_redirect_url: redirectUrl,
      });
    } catch (err) {
      console.error('Google OAuth start error:', err);
      setError(err instanceof Error ? err.message : 'Failed to continue with Google');
      setIsGoogleLoading(false);
    }
  };

  // Handle GitHub OAuth button click
  const handleGitHubOAuth = async () => {
    if (!stytch) return;
    try {
      setIsGitHubLoading(true);
      setError('');
      const redirectUrl = new URL('/login', window.location.origin).toString();
      await stytch.oauth.github.start({
        login_redirect_url: redirectUrl,
        signup_redirect_url: redirectUrl,
      });
    } catch (err) {
      console.error('GitHub OAuth start error:', err);
      setError(err instanceof Error ? err.message : 'Failed to continue with GitHub');
      setIsGitHubLoading(false);
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

    // Prevent multiple submissions
    if (isLoading) {
      return;
    }

    try {
      setError('');
      const result = await initiateAuth(trimmedEmail.toLowerCase());

      if (result && result.methodId) {
        setMethodId(result.methodId);
        setIsVerifying(true);
        setError('');
      } else {
        setError('Failed to initialize authentication. Please try again.');
        console.error('No methodId returned from initiateAuth', result);
      }
    } catch (err) {
      console.error('Failed to initiate auth:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to send verification email. Please try again.';
      setError(errorMessage);
      setIsVerifying(false);
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
      const result = await verifyAuth(email, verificationCode, methodId);

      if (result.success) {
        // Do not push to /dashboard here — unpaid users must go to /subscription.
        // The authenticated redirect useEffect above routes once profile/entitlements sync.
        return;
      }
      setError(result.message || 'Verification failed. Please check your code and try again.');
    } catch (err) {
      console.error('Failed to verify code:', err);
      setError('Failed to verify code. Please try again.');
    }
  };

  // Handle back to login
  const handleBackToLogin = () => {
    setIsVerifying(false);
    setVerificationCode('');
    setError('');
    setMethodId('');
  };

  // Handle resend email
  const handleResendEmail = async () => {
    if (!email) {
      setError('Email address is missing');
      return;
    }

    try {
      const result = await resendVerificationCode(email);
      if (result && result.methodId) {
        setMethodId(result.methodId);
      }
    } catch (err) {
      console.error('Failed to resend code:', err);
      setError('Failed to resend verification email. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-4 bg-background relative">
      {/* Logo in top left */}
      <div className="absolute top-6 left-6">
        <div className="relative w-32 h-8">
          <Image
            src="/tensr_logo_light.png"
            alt="Tensr Logo"
            fill
            className="object-contain dark:hidden"
            unoptimized
          />
          <Image
            src="/tensr_logo_dark.png"
            alt="Tensr Logo"
            fill
            className="object-contain hidden dark:block"
            unoptimized
          />
        </div>
      </div>

      {/* Main Content - Centered */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-[440px] min-w-[320px]">
          {/* Welcome Text - Left Aligned */}
          <div className="flex flex-col mb-8">
            <div className="text-2xl font-medium text-left">Welcome to Tensr</div>
            <div className="text-2xl font-medium text-left text-muted-foreground">
              The new way to analyse data
            </div>
          </div>

          {/* Card */}
          <Card className="p-6">
            {!isVerifying ? (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  handleEmailSubmit();
                }}
                className="flex flex-col gap-5"
                noValidate
              >
                {/* OAuth Buttons */}
                <div className="flex flex-col gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-10 justify-start gap-3"
                    onClick={handleGoogleOAuth}
                    disabled={isGoogleLoading || isGitHubLoading || isLoading}
                  >
                    <svg
                      fill="none"
                      height="15"
                      viewBox="0 0 16 16"
                      width="15"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <g>
                        <path
                          d="M15.83 8.18C15.83 7.65333 15.7833 7.15333 15.7033 6.66667H8.17V9.67333H12.4833C12.29 10.66 11.7233 11.4933 10.8833 12.06V14.06H13.4567C14.9633 12.6667 15.83 10.6133 15.83 8.18Z"
                          fill="#4285F4"
                        />
                        <path
                          d="M8.17 16C10.33 16 12.1367 15.28 13.4567 14.06L10.8833 12.06C10.1633 12.54 9.25 12.8333 8.17 12.8333C6.08334 12.8333 4.31667 11.4267 3.68334 9.52667H1.03V11.5867C2.34334 14.2 5.04334 16 8.17 16Z"
                          fill="#34A853"
                        />
                        <path
                          d="M3.68334 9.52667C3.51667 9.04667 3.43 8.53333 3.43 8C3.43 7.46667 3.52334 6.95334 3.68334 6.47334V4.41334H1.03C0.483335 5.49334 0.170002 6.70667 0.170002 8C0.170002 9.29333 0.483335 10.5067 1.03 11.5867L3.68334 9.52667Z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M8.17 3.16667C9.35 3.16667 10.4033 3.57334 11.2367 4.36667L13.5167 2.08667C12.1367 0.793334 10.33 0 8.17 0C5.04334 0 2.34334 1.8 1.03 4.41334L3.68334 6.47334C4.31667 4.57334 6.08334 3.16667 8.17 3.16667Z"
                          fill="#EA4335"
                        />
                      </g>
                    </svg>
                    <span className="text-sm">
                      {isGoogleLoading ? 'Continuing...' : 'Continue with Google'}
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-10 justify-start gap-3"
                    onClick={handleGitHubOAuth}
                    disabled={isGoogleLoading || isGitHubLoading || isLoading}
                  >
                    <svg
                      fill="none"
                      height="16"
                      viewBox="0 0 15 15"
                      width="16"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        clipRule="evenodd"
                        d="M7.49933 0.25C3.49635 0.25 0.25 3.49593 0.25 7.50024C0.25 10.703 2.32715 13.4206 5.2081 14.3797C5.57084 14.446 5.70302 14.2222 5.70302 14.0299C5.70302 13.8576 5.69679 13.4019 5.69323 12.797C3.67661 13.235 3.25112 11.825 3.25112 11.825C2.92132 10.9874 2.44599 10.7644 2.44599 10.7644C1.78773 10.3149 2.49584 10.3238 2.49584 10.3238C3.22353 10.375 3.60629 11.0711 3.60629 11.0711C4.25298 12.1788 5.30335 11.8588 5.71638 11.6732C5.78225 11.205 5.96962 10.8854 6.17658 10.7043C4.56675 10.5209 2.87415 9.89918 2.87415 7.12104C2.87415 6.32925 3.15677 5.68257 3.62053 5.17563C3.54576 4.99226 3.29697 4.25521 3.69174 3.25691C3.69174 3.25691 4.30015 3.06196 5.68522 3.99973C6.26337 3.83906 6.8838 3.75895 7.50022 3.75583C8.1162 3.75895 8.73619 3.83906 9.31523 3.99973C10.6994 3.06196 11.3069 3.25691 11.3069 3.25691C11.7026 4.25521 11.4538 4.99226 11.3795 5.17563C11.8441 5.68257 12.1245 6.32925 12.1245 7.12104C12.1245 9.9063 10.4292 10.5192 8.81452 10.6985C9.07444 10.9224 9.30633 11.3648 9.30633 12.0413C9.30633 13.0102 9.29742 13.7922 9.29742 14.0299C9.29742 14.2239 9.42828 14.4496 9.79591 14.3788C12.6746 13.4179 14.75 10.7025 14.75 7.50024C14.75 3.49593 11.5036 0.25 7.49933 0.25Z"
                        fillRule="evenodd"
                        fill="currentColor"
                      />
                    </svg>
                    <span className="text-sm">
                      {isGitHubLoading ? 'Continuing...' : 'Continue with GitHub'}
                    </span>
                  </Button>
                </div>

                {/* Separator */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs text-muted-foreground">
                    <span className="bg-card px-2">OR</span>
                  </div>
                </div>

                {/* Email Form */}
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="email" className="text-sm font-semibold">
                      Email
                    </label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Your email address"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onKeyDown={e => {
                        if (
                          e.key === 'Enter' &&
                          email &&
                          !isLoading &&
                          !isGoogleLoading &&
                          !isGitHubLoading
                        ) {
                          e.preventDefault();
                          handleEmailSubmit();
                        }
                      }}
                      disabled={isLoading || isGoogleLoading || isGitHubLoading}
                      autoFocus
                      required
                      className="h-10"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isLoading || isGoogleLoading || isGitHubLoading}
                    className="w-full h-10"
                  >
                    {isLoading ? 'Sending...' : 'Continue'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-5">
                {/* Verification Form */}
                <form onSubmit={handleVerificationSubmit} className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2 flex-grow">
                    <div className="flex items-center justify-between">
                      <label htmlFor="email-display" className="text-sm font-semibold">
                        Email
                      </label>
                    </div>
                    <Input
                      id="email-display"
                      type="text"
                      value={email}
                      readOnly
                      className="h-10 bg-muted"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor="code" className="text-sm font-semibold">
                        Verification Code
                      </label>
                      <button
                        type="button"
                        onClick={handleResendEmail}
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                        disabled={isLoading}
                      >
                        Resend code
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        id="code"
                        type="text"
                        placeholder="Enter verification code"
                        value={verificationCode}
                        onChange={e => setVerificationCode(e.target.value)}
                        disabled={isLoading}
                        autoFocus
                        required
                        className="h-10 pr-10"
                        inputMode="numeric"
                        pattern="[0-9]*"
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={isLoading} className="w-full h-10">
                    {isLoading ? 'Verifying...' : 'Sign in'}
                  </Button>
                </form>

                {/* Back Button - Under Sign in */}
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleBackToLogin}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Go back
                  </Button>
                </div>
              </div>
            )}

            {/* Error Message */}
            {(error || authError) && (
              <div className="mt-4 text-sm text-destructive">{error || authError}</div>
            )}

            {/* Sign up link */}
            {!isVerifying && (
              <p className="text-sm text-center text-muted-foreground mt-5">
                Don&apos;t have an account?{' '}
                <Link href="/sign-up" className="text-primary hover:underline">
                  Sign up
                </Link>
              </p>
            )}
          </Card>
        </div>
      </div>

      {/* Footer - Bottom of screen */}
      <div className="w-full flex justify-center">
        <small className="text-sm text-center text-muted-foreground max-w-[340px]">
          <Link
            href="https://tensr-1.gitbook.io/tensr/legal-policies/terms-of-service"
            rel="noopener noreferrer"
            target="_blank"
            className="hover:underline"
          >
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link
            href="https://tensr-1.gitbook.io/tensr/legal-policies/privacy-policy"
            rel="noopener noreferrer"
            target="_blank"
            className="hover:underline"
          >
            Privacy Policy
          </Link>
        </small>
      </div>
    </div>
  );
};

export default LoginTemplate;
