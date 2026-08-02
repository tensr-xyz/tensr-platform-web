'use client';

import { useState } from 'react';
import {
  CreditCard,
  Shield,
  Check,
  Download,
  RefreshCw,
  AlertTriangle,
  Calendar,
  Clock,
} from 'lucide-react';
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
import { useBilling } from '@/hooks/api/use-billing';
import { Invoice } from '@/hooks/api/use-billing';
import posthog from 'posthog-js';

function PageHeader() {
  return (
    <div className="text-center">
      <h2 className="text-lg font-medium tracking-tight">Billing</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage your subscription plan and payment methods
      </p>
    </div>
  );
}

export default function BillingSettings() {
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancelInProgress, setCancelInProgress] = useState(false);

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
    openCustomerPortal,
  } = useBilling();

  const handleCancelSubscription = async () => {
    setCancelInProgress(true);
    setError(null);

    try {
      const success = await cancelSubscription();
      if (success) {
        posthog.capture('subscription_cancelled', {
          plan: subscription?.tier,
          billing_type: subscription?.billingType,
        });
        setIsCancelDialogOpen(false);
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
        return 'bg-muted text-muted-foreground border border-border';
      case 'TRIAL':
        return 'bg-blue-50 text-blue-700 border border-blue-200';
      default:
        return 'bg-muted text-muted-foreground border border-border';
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

  if (isLoading || !subscription) {
    return (
      <div className="space-y-6">
        <PageHeader />

        <section className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="border-b border-border px-6 py-4">
            <h3 className="text-base font-medium">Current Plan</h3>
            <p className="mt-1 text-sm text-muted-foreground">Your active subscription details</p>
          </div>
          <div className="space-y-4 p-6">
            <Skeleton className="h-16 w-full" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
            <Skeleton className="h-40 w-full" />
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="border-b border-border px-6 py-4">
            <h3 className="text-base font-medium">Billing History</h3>
            <p className="mt-1 text-sm text-muted-foreground">Past invoices and receipts</p>
          </div>
          <div className="p-6">
            <Skeleton className="h-40 w-full" />
          </div>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader />

        <section className="overflow-hidden rounded-lg border border-red-200 bg-red-50">
          <div className="p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <div>
                <h3 className="font-medium text-red-800">Error Loading Subscription Details</h3>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
            <Button onClick={handleRetry} className="mt-4" variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader />

      <section className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="border-b border-border px-6 py-4">
          <h3 className="text-base font-medium">Current Plan</h3>
          <p className="mt-1 text-sm text-muted-foreground">Your active subscription details</p>
        </div>

        <div className="p-6">
          <div className="mb-6 rounded-md border border-border p-4">
            <div className="flex items-center">
              <Shield className="mr-2 h-5 w-5" />
              <h4 className="text-sm font-medium">
                {subscription?.tier?.toUpperCase() || 'Free'} Plan
              </h4>
              <div className="ml-auto">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeClass(subscription?.status)}`}
                >
                  {subscription?.status?.toUpperCase() || 'FREE'}
                </span>
              </div>
            </div>
            {subscription?.status === 'active' && subscription?.renewalDate && (
              <p className="mt-2 text-sm text-muted-foreground">
                Your subscription will renew on {formatDate(subscription.renewalDate)}
              </p>
            )}
            {(subscription?.status === 'canceled' || subscription?.status === 'cancelled') &&
              subscription?.renewalDate && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Your subscription will end on {formatDate(subscription.renewalDate)}
                </p>
              )}
            {subscription?.status === 'trial' && subscription?.renewalDate && (
              <p className="mt-2 text-sm text-muted-foreground">
                Your trial will end on {formatDate(subscription.renewalDate)}
              </p>
            )}
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {subscription?.stripeSubscriptionId && (
              <div className="rounded-md border border-border bg-muted/30 p-4">
                <p className="text-xs font-medium text-muted-foreground">Subscription ID</p>
                <div className="mt-1 flex items-center">
                  <p className="font-mono text-xs">{subscription.stripeSubscriptionId}</p>
                  <button
                    className="ml-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      navigator.clipboard.writeText(subscription.stripeSubscriptionId);
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
            <div className="rounded-md border border-border bg-muted/30 p-4">
              <p className="text-xs font-medium text-muted-foreground">Subscription Type</p>
              <p className="mt-1 text-sm font-medium">
                {subscription?.billingType === 'monthly'
                  ? 'Monthly'
                  : subscription?.billingType === 'annual'
                    ? 'Annual'
                    : 'Unknown'}
                {subscription?.status === 'trial' ? ' Trial' : ''}
              </p>
            </div>
            {subscription?.startDate && (
              <div className="rounded-md border border-border bg-muted/30 p-4">
                <p className="text-xs font-medium text-muted-foreground">Start Date</p>
                <p className="mt-1 text-sm font-medium">{formatDate(subscription.startDate)}</p>
              </div>
            )}
            {subscription?.renewalDate && (
              <div className="rounded-md border border-border bg-muted/30 p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  {subscription?.status === 'canceled' || subscription?.status === 'cancelled'
                    ? 'End'
                    : 'Renewal'}{' '}
                  Date
                </p>
                <p className="mt-1 text-sm font-medium">{formatDate(subscription.renewalDate)}</p>
              </div>
            )}
          </div>

          {usageStats && (
            <div className="mb-6 rounded-md border border-border bg-muted/30 p-4">
              <div className="mb-2 flex justify-between">
                <p className="text-sm font-medium">AI requests this month</p>
                <p className="text-sm text-muted-foreground">
                  {usageStats.currentUsage || 0} /{' '}
                  {usageStats.limit === -1 || !usageStats.limit
                    ? '—'
                    : usageStats.limit.toLocaleString()}
                </p>
              </div>
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-blue-600"
                  style={{
                    width:
                      !usageStats.limit || usageStats.limit === -1
                        ? '5%'
                        : `${Math.min(100, usageStats.utilizationPercentage || 0)}%`,
                  }}
                ></div>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-md border border-border">
            <div className="border-b border-border bg-muted/30 px-4 py-2">
              <h4 className="text-sm font-medium">Plan Features</h4>
            </div>
            <div className="p-4">
              <ul className="space-y-2">
                {getCurrentTierFeatures().map((feature: string, index: number) => (
                  <li key={index} className="flex items-center text-sm">
                    <Check className="mr-2 h-4 w-4 flex-shrink-0 text-green-500" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-border bg-muted/30 px-6 py-4">
          <Button onClick={openCustomerPortal}>
            <CreditCard className="mr-2 h-4 w-4" />
            {subscription?.stripeCustomerId
              ? 'Manage Billing'
              : subscription?.status === 'active'
                ? 'Change Plan'
                : 'Upgrade Plan'}
          </Button>

          {subscription?.status === 'active' && !subscription?.stripeCustomerId && (
            <Button
              variant="outline"
              className="border-red-600 text-red-600 hover:bg-red-50"
              onClick={() => setIsCancelDialogOpen(true)}
            >
              Cancel Subscription
            </Button>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="border-b border-border px-6 py-4">
          <h3 className="text-base font-medium">Billing History</h3>
          <p className="mt-1 text-sm text-muted-foreground">Past invoices and receipts</p>
        </div>

        <div className="p-6">
          {!invoices || invoices.length === 0 ? (
            <div className="rounded-md border border-border py-8 text-center">
              <Calendar className="mx-auto mb-2 h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No billing history available yet</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted/30">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      Date
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      Description
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      Amount
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      Receipt
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-background">
                  {invoices.map((invoice: Invoice) => (
                    <tr key={invoice.invoiceId}>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                        {formatDate(invoice.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        {invoice.description ||
                          `${invoice.tier} Plan - ${invoice.billingType === 'monthly' ? 'Monthly' : 'Annual'} Subscription`}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                        <a
                          href={invoice.pdfUrl || `/api/billing/invoices/${invoice.invoiceId}/pdf`}
                          className="inline-flex items-center text-primary"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download className="mr-1 h-4 w-4" />
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
      </section>

      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel your subscription? You&apos;ll lose access to premium
              features at the end of your current billing period.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-yellow-100 bg-yellow-50 p-4">
            <div className="flex gap-3">
              <Clock className="h-5 w-5 flex-shrink-0 text-yellow-500" />
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
