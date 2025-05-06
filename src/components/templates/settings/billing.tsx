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
import { Card } from '@/components/atoms/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/molecules/dialog';
import { Skeleton } from '@/components/atoms/skeleton';
import { useBilling } from '@/hooks/api/use-billing';

export default function BillingSettings() {
  const router = useRouter();
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancelInProgress, setCancelInProgress] = useState(false);

  const {
    subscription,
    invoices,
    usageStats,
    isLoading,
    error,
    formatDate,
    formatCurrency,
    cancelSubscription,
  } = useBilling();

  const handleCancelSubscription = async () => {
    setCancelInProgress(true);

    try {
      const success = await cancelSubscription();
      if (success) {
        setIsCancelDialogOpen(false);
      }
    } finally {
      setCancelInProgress(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'PAST_DUE':
        return 'bg-yellow-100 text-yellow-800';
      case 'CANCELED':
        return 'bg-gray-100 text-gray-800';
      case 'TRIAL':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const tierFeatures: Record<string, string[]> = {
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
  };

  const getCurrentTierFeatures = () => {
    const tier = subscription?.tier?.toUpperCase() || 'FREE';
    return tierFeatures[tier] || tierFeatures.FREE;
  };

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Billing & Subscription</h1>
          <p className="text-gray-500">Manage your subscription plan and payment methods</p>
        </div>

        <div className="space-y-4">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Current Plan</h2>
            <div className="space-y-4">
              <Skeleton className="h-16 w-full" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
              <Skeleton className="h-40 w-full" />
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Billing History</h2>
            <Skeleton className="h-40 w-full" />
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Billing & Subscription</h1>
          <p className="text-gray-500">Manage your subscription plan and payment methods</p>
        </div>

        <Card className="p-6 bg-red-50 border border-red-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            <div>
              <h3 className="font-medium text-red-800">Error Loading Subscription Details</h3>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
          <Button onClick={() => window.location.reload()} className="mt-4" variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Page
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Billing & Subscription</h1>
        <p className="text-gray-500">Manage your subscription plan and payment methods</p>
      </div>

      {/* Current Plan */}
      <div className="mb-6">
        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Current Plan</h2>
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
              <div className="flex items-center">
                <Shield className="h-5 w-5 text-blue-500 mr-2" />
                <h3 className="text-lg font-medium text-blue-900">
                  {subscription?.tier || 'Free'} Plan
                </h3>
                <div className="ml-auto">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(subscription?.status || 'FREE')}`}
                  >
                    {subscription?.status || 'FREE'}
                  </span>
                </div>
              </div>
              {subscription?.status === 'ACTIVE' && subscription?.expiresAt && (
                <p className="mt-2 text-blue-700">
                  Your subscription will renew on {formatDate(subscription.expiresAt)}
                </p>
              )}
              {subscription?.status === 'CANCELED' && subscription?.expiresAt && (
                <p className="mt-2 text-blue-700">
                  Your subscription will end on {formatDate(subscription.expiresAt)}
                </p>
              )}
              {subscription?.status === 'TRIAL' && subscription?.expiresAt && (
                <p className="mt-2 text-blue-700">
                  Your trial will end on {formatDate(subscription.expiresAt)}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {subscription?.licenseKey && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">License Key</p>
                  <div className="flex items-center mt-1">
                    <p className="font-mono text-sm">{subscription.licenseKey}</p>
                    <button
                      className="ml-2 text-blue-600 text-xs hover:text-blue-800"
                      onClick={() => {
                        navigator.clipboard.writeText(subscription.licenseKey!);
                      }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500">Subscription Type</p>
                <p className="font-medium mt-1">
                  {subscription?.billingType === 'monthly' ? 'Monthly' : 'Annual'}
                  {subscription?.status === 'TRIAL' ? ' Trial' : ''}
                </p>
              </div>
              {subscription?.issuedAt && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Start Date</p>
                  <p className="font-medium mt-1">{formatDate(subscription.issuedAt)}</p>
                </div>
              )}
              {subscription?.expiresAt && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">
                    {subscription?.status === 'CANCELED' ? 'End' : 'Renewal'} Date
                  </p>
                  <p className="font-medium mt-1">{formatDate(subscription.expiresAt)}</p>
                </div>
              )}
            </div>

            {/* Usage overview when available */}
            {usageStats && (
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <div className="flex justify-between mb-2">
                  <p className="text-sm font-medium">Usage This Month</p>
                  <p className="text-sm text-gray-500">
                    {usageStats.currentUsage || 0} /{' '}
                    {usageStats.limit === -1 ? 'Unlimited' : usageStats.limit}
                  </p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full"
                    style={{
                      width:
                        usageStats.limit === -1
                          ? '5%'
                          : `${Math.min(100, (usageStats.currentUsage / usageStats.limit) * 100)}%`,
                    }}
                  ></div>
                </div>
              </div>
            )}

            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b">
                <h4 className="font-medium">Plan Features</h4>
              </div>
              <div className="p-4">
                <ul className="space-y-2">
                  {getCurrentTierFeatures().map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <Check className="h-4 w-4 text-green-500 mr-2" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-lg flex flex-wrap gap-3">
            <Link
              href="/settings/payment-methods"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Manage Payment Methods
            </Link>

            <Link
              href="/payment"
              className="inline-flex items-center px-4 py-2 border border-blue-600 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <ArrowUpRight className="h-4 w-4 mr-2" />
              {subscription?.status === 'ACTIVE' ? 'Change Plan' : 'Upgrade Plan'}
            </Link>

            {subscription?.status === 'ACTIVE' && (
              <Button
                variant="outline"
                className="border-red-600 text-red-600 hover:bg-red-50"
                onClick={() => setIsCancelDialogOpen(true)}
              >
                Cancel Subscription
              </Button>
            )}
          </div>
        </Card>
      </div>

      {/* Billing History */}
      <div>
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Billing History</h2>

          {invoices.length === 0 ? (
            <div className="text-center py-8 border rounded-lg">
              <Calendar className="h-10 w-10 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No billing history available yet</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
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
                  {invoices.map(invoice => (
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
                          href={`/billing/invoices/${invoice.invoiceId}/pdf`}
                          className="text-blue-600 hover:text-blue-900 inline-flex items-center"
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
        </Card>
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
          <div className="bg-yellow-50 p-4 rounded-md">
            <div className="flex gap-3">
              <Clock className="h-5 w-5 text-yellow-500 flex-shrink-0" />
              <p className="text-sm text-yellow-700">
                Your subscription will remain active until {formatDate(subscription?.expiresAt)},
                and you will not be charged again.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCancelDialogOpen(false)}
              disabled={cancelInProgress}
            >
              Keep Subscription
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={cancelInProgress}
            >
              {cancelInProgress ? 'Cancelling...' : 'Yes, Cancel Subscription'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
