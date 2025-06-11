'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CreditCard,
  Shield,
  Check,
  Download,
  RefreshCw,
  AlertTriangle,
  Calendar,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/atoms/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/molecules/dialog';
import { Skeleton } from '@/components/atoms/skeleton';
import { useBilling } from '@/hooks/api/use-billing'; // Import your existing hook
import { Subscription, Invoice } from '@/hooks/api/use-billing';

export default function BillingSettings() {
  const router = useRouter();
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancelInProgress, setCancelInProgress] = useState(false);

  // Use your actual billing hook
  const {
    subscription,
    invoices,
    usageStats,
    isLoading,
    error,
    setError,
    formatDate,
    formatCurrency,
    cancelSubscription,
    loadAllBillingData,
  } = useBilling();

  const handleCancelSubscription = async () => {
    setCancelInProgress(true);
    setError(null);

    try {
      const success = await cancelSubscription();
      if (success) {
        setIsCancelDialogOpen(false);
        // Data will be automatically refreshed by the hook
      }
    } catch (err: unknown) {
      console.error('Error cancelling subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
    } finally {
      setCancelInProgress(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    loadAllBillingData();
  };

  const getStatusBadgeClass = (status: string | undefined) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE':
        return 'bg-green-50 text-green-700 border border-green-200';
      case 'PAST_DUE':
        return 'bg-yellow-50 text-yellow-700 border border-yellow-200';
      case 'CANCELED':
      case 'CANCELLED':
        return 'bg-gray-50 text-gray-700 border border-gray-200';
      case 'TRIAL':
        return 'bg-blue-50 text-blue-700 border border-blue-200';
      default:
        return 'bg-gray-50 text-gray-700 border border-gray-200';
    }
  };

  const tierFeatures = {
    FREE: [
      'Basic access with limited operations',
      'Up to 2 devices',
      'Standard support',
      '0 days offline grace period',
    ],
    EDUCATION: [
      'Unlimited operations for educational use',
      'Up to 3 devices',
      'Standard support',
      '7 days offline grace period',
    ],
    PRO: [
      'Unlimited operations',
      'Up to 5 devices',
      'Priority support',
      'Advanced features',
      '14 days offline grace period',
    ],
    TEAM: [
      'Unlimited operations',
      'Up to 15 devices',
      'Priority support',
      'Advanced features & analytics',
      'Team management dashboard',
      '30 days offline grace period',
    ],
    ENTERPRISE: [
      'Unlimited operations',
      'Unlimited devices',
      'Dedicated support',
      'All features included',
      'Custom integrations',
      'SOC2 compliance',
      '60 days offline grace period',
    ],
  } as const;

  type TierType = keyof typeof tierFeatures;

  const getCurrentTierFeatures = () => {
    const tier = (subscription?.tier?.toUpperCase() || 'FREE') as TierType;
    return tierFeatures[tier] || tierFeatures.FREE;
  };

  // Show loading state OR if we don't have subscription data yet
  if (isLoading || !subscription) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-medium">Billing & Subscription</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage your subscription plan and payment methods
          </p>
        </div>

        <div className="space-y-6">
          <div className="border border-gray-200 rounded-md p-6 bg-white">
            <h2 className="text-lg font-medium mb-4">Current Plan</h2>
            <div className="space-y-4">
              <Skeleton className="h-16 w-full" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
              <Skeleton className="h-40 w-full" />
            </div>
          </div>

          <div className="border border-gray-200 rounded-md p-6 bg-white">
            <h2 className="text-lg font-medium mb-4">Billing History</h2>
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-medium">Billing & Subscription</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage your subscription plan and payment methods
          </p>
        </div>

        <div className="border border-red-200 rounded-md p-6 bg-red-50">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            <div>
              <h3 className="font-medium text-red-800">Error Loading Subscription Details</h3>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
          <Button onClick={handleRetry} className="mt-4" variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-medium">Billing & Subscription</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage your subscription plan and payment methods
        </p>
      </div>

      {/* Current Plan */}
      <div className="mb-6">
        <div className="border border-gray-200 rounded-md overflow-hidden bg-white">
          <div className="p-6">
            <h2 className="text-base font-medium mb-4">Current Plan</h2>
            <div className="border border-border rounded-md p-4 mb-6">
              <div className="flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                <h3 className="text-md font-medium">
                  {subscription?.tier?.toUpperCase() || 'Free'} Plan
                </h3>
                <div className="ml-auto">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(subscription?.status)}`}
                  >
                    {subscription?.status?.toUpperCase() || 'FREE'}
                  </span>
                </div>
              </div>
              {subscription?.status === 'active' && subscription?.renewalDate && (
                <p className="mt-2 text-sm">
                  Your subscription will renew on {formatDate(subscription.renewalDate)}
                </p>
              )}
              {(subscription?.status === 'canceled' || subscription?.status === 'cancelled') &&
                subscription?.renewalDate && (
                  <p className="mt-2 text-sm">
                    Your subscription will end on {formatDate(subscription.renewalDate)}
                  </p>
                )}
              {subscription?.status === 'trial' && subscription?.renewalDate && (
                <p className="mt-2 text-sm">
                  Your trial will end on {formatDate(subscription.renewalDate)}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {subscription?.stripeSubscriptionId && (
                <div className="bg-gray-50 p-4 rounded-md border border-gray-100">
                  <p className="text-xs text-gray-500 font-medium">Subscription ID</p>
                  <div className="flex items-center mt-1">
                    <p className="font-mono text-sm text-xs">{subscription.stripeSubscriptionId}</p>
                    <button
                      className="ml-2 text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(subscription.stripeSubscriptionId);
                      }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
              <div className="bg-gray-50 p-4 rounded-md border border-gray-100">
                <p className="text-xs text-gray-500 font-medium">Subscription Type</p>
                <p className="font-medium mt-1 text-sm">
                  {subscription?.billingType === 'monthly'
                    ? 'Monthly'
                    : subscription?.billingType === 'annual'
                      ? 'Annual'
                      : 'Unknown'}
                  {subscription?.status === 'trial' ? ' Trial' : ''}
                </p>
              </div>
              {subscription?.startDate && (
                <div className="bg-gray-50 p-4 rounded-md border border-gray-100">
                  <p className="text-xs text-gray-500 font-medium">Start Date</p>
                  <p className="font-medium mt-1 text-sm">{formatDate(subscription.startDate)}</p>
                </div>
              )}
              {subscription?.renewalDate && (
                <div className="bg-gray-50 p-4 rounded-md border border-gray-100">
                  <p className="text-xs text-gray-500 font-medium">
                    {subscription?.status === 'canceled' || subscription?.status === 'cancelled'
                      ? 'End'
                      : 'Renewal'}{' '}
                    Date
                  </p>
                  <p className="font-medium mt-1 text-sm">{formatDate(subscription.renewalDate)}</p>
                </div>
              )}
            </div>

            {/* Usage overview when available */}
            {usageStats && (
              <div className="bg-gray-50 p-4 rounded-md border border-gray-100 mb-6">
                <div className="flex justify-between mb-2">
                  <p className="text-sm font-medium">Usage This Month</p>
                  <p className="text-sm text-gray-500">
                    {usageStats.currentUsage || 0} /{' '}
                    {usageStats.limit === -1 ? 'Unlimited' : usageStats.limit}
                  </p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{
                      width:
                        usageStats.limit === -1
                          ? '5%'
                          : `${Math.min(100, usageStats.utilizationPercentage || 0)}%`,
                    }}
                  ></div>
                </div>
              </div>
            )}

            <div className="border border-gray-200 rounded-md overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <h4 className="font-medium text-sm">Plan Features</h4>
              </div>
              <div className="p-4">
                <ul className="space-y-2">
                  {getCurrentTierFeatures().map((feature: string, index: number) => (
                    <li key={index} className="flex items-center text-sm">
                      <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex flex-wrap gap-3">
            <Link
              href="/settings/payment-methods"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm text-gray-700 rounded-md hover:bg-gray-50"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Manage Payment Methods
            </Link>

            <Link
              href="/payment"
              className="inline-flex items-center px-4 py-2 border border-black bg-black text-sm text-white rounded-md hover:bg-gray-800"
            >
              <ArrowUpRight className="h-4 w-4 mr-2" />
              {subscription?.status === 'active' ? 'Change Plan' : 'Upgrade Plan'}
            </Link>

            {subscription?.status === 'active' && (
              <Button
                variant="outline"
                className="border-red-600 text-red-600 hover:bg-red-50 text-sm"
                onClick={() => setIsCancelDialogOpen(true)}
              >
                Cancel Subscription
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Billing History */}
      <div>
        <div className="border border-gray-200 rounded-md overflow-hidden bg-white">
          <div className="p-6">
            <h2 className="text-base font-medium mb-4">Billing History</h2>

            {!invoices || invoices.length === 0 ? (
              <div className="text-center py-8 border border-gray-200 rounded-md">
                <Calendar className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No billing history available yet</p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Date
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Description
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Amount
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Receipt
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {invoices.map((invoice: Invoice) => (
                      <tr key={invoice.invoiceId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(invoice.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {invoice.description ||
                            `${invoice.tier} Plan - ${invoice.billingType === 'monthly' ? 'Monthly' : 'Annual'} Subscription`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(invoice.amount, invoice.currency)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <a
                            href={
                              invoice.pdfUrl || `/api/billing/invoices/${invoice.invoiceId}/pdf`
                            }
                            className="text-primary inline-flex items-center"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Subscription Dialog */}
      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel your subscription? You&apos;ll lose access to premium
              features at the end of your current billing period.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-md">
            <div className="flex gap-3">
              <Clock className="h-5 w-5 text-yellow-500 flex-shrink-0" />
              <p className="text-sm text-yellow-700">
                {subscription?.renewalDate ? (
                  <>
                    Your subscription will remain active until{' '}
                    {formatDate(subscription.renewalDate)}, and you will not be charged again.
                  </>
                ) : (
                  <>
                    Your subscription will remain active until the end of your current billing
                    period, and you will not be charged again.
                  </>
                )}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCancelDialogOpen(false)}
              disabled={cancelInProgress}
              className="border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Keep Subscription
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={cancelInProgress}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {cancelInProgress ? 'Cancelling...' : 'Yes, Cancel Subscription'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
