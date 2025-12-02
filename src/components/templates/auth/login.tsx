'use client';
import { FloatingLabelInput } from '@/components/molecules/floating-label-input';
import { Button } from '@/components/atoms/button';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { FormEvent, useState, useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/api/use-auth';
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
    error: authError,
    stytchUser,
    stytchSession,
    stytch,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [methodId, setMethodId] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const hasHandledOAuthRef = useRef(false);

  // Redirect if already logged in
  useEffect(() => {
    if (stytchUser && stytchSession) {
      router.push('/');
    }
  }, [stytchUser, stytchSession, router]);

  // Handle Google OAuth callback
  useEffect(() => {
    if (!stytch) return;
    const tokenType = searchParams.get('stytch_token_type');
    const token = searchParams.get('token');
    if (tokenType !== 'oauth' || !token || hasHandledOAuthRef.current) {
      return;
    }
    hasHandledOAuthRef.current = true;
    setIsGoogleLoading(true);
    setError('');
    stytch.oauth
      .authenticate(token, { session_duration_minutes: 60 * 24 * 7 })
      .then(() => {
        router.replace('/');
      })
      .catch((err) => {
        console.error('Google OAuth authenticate error:', err);
        setError(err instanceof Error ? err.message : 'Failed to authenticate Google login');
        hasHandledOAuthRef.current = false;
      })
      .finally(() => {
        setIsGoogleLoading(false);
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

  // Handle email submission (first step)
  const handleEmailSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter an email address');
      return;
    }

    try {
      setError('');
      console.log('Submitting email:', email);

      const result = await initiateAuth(email.toLowerCase());
      console.log('Auth initiated successfully:', result);

      if (result && result.methodId) {
        setMethodId(result.methodId);
        setIsVerifying(true);
        setError('');
      } else {
        setError('Failed to initialize authentication. Please try again.');
      }
    } catch (err) {
      console.error('Failed to initiate auth:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to send verification email. Please try again.';
      setError(errorMessage);
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
      console.log('Verifying code for email:', email);
      const result = await verifyAuth(email, verificationCode, methodId);
      console.log('Verification result:', result);

      if (result.success) {
        console.log('Verification successful, redirecting');
        window.location.href = '/';
      } else {
        setError(result.message || 'Verification failed. Please check your code and try again.');
      }
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
      console.log('Resending code to email:', email);
      const result = await resendVerificationCode(email);
      console.log('Resend result:', result);

      if (result && result.methodId) {
        setMethodId(result.methodId);
      }
    } catch (err) {
      console.error('Failed to resend code:', err);
      setError('Failed to resend verification email. Please try again.');
    }
  };

  return (
    <div className="flex flex-col justify-between w-full max-w-xl items-center py-10 mx-auto min-h-screen lg:border-x border-border">
      <Image
        className="absolute top-6 left-6"
        src="/tensr_logo_light.png"
        alt="Tensr Logo"
        height={24}
        width={96}
        unoptimized
      />
      <div className="flex-1"></div>
      <div className="flex flex-col max-w-xl w-full">
        {!isVerifying ? (
          <div className="flex flex-col gap-10">
            <h1 className="text-3xl font-medium border-l-4 !border-primary px-6 lg:px-10">
              Sign up or log in to Tensr
            </h1>

            {/* Google OAuth Button */}
            <div className="px-6 lg:px-10">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full h-12"
                onClick={handleGoogleOAuth}
                disabled={isGoogleLoading || isLoading}
              >
                <span className="flex size-6 items-center justify-center mr-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="size-6">
                    <path
                      fill="#FFC107"
                      d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
                    />
                    <path
                      fill="#FF3D00"
                      d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
                    />
                    <path
                      fill="#4CAF50"
                      d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
                    />
                    <path
                      fill="#1976D2"
                      d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
                    />
                  </svg>
                </span>
                <span>{isGoogleLoading ? 'Continuing…' : 'Continue with Google'}</span>
              </Button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4 px-6 lg:px-10">
              <div className="h-px flex-1 bg-border" />
              <span className="text-sm text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Email Form */}
            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4 px-6 lg:px-10">
              <FloatingLabelInput
                label="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={isLoading || isGoogleLoading}
              />
              <Button
                className="px-4 py-3 h-12 lg:h-10 w-full lg:w-fit"
                size="lg"
                type="submit"
                disabled={isLoading || isGoogleLoading}
              >
                {isLoading ? 'Sending...' : 'Continue with email'}
              </Button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            <button
              onClick={handleBackToLogin}
              className="self-start flex items-center px-6 lg:px-10"
              disabled={isLoading}
            >
              <ArrowLeft size={20} />
            </button>
            <div className="text-3xl font-medium px-6 lg:px-10 border-l-4 !border-primary">
              Check your email
            </div>
            <p className="px-6 lg:px-10">
              We sent an email to {email} with a verification code for easy login or signup.
            </p>
            <form onSubmit={handleVerificationSubmit} className="flex flex-col gap-4 px-6 lg:px-10">
              <FloatingLabelInput
                label="Verification code"
                value={verificationCode}
                onChange={e => setVerificationCode(e.target.value)}
                disabled={isLoading}
                inputMode="numeric"
                pattern="[0-9]*"
              />
              <div className="flex flex-row gap-4">
                <Button
                  className="px-4 py-3 h-12 lg:h-10 w-full lg:w-fit"
                  size="lg"
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading ? 'Verifying...' : 'Continue'}
                </Button>
              </div>
            </form>
            <div className="flex flex-col gap-6 text-base p-6 bg-[#f8f9f7] mx-10">
              <div>
                <h4>Didn&apos;t receive an email?</h4>
                <ul className="list-disc pl-4">
                  <li>
                    <button
                      onClick={handleResendEmail}
                      className="hover:underline text-primary"
                      disabled={isLoading}
                    >
                      Resend this email
                    </button>
                  </li>
                  <li>Check that the email you entered previously is correct.</li>
                  <li>Check to see if the email went to your spam folder.</li>
                  <li>Check back after a few minutes.</li>
                </ul>
              </div>
              <p>If you still have not received an email, please contact us at help@tensr.xyz.</p>
            </div>
          </div>
        )}

        {/* Show regular errors */}
        {(error || authError) && (
          <div className="text-red-500 mt-4 px-6 lg:px-10">{error || authError}</div>
        )}
      </div>
      <div className="flex-1 flex items-end w-full max-w-xl">
        <div className="flex flex-row gap-4 text-sm w-full px-10">
          <Link href="https://tensr-1.gitbook.io/tensr/legal-policies/terms-of-service">
            Terms of Service
          </Link>
          <Link href="https://tensr-1.gitbook.io/tensr/legal-policies/privacy-policy">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginTemplate;
