'use client';
import { Button } from '@/components/atoms/button';
import { useRouter } from 'next/navigation';
import { Check, Download } from 'lucide-react';
import Image from 'next/image';
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/api/use-auth';
import Link from 'next/link';
import { devLog } from '@/lib/dev-log';

const PaymentSuccessPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<{
    tier: string;
    billingType: string;
    amount: number;
    nextBillingDate: string;
  } | null>(null);

  // Fetch subscription details on component mount
  useEffect(() => {
    const getSubscriptionDetails = async () => {
      if (!user) return;

      try {
        const response = await fetch('/api/subscription-details', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setSubscription(data.subscription);
        }
      } catch (error) {
        console.error('Failed to fetch subscription details:', error);
      }
    };

    getSubscriptionDetails();
  }, [user]);

  // Format date helper
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  return (
    <div className="flex flex-col justify-between max-w-xl items-center py-10 mx-auto min-h-screen border-x border-border">
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
        <div className="flex flex-col gap-10">
          <div className="flex flex-col items-center gap-4 px-10">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="h-8 w-8 text-green-600" />
            </div>

            <div className="text-2xl text-center">Payment Successful!</div>

            <p className="text-[rgba(29,42,41,0.65)] text-center">
              Thank you for your subscription. Your account has been upgraded.
            </p>
          </div>

          {subscription && (
            <div className="px-10">
              <div className="border rounded-md p-6 space-y-4">
                <div className="flex justify-between">
                  <div className="text-sm text-[rgba(29,42,41,0.65)]">Plan</div>
                  <div className="font-medium capitalize">{subscription.tier}</div>
                </div>

                <div className="flex justify-between">
                  <div className="text-sm text-[rgba(29,42,41,0.65)]">Billing Cycle</div>
                  <div className="font-medium capitalize">{subscription.billingType}</div>
                </div>

                <div className="flex justify-between">
                  <div className="text-sm text-[rgba(29,42,41,0.65)]">Amount</div>
                  <div className="font-medium">${subscription.amount}</div>
                </div>

                <div className="flex justify-between">
                  <div className="text-sm text-[rgba(29,42,41,0.65)]">Next billing date</div>
                  <div className="font-medium">{formatDate(subscription.nextBillingDate)}</div>
                </div>

                <div className="pt-4">
                  <Button
                    variant="outline"
                    className="w-full flex items-center justify-center gap-2"
                    onClick={() => {
                      // Logic to download invoice
                      devLog('Download invoice');
                    }}
                  >
                    <Download size={16} />
                    Download Invoice
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="px-10 flex flex-col gap-4">
            <Button className="w-full" onClick={() => router.push('/dashboard')}>
              Go to Dashboard
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push('/account/subscription')}
            >
              Manage Subscription
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-end w-full max-w-xl px-10">
        <div className="flex flex-row gap-4 text-sm w-full">
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

export default PaymentSuccessPage;
