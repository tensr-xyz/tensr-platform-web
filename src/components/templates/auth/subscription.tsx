'use client';

import { FloatingLabelInput } from '@/components/molecules/floating-label-input';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LuCheck, LuInfo, LuDownload, LuSettings, LuArrowRight } from 'react-icons/lu';
import { TIER_FEATURES, TierType } from '@/configs/pricing';
import { useAuth } from '@/hooks/api/use-auth';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { useStripe, useElements, Elements, PaymentElement } from '@stripe/react-stripe-js';
import {
  Progress,
  ProgressStep,
  ProgressStepDuration,
  ProgressSteps,
  ProgressStepTitle,
} from '@/components/molecules/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { Button } from '@/components/atoms/button';
import { Card } from '@/components/atoms/card';
import Loading from '@/components/molecules/loading';
import Link from 'next/link';
import { ArrowLeft, Mail } from 'lucide-react';
import Image from 'next/image';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// Initialize Stripe with your publishable key
const stripePromise = loadStripe(
  'pk_test_51RJir9H0hCtrU4vjrozMaXHylofcF5n4LvJNL0XyqmfdjphtCPfPcYlpVcdFGG5SlKyJpRMRdp9C5XLbehivEngh00ntTQEOrt'
);

// Create a wrapper component to provide Stripe context
const PaymentPageWithStripe = () => {
  const appearance = {
    theme: 'stripe' as const,
    variables: {
      colorPrimary: '#0050d8',
      colorBackground: '#ffffff',
      colorText: '#424770',
      colorDanger: '#e25950',
      fontFamily: 'system-ui, sans-serif',
      spacingUnit: '4px',
      borderRadius: '4px',
    },
  };

  // Setup mode - no client secret needed initially
  const options: StripeElementsOptions = {
    mode: 'setup',
    currency: 'usd',
    appearance,
    paymentMethodCreation: 'manual',
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <PaymentPage />
    </Elements>
  );
};

// Define step configuration type
interface StepConfig {
  id: string;
  title: string;
  duration: string;
  required: string[];
}

// Define form data type
interface FormData {
  tier: TierType;
  billingType: 'monthly' | 'annual';
  name: string;
  email: string;
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingZip: string;
  billingCountry: string;
}

// Define pricing data type
interface PricingTier {
  monthly: number;
  annual: number;
  description: string;
}

interface PricingData {
  [key: string]: PricingTier;
}

// Define subscription details type
interface SubscriptionDetails {
  tier: TierType;
  billingType: 'monthly' | 'annual';
  amount: number;
  nextBillingDate: Date;
  subscriptionId: string;
}

// Define PaymentPage props
interface PaymentPageProps {
  setClientSecret: (secret: string) => void;
}

const PaymentPage = () => {
  const router = useRouter();
  const { user, tokens } = useAuth();
  const stripe = useStripe();
  const elements = useElements();

  // Configuration
  const steps: StepConfig[] = [
    {
      id: 'plan',
      title: 'Choose Plan',
      duration: '~1 minute',
      required: ['tier', 'billingType'],
    },
    {
      id: 'billing',
      title: 'Billing Details',
      duration: '~2 minutes',
      required: [
        'name',
        'email',
        'billingAddress',
        'billingCity',
        'billingState',
        'billingZip',
        'billingCountry',
      ],
    },
    {
      id: 'payment',
      title: 'Payment Method',
      duration: '~1 minute',
      required: [],
    },
    {
      id: 'review',
      title: 'Review & Confirm',
      duration: '~1 minute',
      required: [],
    },
    {
      id: 'success',
      title: 'Confirmation',
      duration: '',
      required: [],
    },
  ];

  // State
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetails | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [paymentIntentData, setPaymentIntentData] = useState<any>(null);
  const [paymentElementReady, setPaymentElementReady] = useState(false);
  const [paymentValid, setPaymentValid] = useState(false);

  // Get user name and email from user object or use empty string if not available
  const userName = user?.email?.split('@')[0] || '';
  const userEmail = user?.email || '';

  // Form Data
  const [formData, setFormData] = useState<FormData>({
    // Plan selection
    tier: 'pro' as TierType,
    billingType: 'monthly' as 'monthly' | 'annual',

    // Billing information
    name: userName,
    email: userEmail,
    billingAddress: '',
    billingCity: '',
    billingState: '',
    billingZip: '',
    billingCountry: '',
  });

  // Pricing information
  const [pricingData, setPricingData] = useState<PricingData>({
    education: { monthly: 0, annual: 0, description: 'For students and academics' },
    pro: { monthly: 20, annual: 200, description: 'For individual professionals' },
    team: { monthly: 99, annual: 990, description: 'For teams up to 5 users' },
    enterprise: { monthly: 249, annual: 2490, description: 'For larger organizations' },
  });

  // Calculate current price based on selected tier and billing type
  const currentPrice = pricingData[formData.tier][formData.billingType];
  const discount = formData.billingType === 'annual' ? 'Save 20%' : '';

  // Get price display for header
  const getPriceDisplay = () => {
    if (formData.tier === 'education') return 'Free';
    if (formData.tier === 'enterprise') return 'Contact for pricing';
    return `$${currentPrice} ${formData.billingType === 'monthly' ? '/month' : '/year'}`;
  };

  // Input handlers
  const handleInputChange = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData(prev => {
      const newData = { ...prev };
      newData[field] = value;
      return newData;
    });

    // Clear error when field is updated
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Handle plan selection with direct navigation for enterprise
  const handlePlanSelect = (tier: TierType) => {
    handleInputChange('tier', tier);

    // For enterprise, show contact modal/redirect immediately
    if (tier === 'enterprise') {
      window.location.href = 'mailto:help@tensr.xyz?subject=Enterprise Plan Inquiry';
      return;
    }

    // For other plans, proceed to next step after selection
    setTimeout(() => {
      setCurrentStep(1);
    }, 100);
  };

  // Validate current step
  const validateStep = (stepIndex: number) => {
    const currentStepConfig = steps[stepIndex];
    const newErrors: Record<string, string> = {};

    currentStepConfig.required.forEach(field => {
      if (!formData[field as keyof FormData] || formData[field as keyof FormData] === '') {
        newErrors[field] = 'This field is required';
      }
    });

    // For the payment step, check if payment element is ready
    if (stepIndex === 2) {
      // Check for payment element readiness (only if not free tier)
      if (!paymentIntentData) {
        newErrors.submission = 'Payment is being prepared, please wait';
      } else if (paymentIntentData.intentType !== 'none' && !paymentElementReady) {
        newErrors.submission = 'Please complete payment details';
      } else {
        // If we're validating the payment step and everything is good,
        // mark payment as valid for direct submission
        setPaymentValid(true);
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Navigation handlers
  const handleNext = () => {
    if (validateStep(currentStep)) {
      // Skip payment flow if enterprise is selected
      if (formData.tier === 'enterprise') {
        window.location.href = 'mailto:help@tensr.xyz?subject=Enterprise Plan Inquiry';
        return;
      }

      // If we're on the payment step (step 2), process payment directly
      if (currentStep === 2) {
        handleSubmit();
        return;
      }

      // Normal flow for other steps
      if (currentStep < steps.length - 2) {
        setCurrentStep(prev => prev + 1);
      } else if (currentStep === steps.length - 2) {
        handleSubmit();
      } else {
        // Handle navigation from success screen
        router.push('/');
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0 && currentStep < steps.length - 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  // Format date helper
  const formatDate = (dateString: Date | string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  useEffect(() => {
    if (currentStep === 2) {
      checkPlanType();
    }
  }, [currentStep]);

  const checkPlanType = async () => {
    // Only check if it's a free plan, don't create any intents
    if (formData.tier === 'education') {
      setPaymentIntentData({ intentType: 'none' });
    } else {
      setPaymentIntentData({ intentType: 'subscription' });
    }
    setPaymentElementReady(true);
  };

  // Payment submission
  const handleSubmit = async () => {
    setLoading(true);

    try {
      if (!stripe || !elements) {
        throw new Error('Stripe has not been initialized');
      }

      // Handle free tier
      if (formData.tier === 'education') {
        // Create free subscription directly
        const response = await fetch(`${API_BASE_URL}/billing/create-subscription`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokens?.idToken}`,
          },
          body: JSON.stringify({
            tier: formData.tier,
            billingType: formData.billingType,
            paymentMethodId: null, // No payment method for free tier
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Error creating subscription');
        }

        const data = await response.json();
        setSubscriptionDetails({
          tier: formData.tier,
          billingType: formData.billingType,
          amount: 0,
          nextBillingDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          subscriptionId: data.subscriptionId,
        });

        setCurrentStep(steps.length - 1);
        return;
      }

      // For paid plans - follow Stripe docs exactly

      // Step 1: Submit the payment element
      const { error: submitError } = await elements.submit();
      if (submitError) {
        throw new Error(submitError.message);
      }

      // Step 2: Create payment method (from Stripe docs)
      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        elements,
      });

      if (pmError) {
        throw new Error(pmError.message);
      }

      console.log('Payment method created:', paymentMethod);

      // Step 3: Create subscription on backend (from Stripe docs)
      const response = await fetch(`${API_BASE_URL}/billing/create-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens?.idToken}`,
        },
        body: JSON.stringify({
          paymentMethodId: paymentMethod.id,
          tier: formData.tier,
          billingType: formData.billingType,
          customerId: paymentMethod.customer, // If you have a customer
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error creating subscription');
      }

      const subscriptionData = await response.json();
      console.log('Subscription created:', subscriptionData);

      // Step 4: Handle authentication if required (from Stripe docs)
      if (
        subscriptionData.status === 'incomplete' &&
        subscriptionData.latest_invoice?.payment_intent
      ) {
        const { error: confirmError } = await stripe.confirmPayment({
          clientSecret: subscriptionData.latest_invoice.payment_intent.client_secret,
          confirmParams: {
            return_url: window.location.origin + '/payment/success',
          },
          redirect: 'if_required',
        });

        if (confirmError) {
          throw new Error(confirmError.message);
        }
      }

      // Success!
      setSubscriptionDetails({
        tier: formData.tier,
        billingType: formData.billingType,
        amount: currentPrice,
        nextBillingDate: new Date(
          Date.now() + (formData.billingType === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000
        ),
        subscriptionId: subscriptionData.id,
      });

      setCurrentStep(steps.length - 1);
    } catch (error: unknown) {
      console.error('Payment error:', error);
      setErrors({
        submission:
          error instanceof Error ? error.message : 'An error occurred during payment processing',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoadingPlans(true);
        const response = await fetch(`${API_BASE_URL}/billing/plans`);

        if (!response.ok) {
          throw new Error('Failed to fetch pricing plans');
        }

        const plans = await response.json();

        // Transform the backend plans format to match our frontend format
        const transformedPlans: PricingData = {};

        plans.forEach((plan: any) => {
          transformedPlans[plan.id] = {
            monthly: plan.monthlyPrice,
            annual: plan.monthlyPrice * 12 * 0.8, // Apply 20% discount for annual
            description: plan.description || `${plan.name} tier with ${plan.operations} operations`,
          };
        });

        console.log('Fetched pricing plans:', transformedPlans);
        setPricingData(transformedPlans);
      } catch (error) {
        console.error('Error fetching pricing plans:', error);
        // Keep the default pricing if there's an error
      } finally {
        setLoadingPlans(false);
      }
    };

    fetchPlans();
  }, []);

  // Render methods for each step
  const renderPlanSelection = () => (
    <div className="space-y-6">
      <div className="text-xl md:text-2xl">Choose Your Plan</div>

      <div className="space-y-2 mb-6">
        <div className="text-base font-medium">Billing Cycle</div>
        <div className="grid grid-cols-2 gap-4">
          <Button
            variant={formData.billingType === 'monthly' ? 'default' : 'outline'}
            className="h-10 md:h-12 justify-center"
            onClick={() => handleInputChange('billingType', 'monthly')}
          >
            Monthly
          </Button>
          <Button
            variant={formData.billingType === 'annual' ? 'default' : 'outline'}
            className="h-10 md:h-12 justify-center"
            onClick={() => handleInputChange('billingType', 'annual')}
          >
            Annual {discount && <span className="ml-2 text-xs">{discount}</span>}
          </Button>
        </div>
      </div>

      {loadingPlans ? (
        <div className="flex justify-center py-8">
          <div className="text-center">
            <div className="mb-2">
              <Loading />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.keys(pricingData).map(tier => (
            <Card
              key={tier}
              className={`p-4 border-2 hover:border-black cursor-pointer duration-100 ${
                formData.tier === tier ? 'border-primary bg-primary/5' : 'border-gray-200'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-medium capitalize">{tier}</div>
                    {pricingData[tier].monthly === 0 && (
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">Free</span>
                    )}
                  </div>
                  <div className="text-sm text-[rgba(29,42,41,0.65)] mt-1">
                    {pricingData[tier].description}
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <div className="text-lg font-medium">
                    {tier === 'enterprise'
                      ? 'Custom'
                      : pricingData[tier].monthly === 0
                        ? 'Free'
                        : `$${pricingData[tier][formData.billingType]}`}
                  </div>
                  <div className="text-xs text-[rgba(29,42,41,0.65)]">
                    {tier === 'enterprise'
                      ? 'Contact for pricing'
                      : pricingData[tier].monthly > 0 && formData.billingType === 'monthly'
                        ? 'per month'
                        : pricingData[tier].monthly > 0
                          ? 'per year'
                          : ''}
                  </div>
                </div>
              </div>

              {/* Feature highlights */}
              <div className="mb-4 space-y-2">
                {(TIER_FEATURES[tier.toUpperCase() as keyof typeof TIER_FEATURES] || [])
                  .slice(0, 3)
                  .map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <LuCheck className="text-primary" size={16} />
                      <span className="text-sm">{feature.text}</span>
                    </div>
                  ))}
              </div>

              {/* Action Button */}
              <div className="mt-4">
                {tier === 'enterprise' ? (
                  <Button
                    variant="outline"
                    className="w-full flex items-center justify-center gap-2"
                    onClick={e => {
                      e.stopPropagation();
                      window.location.href =
                        'mailto:help@tensr.xyz?subject=Enterprise Plan Inquiry';
                    }}
                  >
                    <Mail size={16} />
                    Contact Sales
                  </Button>
                ) : (
                  <Button
                    variant={formData.tier === tier ? 'default' : 'outline'}
                    className="w-full"
                    onClick={() => handlePlanSelect(tier as TierType)}
                  >
                    {formData.tier === tier ? 'Selected' : 'Select Plan'}
                    {formData.tier === tier && <LuCheck className="ml-2" size={16} />}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderBillingInformation = () => (
    <div className="space-y-6">
      <div className="text-xl md:text-2xl">Billing Information</div>

      <div className="grid gap-4">
        {/* Contact Information - Full width */}
        <FloatingLabelInput
          label="Full Name"
          value={formData.name}
          onChange={e => handleInputChange('name', e.target.value)}
          inputClassName="focus:ring-black"
          focusedLabelClassName="text-black"
          labelClassName="text-[rgba(29,42,41,0.65)]"
        />

        <FloatingLabelInput
          label="Email Address"
          value={formData.email}
          onChange={e => handleInputChange('email', e.target.value)}
          inputClassName="focus:ring-black"
          focusedLabelClassName="text-black"
          labelClassName="text-[rgba(29,42,41,0.65)]"
          type="email"
        />

        {/* Address - Full width */}
        <FloatingLabelInput
          label="Billing Address"
          value={formData.billingAddress}
          onChange={e => handleInputChange('billingAddress', e.target.value)}
          inputClassName="focus:ring-black"
          focusedLabelClassName="text-black"
          labelClassName="text-[rgba(29,42,41,0.65)]"
        />

        {/* City and State - 2 columns on mobile and desktop */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <FloatingLabelInput
            label="City"
            value={formData.billingCity}
            onChange={e => handleInputChange('billingCity', e.target.value)}
            inputClassName="focus:ring-black"
            focusedLabelClassName="text-black"
            labelClassName="text-[rgba(29,42,41,0.65)]"
          />

          <FloatingLabelInput
            label="State/Province"
            value={formData.billingState}
            onChange={e => handleInputChange('billingState', e.target.value)}
            inputClassName="focus:ring-black"
            focusedLabelClassName="text-black"
            labelClassName="text-[rgba(29,42,41,0.65)]"
          />
        </div>

        {/* Postal Code and Country - 2 columns with responsive sizing */}
        <div className="grid grid-cols-5 gap-3 sm:gap-4">
          <div className="col-span-2">
            <FloatingLabelInput
              label="Postal Code"
              value={formData.billingZip}
              onChange={e => handleInputChange('billingZip', e.target.value)}
              inputClassName="focus:ring-black"
              focusedLabelClassName="text-black"
              labelClassName="text-[rgba(29,42,41,0.65)]"
            />
          </div>

          <div className="col-span-3">
            <Select
              value={formData.billingCountry}
              onValueChange={value => handleInputChange('billingCountry', value)}
            >
              <SelectTrigger className="h-16">
                <SelectValue placeholder="Select Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="US">United States</SelectItem>
                <SelectItem value="CA">Canada</SelectItem>
                <SelectItem value="GB">United Kingdom</SelectItem>
                <SelectItem value="AU">Australia</SelectItem>
                <SelectItem value="DE">Germany</SelectItem>
                <SelectItem value="FR">France</SelectItem>
                <SelectItem value="JP">Japan</SelectItem>
                <SelectItem value="IN">India</SelectItem>
                <SelectItem value="BR">Brazil</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
            {errors.billingCountry && (
              <div className="text-red-500 text-sm mt-1">{errors.billingCountry}</div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 bg-gray-50 rounded-md">
        <div className="flex items-center justify-between">
          <div className="text-base font-medium">Plan Summary</div>
          <div className="text-sm text-primary cursor-pointer" onClick={() => setCurrentStep(0)}>
            Change
          </div>
        </div>
        <div className="mt-2 space-y-1">
          <div className="flex justify-between text-sm">
            <span>Selected Plan:</span>
            <span className="font-medium capitalize">{formData.tier}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Billing Cycle:</span>
            <span className="font-medium capitalize">{formData.billingType}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Amount:</span>
            <span className="font-medium">
              ${pricingData[formData.tier][formData.billingType]}{' '}
              {formData.billingType === 'monthly' ? '/month' : '/year'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPaymentMethod = () => (
    <div className="space-y-6">
      <div className="text-xl md:text-2xl">Payment Method</div>

      <div className="border border-border rounded-md p-4">
        <label className="block text-sm font-medium mb-2">Payment Details</label>
        {elements && (
          <PaymentElement
            id="payment-element"
            options={{
              layout: {
                type: 'tabs',
                defaultCollapsed: false,
              },
            }}
            onReady={() => {
              console.log('PaymentElement is ready');
              setPaymentElementReady(true);
            }}
          />
        )}
        {errors.submission && <div className="text-red-500 text-sm mt-2">{errors.submission}</div>}
      </div>

      <div className="flex items-center gap-2 text-sm p-4 bg-gray-50 rounded-md mt-4">
        <LuInfo size={16} className="text-gray-500 flex-shrink-0" />
        <span>
          By clicking &quot;Subscribe Now&quot;, you&apos;ll be subscribed to the ${currentPrice}{' '}
          {formData.billingType === 'monthly' ? 'monthly' : 'annual'} plan. You can cancel anytime.
        </span>
      </div>

      <div className="p-4 bg-gray-50 rounded-md">
        <div className="flex items-center justify-between">
          <div className="text-base font-medium">Plan Summary</div>
          <div className="text-sm text-primary cursor-pointer" onClick={() => setCurrentStep(1)}>
            Change
          </div>
        </div>
        <div className="mt-2 space-y-1">
          <div className="flex justify-between text-sm">
            <span>Plan:</span>
            <span className="font-medium capitalize">
              {formData.tier} ({formData.billingType})
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Amount:</span>
            <span className="font-medium">
              ${pricingData[formData.tier][formData.billingType]}{' '}
              {formData.billingType === 'monthly' ? '/month' : '/year'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderReview = () => (
    <div className="space-y-6">
      <div className="text-xl md:text-2xl">Review & Confirm</div>
      <p className="text-sm md:text-base text-gray-600">
        Please review all information before confirming your subscription.
      </p>

      <div className="space-y-4">
        <Card className="p-4">
          <div className="text-lg font-medium mb-3">Plan Details</div>
          <div className="space-y-2">
            <div className="grid grid-cols-2">
              <div className="text-sm font-medium">Plan:</div>
              <div className="text-sm capitalize">{formData.tier}</div>
            </div>
            <div className="grid grid-cols-2">
              <div className="text-sm font-medium">Billing Cycle:</div>
              <div className="text-sm capitalize">{formData.billingType}</div>
            </div>
            <div className="grid grid-cols-2">
              <div className="text-sm font-medium">Price:</div>
              <div className="text-sm">
                ${pricingData[formData.tier][formData.billingType]}{' '}
                {formData.billingType === 'monthly' ? '/month' : '/year'}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-lg font-medium mb-3">Billing Information</div>
          <div className="space-y-2">
            <div className="grid grid-cols-2">
              <div className="text-sm font-medium">Name:</div>
              <div className="text-sm break-words">{formData.name}</div>
            </div>
            <div className="grid grid-cols-2">
              <div className="text-sm font-medium">Email:</div>
              <div className="text-sm break-words">{formData.email}</div>
            </div>
            <div className="grid grid-cols-2">
              <div className="text-sm font-medium">Address:</div>
              <div className="text-sm break-words">{formData.billingAddress}</div>
            </div>
            <div className="grid grid-cols-2">
              <div className="text-sm font-medium">City:</div>
              <div className="text-sm">{formData.billingCity}</div>
            </div>
            <div className="grid grid-cols-2">
              <div className="text-sm font-medium">State/Province:</div>
              <div className="text-sm">{formData.billingState}</div>
            </div>
            <div className="grid grid-cols-2">
              <div className="text-sm font-medium">Postal Code:</div>
              <div className="text-sm">{formData.billingZip}</div>
            </div>
            <div className="grid grid-cols-2">
              <div className="text-sm font-medium">Country:</div>
              <div className="text-sm">{formData.billingCountry}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-lg font-medium mb-3">Payment Method</div>
          <div className="space-y-2">
            <div className="grid grid-cols-2">
              <div className="text-sm font-medium">Card:</div>
              <div className="text-sm">Credit/Debit Card (Processed securely via Stripe)</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
        <p className="text-sm text-gray-700">
          By clicking &quot;Confirm Payment&quot;, you authorize us to charge your card for the
          amount shown. Your subscription will begin immediately.
        </p>
      </div>

      {errors.submission && (
        <div className="text-red-500 text-sm bg-red-50 p-4 rounded-md">{errors.submission}</div>
      )}
    </div>
  );

  const renderSuccess = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
          <LuCheck className="h-6 w-6 text-green-600" />
        </div>
        <div className="text-xl md:text-2xl">Payment Successful!</div>
      </div>

      <p className="text-sm md:text-base text-gray-600">
        Thank you for your subscription! Your account has been successfully upgraded and you now
        have access to all the features included in your plan.
      </p>

      <Card className="p-4">
        <div className="text-lg font-medium mb-3">Subscription Details</div>
        <div className="space-y-3">
          <div className="grid grid-cols-2">
            <div className="text-sm font-medium">Plan:</div>
            <div className="text-sm capitalize break-words">
              {subscriptionDetails?.tier || formData.tier}
            </div>
          </div>
          <div className="grid grid-cols-2">
            <div className="text-sm font-medium">Billing Cycle:</div>
            <div className="text-sm capitalize">
              {subscriptionDetails?.billingType || formData.billingType}
            </div>
          </div>
          <div className="grid grid-cols-2">
            <div className="text-sm font-medium">Amount:</div>
            <div className="text-sm">
              ${subscriptionDetails?.amount || currentPrice}{' '}
              {(subscriptionDetails?.billingType || formData.billingType) === 'monthly'
                ? '/month'
                : '/year'}
            </div>
          </div>
          <div className="grid grid-cols-2">
            <div className="text-sm font-medium">Next Billing Date:</div>
            <div className="text-sm">
              {subscriptionDetails?.nextBillingDate
                ? formatDate(subscriptionDetails.nextBillingDate)
                : formatDate(
                    new Date(
                      Date.now() +
                        (formData.billingType === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000
                    )
                  )}
            </div>
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-3 mt-4">
        <Button
          variant="outline"
          className="flex items-center justify-center gap-2"
          onClick={() => {
            // Logic to download invoice
            console.log('Download invoice');
          }}
        >
          <LuDownload size={16} />
          <span className="text-sm md:text-base">Download Invoice</span>
        </Button>

        <Button
          variant="outline"
          className="flex items-center justify-center gap-2"
          onClick={() => router.push('/settings/billing')}
        >
          <LuSettings size={16} />
          <span className="text-sm md:text-base">Manage Subscription</span>
        </Button>
      </div>
    </div>
  );

  // Mobile Step Indicator component
  const renderMobileStepIndicator = () => (
    <div className="sm:hidden mb-6">
      <div className="flex justify-between items-center mb-2">
        <div className="text-sm font-medium">
          Step {currentStep + 1} of {steps.length - 1}: {steps[currentStep].title}
        </div>
        <div className="text-xs text-gray-500">{steps[currentStep].duration}</div>
      </div>
      <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 ease-in-out"
          style={{ width: `${((currentStep + 1) / (steps.length - 1)) * 100}%` }}
        ></div>
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderPlanSelection();
      case 1:
        return renderBillingInformation();
      case 2:
        return renderPaymentMethod();
      case 3:
        return renderReview();
      case 4:
        return renderSuccess();
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col md:flex-row md:divide-x md:divide-border min-h-screen w-full">
      {/* Left sidebar with progress - Only visible on desktop */}
      <div className="hidden md:flex md:flex-col md:w-2/5 md:px-16 md:py-32">
        <div className="mb-8">
          <Link href="/">
            <ArrowLeft className="mb-4" />
          </Link>
          <div className="text-xl">Subscription Plan</div>
          <div className="text-base text-gray-600">{getPriceDisplay()}</div>
        </div>

        <Progress>
          <ProgressSteps>
            {steps.map((step, index) => (
              <ProgressStep
                key={index}
                active={index === currentStep}
                completed={index < currentStep}
                isLast={index === steps.length - 1}
              >
                <ProgressStepTitle>{step.title}</ProgressStepTitle>
                {step.duration && <ProgressStepDuration>{step.duration}</ProgressStepDuration>}
              </ProgressStep>
            ))}
          </ProgressSteps>
        </Progress>
      </div>

      {/* Main content area - Full width on mobile, reduced width on desktop */}
      <div className="flex flex-col w-full md:w-3/5 px-4 py-6 md:px-16 md:py-32">
        {/* Mobile and Desktop header with logo and back button */}
        <div className="flex items-center mb-6">
          {/* Logo */}
          <Link href="/">
            <Image
              className="absolute top-6 left-6"
              src="/tensr_logo_light.png"
              alt="Tensr Logo"
              height={24}
              width={96}
            />
          </Link>

          {/* Back button and title - positioned to avoid logo overlap */}
          <div className="flex items-center mt-12 md:mt-0 md:hidden">
            <Link href="/" className="mr-4">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <div className="text-lg font-medium md:text-xl">Subscription Plan</div>
              <div className="text-sm text-gray-600 md:text-base">{getPriceDisplay()}</div>
            </div>
          </div>
        </div>

        {/* Mobile step indicator - Only show if not on success step */}
        {currentStep < steps.length - 1 && renderMobileStepIndicator()}

        <div className="w-full max-w-xl mx-auto md:mx-0">
          {renderStepContent()}

          {/* Navigation buttons - only show for steps that need manual navigation */}
          {currentStep !== 0 && currentStep < steps.length - 1 && (
            <div className="flex gap-4 mt-8">
              {currentStep > 0 && (
                <Button
                  onClick={handlePrevious}
                  disabled={loading}
                  variant="secondary"
                  className="bg-[#70806013] border border-[#85851A1A] hover:bg-[#70806026]"
                >
                  Previous
                </Button>
              )}
              <Button
                onClick={handleNext}
                disabled={loading}
                variant="default"
                className="flex-1 flex items-center justify-center gap-2"
              >
                {loading
                  ? 'Processing...'
                  : currentStep === 2
                    ? 'Pay Now'
                    : currentStep === steps.length - 2
                      ? 'Confirm Payment'
                      : currentStep === steps.length - 1
                        ? 'Go to Dashboard'
                        : 'Continue'}
                {currentStep === steps.length - 1 && <LuArrowRight size={16} />}
              </Button>
            </div>
          )}

          {/* Success step navigation */}
          {currentStep === steps.length - 1 && (
            <div className="flex gap-4 mt-8">
              <Button
                onClick={() => router.push('/')}
                variant="default"
                className="flex-1 flex items-center justify-center gap-2"
              >
                Go to Dashboard
                <LuArrowRight size={16} />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentPageWithStripe;
