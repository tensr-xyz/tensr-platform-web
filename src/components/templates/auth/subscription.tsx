'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Check } from 'lucide-react';
import {
  DEFAULT_SUBSCRIPTION_PRICING,
  DEFAULT_TEAM_SEATS,
  MAX_TEAM_SEATS,
  MIN_TEAM_SEATS,
  monthlyEquivalentRate,
  SUBSCRIPTION_PLAN_CARDS,
  SUBSCRIPTION_TIERS,
  unitPriceForBilling,
  type SubscriptionPlanCardMeta,
  type SubscriptionTier,
} from '@/configs/pricing';
import { Input } from '@/components/atoms/input';
import { useAuth } from '@/hooks/api/use-auth';
import Loading from '@/components/molecules/loading';
import Link from 'next/link';
import Image from 'next/image';
import { tensrApiUrl } from '@/lib/tensr-api-url';
import { hasActiveSubscription } from '@/lib/subscription';
import { useAuthStore } from '@/stores/auth-store';
import {
  SpssSwitcherSignupOption,
  setSpssSwitcherPrefs,
} from '@/components/templates/auth/spss-switcher-flow';

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

    const fallback = DEFAULT_PRICING[tierKey];
    mapped[tierKey] = {
      monthly,
      annual: monthlyEquivalentRate(monthly),
      description: fallback?.description || plan.description || `${plan.name || tierKey} tier`,
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

function annualTotal(monthlyEquivalent: number): number {
  return Math.round(monthlyEquivalent * 12);
}

function ctaLabelForPlan(
  plan: SubscriptionPlanCardMeta,
  currentPlan: SubscriptionTier | null,
  hasActivePlan: boolean
): string {
  if (currentPlan === plan.tier) return 'Current plan';
  if (hasActivePlan) return `Switch to ${plan.name === 'Pro Plus' ? 'Pro+' : plan.name}`;
  return plan.cta;
}

export default function SubscriptionCheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const postSubscriptionPath = returnTo && returnTo.startsWith('/') ? returnTo : '/dashboard';
  const { session, entitlements, isAuthReady, isLoading } = useAuth();
  const setEntitlements = useAuthStore(state => state.setEntitlements);

  const [billingType, setBillingType] = useState<'monthly' | 'annual'>('monthly');
  const [teamSeats, setTeamSeats] = useState(DEFAULT_TEAM_SEATS);
  const [loadingTier, setLoadingTier] = useState<SubscriptionTier | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pricingData, setPricingData] = useState<PricingData>(DEFAULT_PRICING);
  const [spssSwitcher, setSpssSwitcher] = useState(false);

  const currentPlan = entitlements?.plan_code ? PLAN_KEY_MAP[entitlements.plan_code] || null : null;
  const hasActivePlan =
    !!currentPlan && SUBSCRIPTION_TIERS.includes(currentPlan as SubscriptionTier);

  // Entitled users bounced here (login/gate with ?returnTo=) should continue into the app.
  // Bare /subscription without returnTo stays available for plan changes.
  useEffect(() => {
    if (!isAuthReady || isLoading) return;
    if (!returnTo || !returnTo.startsWith('/')) return;
    if (!hasActiveSubscription(entitlements)) return;
    router.replace(postSubscriptionPath);
  }, [isAuthReady, isLoading, returnTo, entitlements, router, postSubscriptionPath]);

  const validateSeats = (tier: SubscriptionTier) => {
    if (tier !== 'team') return true;
    if (teamSeats < MIN_TEAM_SEATS || teamSeats > MAX_TEAM_SEATS) {
      setErrors({
        teamSeats: `Enter between ${MIN_TEAM_SEATS} and ${MAX_TEAM_SEATS} seats`,
      });
      return false;
    }
    return true;
  };

  const persistSpssPrefsIfNeeded = () => {
    if (!spssSwitcher) return;
    setSpssSwitcherPrefs({
      enabled: true,
      checklist: { upload: false, frequencies: false, ttest: false, readOutput: false },
      dismissedWalkthrough: false,
    });
  };

  const startCheckout = async (tier: SubscriptionTier) => {
    if (currentPlan === tier) return;
    if (!validateSeats(tier)) return;

    setLoadingTier(tier);
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

      // Persist before Stripe redirect so prefs survive Hosted Checkout.
      persistSpssPrefsIfNeeded();

      const response = await fetch(tensrApiUrl('/api/billing/checkout-session'), {
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

      // Local/dev checkout activates immediately — apply entitlements before navigating
      // so SubscriptionGate does not bounce on stale plan_code: none.
      if (data.entitlements) {
        setEntitlements(data.entitlements);
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
      setLoadingTier(null);
    }
  };

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoadingPlans(true);
        const response = await fetch(tensrApiUrl('/api/billing/plans'));
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

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-8 md:px-8 md:pt-12">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link
            href={postSubscriptionPath}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={16} />
            Back
          </Link>
          <Link href={postSubscriptionPath}>
            <Image src="/tensr_logo_light.png" alt="Tensr" height={24} width={96} unoptimized />
          </Link>
        </div>

        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-xs tracking-wider text-muted-foreground uppercase">Pricing</p>
          <h1 className="text-3xl tracking-tight md:text-5xl">
            Pricing that scales with your research.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground md:text-base">
            Pro, Pro Plus, and Teams — upgrade when you need more agent capacity and collaboration.
            No free tier — a serious tool for serious work.
          </p>

          <div className="mt-8 flex justify-center">
            <div className="inline-flex items-center gap-1 rounded-full border border-border bg-muted p-1">
              <button
                type="button"
                onClick={() => setBillingType('monthly')}
                className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                  billingType === 'monthly'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingType('annual')}
                className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                  billingType === 'annual'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Annual <span className="ml-1 text-xs text-emerald-600">−20%</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-xl">
          <SpssSwitcherSignupOption checked={spssSwitcher} onCheckedChange={setSpssSwitcher} />
        </div>

        {loadingPlans ? (
          <div className="flex justify-center py-16">
            <Loading />
          </div>
        ) : (
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {SUBSCRIPTION_PLAN_CARDS.map(plan => {
              const tierPricing = pricingData[plan.tier] ?? DEFAULT_PRICING[plan.tier];
              const price = unitPriceForBilling(tierPricing, billingType);
              const period = plan.perSeat
                ? billingType === 'annual'
                  ? '/seat/mo · billed annually'
                  : '/seat/mo'
                : billingType === 'annual'
                  ? '/mo · billed annually'
                  : '/mo';
              const isCurrent = currentPlan === plan.tier;
              const isLoading = loadingTier === plan.tier;
              const label = ctaLabelForPlan(plan, currentPlan, hasActivePlan);
              const yearlyTotal = annualTotal(tierPricing.annual);

              return (
                <div
                  key={plan.tier}
                  className={`relative flex flex-col rounded-2xl border bg-background p-6 md:p-7 ${
                    plan.featured
                      ? 'border-foreground shadow-[0_0_0_1px_var(--foreground)]'
                      : 'border-border'
                  }`}
                >
                  {plan.featured && (
                    <span className="absolute -top-3 left-6 rounded-full bg-foreground px-3 py-0.5 text-xs font-medium text-background">
                      Most popular
                    </span>
                  )}
                  <h2 className="text-lg font-medium tracking-tight">{plan.name}</h2>
                  <p className="mt-2 min-h-[44px] text-sm leading-relaxed text-muted-foreground">
                    {plan.subtitle}
                  </p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-lg text-muted-foreground">$</span>
                    <span className="text-4xl tracking-tight">{price}</span>
                    <span className="text-sm text-muted-foreground">{period}</span>
                  </div>
                  {billingType === 'annual' && (
                    <p className="mt-1 text-xs text-muted-foreground/80">
                      ${yearlyTotal}
                      {plan.perSeat ? ' / seat' : ''} billed yearly
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground/80">{plan.note}</p>

                  {plan.perSeat && (
                    <div className="mt-4 space-y-2">
                      <label className="text-xs font-medium text-muted-foreground" htmlFor="seats">
                        Seats
                      </label>
                      <Input
                        id="seats"
                        type="number"
                        min={MIN_TEAM_SEATS}
                        max={MAX_TEAM_SEATS}
                        value={teamSeats}
                        onChange={e => {
                          const parsed = parseInt(e.target.value, 10);
                          setTeamSeats(Number.isFinite(parsed) ? parsed : MIN_TEAM_SEATS);
                          setErrors(prev => {
                            const next = { ...prev };
                            delete next.teamSeats;
                            return next;
                          });
                        }}
                      />
                      {errors.teamSeats ? (
                        <p className="text-sm text-red-600">{errors.teamSeats}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          ${price} × {teamSeats} seats = ${price * teamSeats}{' '}
                          {billingType === 'annual' ? '/mo billed annually' : '/mo'}
                        </p>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={isCurrent || !!loadingTier}
                    onClick={() => startCheckout(plan.tier)}
                    className={`mt-6 inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${
                      plan.featured
                        ? 'bg-foreground text-background'
                        : 'border border-border bg-muted text-foreground'
                    }`}
                  >
                    {isLoading ? 'Redirecting to Stripe…' : label}
                  </button>

                  <ul className="mt-8 space-y-3 border-t border-border pt-6">
                    {plan.features.map((feature, i) => (
                      <li key={feature} className="flex gap-3 text-sm text-muted-foreground">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                        <span className={i === 0 ? 'font-medium text-foreground' : ''}>
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        {errors.submission && (
          <div className="mx-auto mt-6 max-w-xl rounded-md bg-red-50 p-4 text-sm text-red-600">
            {errors.submission}
          </div>
        )}

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Change or cancel your plan at any time · checkout secured by Stripe
        </p>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Academic or custom enterprise plans?{' '}
          <a className="underline hover:text-foreground" href="mailto:help@tensr.xyz">
            Contact help@tensr.xyz
          </a>
        </p>
      </div>
    </div>
  );
}
