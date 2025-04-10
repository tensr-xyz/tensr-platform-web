'use client';

import { Button } from '@/components/atoms/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/atoms/form';
import { Input } from '@/components/atoms/input';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@/components/molecules/input-otp';
import { useAuth } from '@/hooks/api/use-auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const emailSchema = z.object({
  email: z.string().email({
    message: 'Please enter a valid email address.',
  }),
});

type EmailFormProps = {
  onSuccess: (email: string) => void;
  defaultEmail?: string;
};

export const EmailForm = ({ onSuccess, defaultEmail = '' }: EmailFormProps) => {
  const { initiateAuth, isLoading, error } = useAuth();

  const form = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: defaultEmail,
    },
  });

  // Single point of initiating auth - no useEffect here
  const handleSubmit = async (data: z.infer<typeof emailSchema>) => {
    try {
      console.log('Submitting email:', data.email);
      const result = await initiateAuth(data.email);
      console.log('Auth initiated successfully');

      // Only call onSuccess if we have a session
      if (result && result.session) {
        onSuccess(data.email, result.session);
      }
    } catch (err) {
      console.error('Failed to initiate auth:', err);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-medium tracking-tight">Welcome back</h1>
        <p className="text-gray-500">Enter your email to sign in to your account</p>
      </div>

      {error && <div className="text-red-500 text-sm text-center">{error}</div>}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email address</FormLabel>
                <FormControl>
                  <Input placeholder="name@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Sending code...' : 'Continue'}
          </Button>
        </form>
      </Form>

      <div className="text-center">
        <p className="text-sm text-gray-500">
          Don&apos;t have an account?{' '}
          <Button variant="link" className="text-black p-0">
            Sign up
          </Button>
        </p>
      </div>
    </div>
  );
};

type OTPFormProps = {
  email: string;
  session: string;
};

export const OTPForm = ({ email, session }: OTPFormProps) => {
  const router = useRouter();
  const { verifyAuth, resendVerificationCode, isLoading, error } = useAuth();
  const [otp, setOtp] = React.useState('');
  const [verificationAttempted, setVerificationAttempted] = React.useState(false);

  // Handle verification
  const handleSubmit = async () => {
    setVerificationAttempted(true);
    try {
      console.log('Verifying OTP for email:', email);
      // Use the passed session directly rather than from useAuth
      const result = await verifyAuth(email, otp, session);
      console.log('Verification result:', result);

      if (result.success) {
        console.log('Verification successful, redirecting');
        router.push('/');
      }
    } catch (err) {
      console.error('Failed to verify OTP:', err);
    }
  };

  // Handle resend (with direct session)
  const handleResend = async () => {
    try {
      console.log('Resending code to email:', email);
      // Use the passed session directly
      const result = await resendVerificationCode(email, session);
      console.log('Resend result:', result);
    } catch (err) {
      console.error('Failed to resend code:', err);
    }
  };

  // Check if OTP is complete
  const isOtpComplete = otp.length === 6;

  return (
    <div className="w-full max-w-md mx-auto p-6 space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-medium tracking-tight">Check your email</h1>
        <p className="text-gray-500">We&apos;ve sent a code to {email}</p>
      </div>

      {error && <div className="text-red-500 text-sm text-center">{error}</div>}

      {!session && !error && verificationAttempted && (
        <div className="text-red-500 text-sm text-center">
          Session expired or not available. Please try again.
        </div>
      )}

      <div className="space-y-6">
        <div className="flex justify-center">
          <InputOTP value={otp} onChange={setOtp} maxLength={6} autoFocus>
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <div className="space-y-4">
          <Button onClick={handleSubmit} className="w-full" disabled={isLoading || !isOtpComplete}>
            {isLoading ? 'Verifying...' : 'Verify'}
          </Button>
          <Button
            variant="link"
            className="w-full text-gray-500"
            onClick={handleResend}
            disabled={isLoading}
          >
            Didn&apos;t receive a code? Click to resend
          </Button>
        </div>
      </div>
    </div>
  );
};
