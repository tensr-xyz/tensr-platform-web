'use client';
import { FloatingLabelInput } from '@/components/molecules/floating-label-input';
import { Button } from '@/components/atoms/button';
import { useRouter } from 'next/navigation';
import React, { FormEvent, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/hooks/api/use-auth';

const LoginTemplate = () => {
  const router = useRouter();
  const {
    initiateAuth,
    verifyAuth,
    resendVerificationCode,
    isLoading,
    error: authError,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [session, setSession] = useState('');
  const [verificationAttempted, setVerificationAttempted] = useState(false);

  // Handle email submission (first step)
  const handleEmailSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter an email address');
      return;
    }

    try {
      console.log('Submitting email:', email);
      const result = await initiateAuth(email.toLowerCase());
      console.log('Auth initiated successfully');

      // Only proceed if we have a session
      if (result && result.session) {
        setSession(result.session);
        setIsVerifying(true);
        setError('');
      } else {
        setError('Failed to initialize authentication. Please try again.');
      }
    } catch (err) {
      console.error('Failed to initiate auth:', err);
      setError('Failed to send verification email. Please try again.');
    }
  };

  // Handle verification submission (second step)
  const handleVerificationSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setVerificationAttempted(true);

    if (!verificationCode) {
      setError('Please enter the verification code');
      return;
    }

    try {
      console.log('Verifying code for email:', email);
      const result = await verifyAuth(email, verificationCode, session);
      console.log('Verification result:', result);

      if (result.success) {
        console.log('Verification successful, redirecting');
        router.push('/');
      } else {
        setError('Verification failed. Please check your code and try again.');
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
  };

  // Handle resend verification
  const handleResendEmail = async () => {
    if (!email) {
      setError('Email address is missing');
      return;
    }

    try {
      console.log('Resending code to email:', email);
      const result = await resendVerificationCode(email, session);
      console.log('Resend result:', result);

      // Update session if a new one is provided
      if (result && result.session) {
        setSession(result.session);
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
      />
      <div className="flex-1"></div>
      <div className="flex flex-col max-w-xl w-full">
        {!isVerifying ? (
          <div className="flex flex-col gap-10">
            <h1 className="text-3xl font-medium border-l-4 !border-primary px-6 lg:px-10">
              Sign up or log in to Tensr
            </h1>
            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4 px-6 lg:px-10">
              <FloatingLabelInput
                label="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={isLoading}
              />
              <Button
                className="px-4 py-3 h-12 lg:h-10 w-full lg:w-fit"
                size="lg"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? 'Sending...' : 'Continue'}
              </Button>
            </form>
            <div className="text-sm px-6 lg:px-10">
              You can also sign in with Google or Linkedin
            </div>
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
              We sent an email to {email} with a magic link and code for easy login or signup.
            </p>
            <form onSubmit={handleVerificationSubmit} className="flex flex-col gap-4 px-6 lg:px-10">
              <FloatingLabelInput
                label="Login or verification code"
                value={verificationCode}
                onChange={e => setVerificationCode(e.target.value)}
                disabled={isLoading}
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
                <Button
                  className="px-4 py-3 h-12 lg:h-10 w-fit bg-[#f8f9f7]"
                  variant="secondary"
                  size="lg"
                  onClick={handleBackToLogin}
                  disabled={isLoading}
                >
                  Use password instead
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

        {/* Show session expiry error when applicable */}
        {!session && !error && verificationAttempted && isVerifying && (
          <div className="text-red-500 mt-4 px-6 lg:px-10">
            Session expired or not available. Please try again.
          </div>
        )}

        {/* Show regular errors */}
        {(error || authError) && (
          <div className="text-red-500 mt-4 px-6 lg:px-10">{error || authError}</div>
        )}
      </div>
      <div className="flex-1 flex items-end w-full max-w-xl">
        <div className="flex flex-row gap-4 text-sm w-full px-10">
          <div>Terms of Service</div>
          <div>Privacy Policy</div>
        </div>
      </div>
    </div>
  );
};

export default LoginTemplate;
