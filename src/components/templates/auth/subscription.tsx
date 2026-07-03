'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, ExternalLink } from 'lucide-react';
import {
  DEFAULT_SUBSCRIPTION_PRICING,
  DEFAULT_TEAM_SEATS,
  formatBillingCadence,
  MAX_TEAM_SEATS,
  MIN_TEAM_SEATS,
  monthlyEquivalentRate,
  SUBSCRIPTION_TIER_FEATURES,
  SUBSCRIPTION_TIER_LABELS,
  SUBSCRIPTION_TIERS,
  unitPriceForBilling,
  type SubscriptionTier,
} from '@/configs/pricing';
import { Input } from '@/components/atoms/input';
import { useAuth } from '@/hooks/api/use-auth';
import { Button } from '@/components/atoms/button';
import { Card } from '@/components/atoms/card';
import Loading from '@/components/molecules/loading';
import Link from 'next/link';
import Image from 'next/image';
import { decodeIdToken, getEligiblePlans, getIdToken } from '@/utils/auth';
import { getTensrApiBaseUrl } from '@/lib/tensr-api-url';
import {
  SpssSwitcherSignupOption,
  setSpssSwitcherPrefs,
} from '@/components/templates/auth/spss-switcher-flow';

const API_BASE_URL = getTensrApiBaseUrl();

interface PricingTier {
  monthly: number;
  annual: number;
  description: string;
}

interface PricingData {
  [key: string]: PricingTier;
}

const DEFAULT_PRICING: PricingData = DEFAULT_SUBSCRIPTION_PRICING;

const CHECKOUT_PLAN_TO_TIER: Record<string, SubscriptionTier> = {
  pro: 'pro',
  pro_plus: 'pro_plus',
  teams: 'team',
  professional: 'pro',
  team: 'team',
};

const PLAN_KEY_MAP: Record<string, SubscriptionTier> = {
  professional: 'pro',
  pro: 'pro',
  pro_plus: 'pro_plus',
  team: 'team',
  teams: 'team',
};

function subscriptionFeatureKey(tier: SubscriptionTier): keyof typeof SUBSCRIPTION_TIER_FEATURES {
  if (tier === 'pro_plus') return 'PRO_PLUS';
  if (tier === 'team') return 'TEAM';
  return 'PRO';
}

function monthlyPriceFromPlan(plan: {
  monthly_usd?: number;
  price_usd_month?: number;
  price_usd_per_seat_month?: number;
  monthlyPrice?: number;
}): number | null {
  if (typeof plan.monthly_usd === 'number') return plan.monthly_usd;
  if (typeof plan.price_usd_month === 'number') return plan.price_usd_month;
  if (typeof plan.price_usd_per_seat_month === 'number') return plan.price_usd_per_seat_month;
  if (typeof plan.monthlyPrice === 'number') return plan.monthlyPrice;
  return null;
}

function pricingFromApiPlans(plans: unknown[]): PricingData {
  const mapped: PricingData = {};

  for (const raw of plans) {
    if (!raw || typeof raw !== 'object') continue;
    const plan = raw as {
      code?: string;
      id?: string;
      name?: string;
      description?: string;
      operations?: number;
      monthly_usd?: number;
      price_usd_month?: number;
      price_usd_per_seat_month?: number;
      monthlyPrice?: number;
    };
    const backendCode = plan.code || plan.id;
    if (!backendCode) continue;

    const tierKey = CHECKOUT_PLAN_TO_TIER[backendCode];
    if (!tierKey) continue;

    const monthly = monthlyPriceFromPlan(plan);
    if (monthly == null) continue;

    mapped[tierKey] = {
      monthly,
      annual: monthlyEquivalentRate(monthly),
      description:
        plan.description ||
        `${plan.name || tierKey} tier${plan.operations ? ` with ${plan.operations} operations` : ''}`,
    };
  }

  return mapped;
}

function resolvePlanCode(tier: SubscriptionTier): 'pro' | 'pro_plus' | 'teams' | null {
  if (tier === 'pro') return 'pro';
  if (tier === 'pro_plus') return 'pro_plus';
  if (tier === 'team') return 'teams';
  return null;
}

export default function SubscriptionCheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const postSubscriptionPath = returnTo && returnTo.startsWith('/') ? returnTo : '/dashboard';
  const { session } = useAuth();

  const [tier, setTier] = useState<SubscriptionTier>('pro');
  const [billingType, setBillingType] = useState<'monthly' | 'annual'>('monthly');
  const [teamSeats, setTeamSeats] = useState(DEFAULT_TEAM_SEATS);
  const [loading, setLoading] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pricingData, setPricingData] = useState<PricingData>(DEFAULT_PRICING);
  const [eligibleFrontendPlans, setEligibleFrontendPlans] = useState<string[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [currentPlanStatus, setCurrentPlanStatus] = useState<string | null>(null);
  const [spssSwitcher, setSpssSwitcher] = useState(false);

  const selectedTierPricing = pricingData[tier] ?? DEFAULT_PRICING.pro;
  const unitPrice = unitPriceForBilling(selectedTierPricing, billingType);
  const billedSeats = tier === 'team' ? teamSeats : 1;
  const checkoutTotal = unitPrice * billedSeats;
  const priceLabel = formatBillingCadence(billingType, tier);
  const discount = billingType === 'annual' ? 'Save 20%' : '';

  const formatPlanAmount = () =>
    tier === 'team'
      ? `$${unitPrice} × ${billedSeats} seats = $${checkoutTotal} ${priceLabel}`
      : `$${unitPrice} ${priceLabel}`;

  const validateSelection = () => {
    const nextErrors: Record<string, string> = {};
    if (tier === 'team' && (teamSeats < MIN_TEAM_SEATS || teamSeats > MAX_TEAM_SEATS)) {
      nextErrors.teamSeats = `Enter between ${MIN_TEAM_SEATS} and ${MAX_TEAM_SEATS} seats`;
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const startCheckout = async () => {
    if (!validateSelection()) return;

    setLoading(true);
    setErrors({});

    try {
      const token = session?.sessionJwt;
      if (!token) {
        throw new Error('Sign in required to subscribe');
      }

      const plan_code = resolvePlanCode(tier);
      if (!plan_code) {
        throw new Error('Select a paid plan to continue');
      }

      const payload: {
        plan_code: string;
        billing_interval: 'monthly' | 'annual';
        seats?: number;
        return_to?: string;
      } = {
        plan_code,
        billing_interval: billingType === 'annual' ? 'annual' : 'monthly',
        return_to: postSubscriptionPath,
      };
      if (plan_code === 'teams') {
        payload.seats = teamSeats;
      }

      const response = await fetch(`${API_BASE_URL}/api/billing/checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const detail = errorData.detail;
        const message =
          typeof detail === 'string'
            ? detail
            : Array.isArray(detail)
              ? detail
                  .map((d: { msg?: string }) => d.msg)
                  .filter(Boolean)
                  .join(', ')
              : errorData.message;
        throw new Error(message || 'Could not start checkout');
      }

      const data = await response.json();

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }

      if (spssSwitcher) {
        setSpssSwitcherPrefs({
          enabled: true,
          checklist: { upload: false, frequencies: false, ttest: false, readOutput: false },
          dismissedWalkthrough: false,
        });
      }

      router.push(
        `${postSubscriptionPath}${postSubscriptionPath.includes('?') ? '&' : '?'}checkout=success`
      );
    } catch (error: unknown) {
      setErrors({
        submission:
          error instanceof Error ? error.message : 'An error occurred while starting checkout',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoadingPlans(true);
        const response = await fetch(`${API_BASE_URL}/api/billing/plans`);
        if (!response.ok) {
          throw new Error('Failed to fetch pricing plans');
        }
        const payload = await response.json();
        const plans = Array.isArray(payload) ? payload : (payload.plans ?? []);
        const apiPricing = pricingFromApiPlans(plans);
        setPricingData({ ...DEFAULT_PRICING, ...apiPricing });
      } catch (error) {
        console.error('Error fetching pricing plans:', error);
      } finally {
        setLoadingPlans(false);
      }
    };

    fetchPlans();
  }, []);

  useEffect(() => {
    const idToken = getIdToken();
    if (!idToken) return;

    const plans = getEligiblePlans(idToken);
    setEligibleFrontendPlans(plans.map(plan => PLAN_KEY_MAP[plan] || plan));

    const decoded = decodeIdToken(idToken);
    if (decoded) {
      setCurrentPlan(
        PLAN_KEY_MAP[decoded['custom:subscriptionTier']] ||
          decoded['custom:subscriptionTier'] ||
          null
      );
      setCurrentPlanStatus(decoded['custom:subscriptionStatus'] || null);
    }
  }, []);

  return (
    <div className="flex flex-col md:flex-row md:divide-x md:divide-border min-h-screen w-full">
      <div className="hidden md:flex md:flex-col md:w-2/5 md:px-16 md:py-32">
        <Link href={postSubscriptionPath}>
          <ArrowLeft className="mb-4" />
        </Link>
        <div className="text-xl">Choose a plan</div>
        <p className="mt-3 text-base text-gray-600">
          Pick your plan here, then complete payment on Stripe&apos;s secure checkout. Billing
          details and payment are handled by Stripe.
        </p>
        <div className="mt-8 rounded-md border border-border bg-gray-50 p-4 text-sm text-gray-700">
          <div className="font-medium">Selected</div>
          <div className="mt-2">{SUBSCRIPTION_TIER_LABELS[tier]}</div>
          <div className="mt-1 text-gray-600 capitalize">{billingType} billing</div>
          <div className="mt-3 font-medium">{formatPlanAmount()}</div>
        </div>
      </div>

      <div className="flex flex-col w-full md:w-3/5 px-4 py-6 md:px-16 md:py-32">
        <Link href={postSubscriptionPath}>
          <Image
            className="absolute top-6 left-6"
            src="/tensr_logo_light.png"
            alt="Tensr Logo"
            height={24}
            width={96}
            unoptimized
          />
        </Link>

        <div className="flex items-center mt-12 md:mt-0 md:hidden mb-6">
          <Link href={postSubscriptionPath} className="mr-4">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="text-lg font-medium">Choose a plan</div>
            <div className="text-sm text-gray-600">Secure checkout powered by Stripe</div>
          </div>
        </div>

        <div className="w-full max-w-xl mx-auto md:mx-0 space-y-6">
          <SpssSwitcherSignupOption checked={spssSwitcher} onCheckedChange={setSpssSwitcher} />

          <div className="space-y-2">
            <div className="text-base font-medium">Billing cycle</div>
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant={billingType === 'monthly' ? 'default' : 'outline'}
                className="h-10 md:h-12 justify-center"
                onClick={() => setBillingType('monthly')}
              >
                Monthly
              </Button>
              <Button
                variant={billingType === 'annual' ? 'default' : 'outline'}
                className="h-10 md:h-12 justify-center"
                onClick={() => setBillingType('annual')}
              >
                Annual {discount && <span className="ml-2 text-xs">{discount}</span>}
              </Button>
            </div>
          </div>

          {tier === 'team' && (
            <div className="space-y-2">
              <div className="text-base font-medium">Team seats</div>
              <Input
                type="number"
                min={MIN_TEAM_SEATS}
                max={MAX_TEAM_SEATS}
                value={teamSeats}
                onChange={e => {
                  const parsed = parseInt(e.target.value, 10);
                  setTeamSeats(Number.isFinite(parsed) ? parsed : MIN_TEAM_SEATS);
                }}
              />
              {errors.teamSeats ? (
                <p className="text-sm text-red-600">{errors.teamSeats}</p>
              ) : (
                <p className="text-sm text-[rgba(29,42,41,0.65)]">
                  ${unitPrice} per seat · ${checkoutTotal}{' '}
                  {formatBillingCadence(billingType, 'team')}. You can adjust seats again on Stripe
                  checkout.
                </p>
              )}
            </div>
          )}

          {loadingPlans ? (
            <div className="flex justify-center py-8">
              <Loading />
            </div>
          ) : (
            <div className="space-y-4">
              {SUBSCRIPTION_TIERS.map(planTier => {
                const tierPricing = pricingData[planTier] ?? DEFAULT_PRICING[planTier];
                const isEligible =
                  eligibleFrontendPlans.length === 0 || eligibleFrontendPlans.includes(planTier);
                const isDisabled = !isEligible;
                const isCurrent = currentPlan === planTier;
                const featureKey = subscriptionFeatureKey(planTier);

                return (
                  <Card
                    key={planTier}
                    className={`p-4 border-2 duration-100 ${
                      tier === planTier ? 'border-primary bg-primary/5' : 'border-gray-200'
                    } ${isDisabled ? 'opacity-50' : 'hover:border-black cursor-pointer'}`}
                    onClick={() => !isDisabled && setTier(planTier)}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <div className="text-lg font-medium">
                            {SUBSCRIPTION_TIER_LABELS[planTier]}
                          </div>
                          {!isEligible && (
                            <span className="text-xs bg-yellow-100 px-2 py-1 rounded-full">
                              Not Eligible
                            </span>
                          )}
                          {isCurrent && (
                            <span className="text-xs bg-blue-100 px-2 py-1 rounded-full">
                              Current Plan
                              {currentPlanStatus
                                ? ` (${currentPlanStatus.charAt(0).toUpperCase()}${currentPlanStatus.slice(1)})`
                                : ''}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-[rgba(29,42,41,0.65)] mt-1">
                          {tierPricing.description}
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="text-lg font-medium">
                          ${unitPriceForBilling(tierPricing, billingType)}
                        </div>
                        <div className="text-xs text-[rgba(29,42,41,0.65)]">
                          {formatBillingCadence(billingType, planTier)}
                        </div>
                      </div>
                    </div>

                    <div className="mb-4 space-y-2">
                      {SUBSCRIPTION_TIER_FEATURES[featureKey].slice(0, 3).map((feature, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Check className="text-primary" size={16} />
                          <span className="text-sm">{feature.text}</span>
                        </div>
                      ))}
                    </div>

                    <Button
                      variant={tier === planTier ? 'default' : 'outline'}
                      className="w-full"
                      disabled={isDisabled}
                      onClick={e => {
                        e.stopPropagation();
                        if (!isDisabled) setTier(planTier);
                      }}
                    >
                      {tier === planTier
                        ? 'Selected'
                        : isDisabled
                          ? 'Not Available'
                          : 'Select Plan'}
                      {tier === planTier && <Check className="ml-2" size={16} />}
                    </Button>
                  </Card>
                );
              })}

              <p className="text-sm text-center text-[rgba(29,42,41,0.65)]">
                Academic or custom enterprise plans?{' '}
                <a className="text-primary underline" href="mailto:help@tensr.xyz">
                  Contact help@tensr.xyz
                </a>
              </p>
            </div>
          )}

          <div className="rounded-md border border-border bg-gray-50 p-4">
            <div className="text-sm font-medium">Summary</div>
            <div className="mt-2 text-sm text-gray-700">{formatPlanAmount()}</div>
            <p className="mt-3 text-sm text-gray-600">
              You&apos;ll be redirected to Stripe to enter payment details. Taxes, invoices, and
              subscription management are handled securely by Stripe.
            </p>
          </div>

          {errors.submission && (
            <div className="text-red-500 text-sm bg-red-50 p-4 rounded-md">{errors.submission}</div>
          )}

          <Button
            onClick={startCheckout}
            disabled={loading || loadingPlans}
            className="w-full h-12 flex items-center justify-center gap-2"
          >
            {loading ? 'Redirecting to Stripe…' : 'Continue to Stripe Checkout'}
            {!loading && <ExternalLink size={16} />}
          </Button>
        </div>
      </div>
    </div>
  );
}
