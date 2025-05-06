import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/api/use-auth';
import { getIdToken } from '@/utils/auth';

// API base URL - should be configured via environment variable
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://t8ioaf6fl9.execute-api.us-east-1.amazonaws.com';

// Subscription interface
export interface Subscription {
  userId: string;
  subscriptionId: string;
  tier: string;
  status: string;
  billingType: 'monthly' | 'annual';
  startDate: string;
  expiresAt: string;
  issuedAt?: string;
  gracePeriodDays: number;
  maxDevices: number;
  licenseKey?: string;
  devices?: {
    deviceId: string;
    firstSeenAt: string;
    lastSeenAt: string;
    appVersion: string;
    os: string;
  }[];
  paymentMethodId?: string;
  lastValidated?: string;
  createdAt: string;
  updatedAt: string;
}

// Invoice interface
export interface Invoice {
  invoiceId: string;
  userId: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  status: string;
  tier: string;
  billingType: 'monthly' | 'annual';
  description?: string;
  periodStart?: string;
  periodEnd?: string;
  pdfUrl?: string;
  createdAt: string;
}

// Usage stats interface
export interface UsageStats {
  userId: string;
  currentUsage: number;
  limit: number;
  utilizationPercentage: number;
  operationBreakdown?: {
    [operationType: string]: number;
  };
  dailyTrend?: {
    date: string;
    count: number;
  }[];
  periodStart?: string;
  periodEnd?: string;
}

// Payment method interface
export interface PaymentMethod {
  id: string;
  type: string;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
}

// Plan interface
export interface Plan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
  operations: number;
  maxDevices: number;
  gracePeriodDays: number;
}

export const useBilling = () => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const auth = useAuth();

  // Use a ref to track if initial fetch has happened
  const initialFetchDoneRef = useRef(false);

  // Helper function to get access token
  const getToken = useCallback((): string => {
    // First try to get from auth context
    if (auth.tokens?.idToken) {
      return auth.tokens.idToken;
    }

    // Fallback to localStorage or directly via helper function
    const token = getIdToken() || '';
    return token;
  }, [auth.tokens]);

  // Helper function to get user ID
  const getUserId = useCallback((): string => {
    // First try user object from auth context
    if (auth.user?.userId) {
      return auth.user.userId;
    }

    // If no user in context, try to extract from token
    const idToken = getToken();
    if (idToken) {
      try {
        const payload = JSON.parse(atob(idToken.split('.')[1]));
        return payload.sub || payload.user_id || '';
      } catch (e) {
        console.error('Error extracting user ID from token:', e);
      }
    }

    return '';
  }, [auth.user, getToken]);

  // Function to fetch current subscription
  const fetchSubscription = useCallback(async (): Promise<Subscription | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        setError('No authentication token available. Please log in again.');
        return null;
      }

      const response = await fetch(`${API_BASE_URL}/billing/subscription`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get subscription: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      setSubscription(data);
      return data;
    } catch (err: any) {
      console.error('Error fetching subscription:', err);
      setError(err.message || 'Failed to fetch subscription details');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  // Function to fetch invoices
  const fetchInvoices = useCallback(async (): Promise<Invoice[]> => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        setError('No authentication token available. Please log in again.');
        return [];
      }

      const response = await fetch(`${API_BASE_URL}/billing/invoices`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get invoices: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      const userInvoices = data.invoices || [];
      setInvoices(userInvoices);
      return userInvoices;
    } catch (err: any) {
      console.error('Error fetching invoices:', err);
      setError(err.message || 'Failed to fetch invoice history');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  // Function to fetch usage statistics
  const fetchUsageStats = useCallback(async (): Promise<UsageStats | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        setError('No authentication token available. Please log in again.');
        return null;
      }

      const response = await fetch(`${API_BASE_URL}/usage/stats`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get usage stats: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      setUsageStats(data);
      return data;
    } catch (err: any) {
      console.error('Error fetching usage stats:', err);
      setError(err.message || 'Failed to fetch usage statistics');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  // Function to fetch payment methods
  const fetchPaymentMethods = useCallback(async (): Promise<PaymentMethod[]> => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        setError('No authentication token available. Please log in again.');
        return [];
      }

      const response = await fetch(`${API_BASE_URL}/billing/payment-methods`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get payment methods: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      const methods = data.paymentMethods || [];
      setPaymentMethods(methods);
      return methods;
    } catch (err: any) {
      console.error('Error fetching payment methods:', err);
      setError(err.message || 'Failed to fetch payment methods');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  // Function to fetch available plans
  const fetchPlans = useCallback(async (): Promise<Plan[]> => {
    try {
      setIsLoading(true);
      setError(null);

      // This endpoint is public and doesn't require authentication
      const response = await fetch(`${API_BASE_URL}/billing/plans`, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get plans: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      setPlans(data);
      return data;
    } catch (err: any) {
      console.error('Error fetching plans:', err);
      setError(err.message || 'Failed to fetch available plans');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Function to cancel subscription
  const cancelSubscription = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        setError('No authentication token available. Please log in again.');
        return false;
      }

      const response = await fetch(`${API_BASE_URL}/billing/cancel-subscription`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // Empty body or can include reason if needed
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to cancel subscription: ${response.statusText} - ${errorText}`);
      }

      // Refresh subscription data
      await fetchSubscription();
      return true;
    } catch (err: any) {
      console.error('Error cancelling subscription:', err);
      setError(err.message || 'Failed to cancel subscription');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getToken, fetchSubscription]);

  // Function to create payment intent (for upgrading plan or initial subscription)
  const createPaymentIntent = useCallback(
    async (
      tier: string,
      billingType: 'monthly' | 'annual',
      amount: number
    ): Promise<{ clientSecret: string; subscriptionId: string }> => {
      try {
        setIsLoading(true);
        setError(null);

        const token = getToken();
        if (!token) {
          throw new Error('No authentication token available. Please log in again.');
        }

        const userId = getUserId();
        const response = await fetch(`${API_BASE_URL}/billing/create-payment-intent`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tier,
            billingType,
            amount,
            email: auth.user?.email || '',
            name: 'User', // You might want to store user's name somewhere
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to create payment: ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        return {
          clientSecret: data.clientSecret,
          subscriptionId: data.subscriptionId,
        };
      } catch (err: any) {
        console.error('Error creating payment intent:', err);
        setError(err.message || 'Failed to create payment');
        throw err; // Re-throw to allow handling in the UI
      } finally {
        setIsLoading(false);
      }
    },
    [getToken, getUserId, auth.user]
  );

  // Function to add a new payment method
  const addPaymentMethod = useCallback(
    async (paymentMethodId: string): Promise<boolean> => {
      try {
        setIsLoading(true);
        setError(null);

        const token = getToken();
        if (!token) {
          throw new Error('No authentication token available. Please log in again.');
        }

        const response = await fetch(`${API_BASE_URL}/billing/payment-methods`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentMethodId,
            setAsDefault: true,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to add payment method: ${response.statusText} - ${errorText}`);
        }

        // Refresh payment methods
        await fetchPaymentMethods();
        return true;
      } catch (err: any) {
        console.error('Error adding payment method:', err);
        setError(err.message || 'Failed to add payment method');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken, fetchPaymentMethods]
  );

  // Function to delete a payment method
  const deletePaymentMethod = useCallback(
    async (paymentMethodId: string): Promise<boolean> => {
      try {
        setIsLoading(true);
        setError(null);

        const token = getToken();
        if (!token) {
          throw new Error('No authentication token available. Please log in again.');
        }

        const response = await fetch(`${API_BASE_URL}/billing/payment-methods/${paymentMethodId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to delete payment method: ${response.statusText} - ${errorText}`);
        }

        // Refresh payment methods
        await fetchPaymentMethods();
        return true;
      } catch (err: any) {
        console.error('Error deleting payment method:', err);
        setError(err.message || 'Failed to delete payment method');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken, fetchPaymentMethods]
  );

  // Function to update subscription (change plan)
  const updateSubscription = useCallback(
    async (tier: string, billingType: 'monthly' | 'annual'): Promise<boolean> => {
      try {
        setIsLoading(true);
        setError(null);

        const token = getToken();
        if (!token) {
          throw new Error('No authentication token available. Please log in again.');
        }

        const response = await fetch(`${API_BASE_URL}/billing/update-subscription`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tier,
            billingType,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to update subscription: ${response.statusText} - ${errorText}`);
        }

        // Refresh subscription data
        await fetchSubscription();
        return true;
      } catch (err: any) {
        console.error('Error updating subscription:', err);
        setError(err.message || 'Failed to update subscription');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken, fetchSubscription]
  );

  // Function to load all billing data
  const loadAllBillingData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = getToken();
      if (!token) {
        setError('No authentication token available. Please log in again.');
        return;
      }

      // Fetch all data in parallel
      const [subData, invoiceData, usageData, paymentData, planData] = await Promise.all([
        fetchSubscription(),
        fetchInvoices(),
        fetchUsageStats(),
        fetchPaymentMethods(),
        fetchPlans(),
      ]);

      // Data is already set in individual fetch functions
      console.log('All billing data loaded successfully');
    } catch (err: any) {
      console.error('Error loading all billing data:', err);
      setError(err.message || 'Failed to load billing information');
    } finally {
      setIsLoading(false);
    }
  }, [
    getToken,
    fetchSubscription,
    fetchInvoices,
    fetchUsageStats,
    fetchPaymentMethods,
    fetchPlans,
  ]);

  // Load data when the hook is initialized
  useEffect(() => {
    // Only fetch if we have a token and haven't already done the initial fetch
    const token = getToken();

    if (token && !initialFetchDoneRef.current) {
      console.log('Initial load: Token available, fetching billing data');
      initialFetchDoneRef.current = true; // Mark that we've done the initial fetch

      // Load public plans regardless of authentication
      fetchPlans().catch(err => {
        console.error('Failed to load initial plans:', err);
      });

      // Only load user-specific data if authenticated
      if (auth.isAuthenticated) {
        loadAllBillingData().catch(err => {
          console.error('Failed to load initial billing data:', err);
        });
      }
    }
  }, [auth.isAuthenticated, loadAllBillingData, getToken, fetchPlans]);

  // Additional effect to handle auth changes after initial load
  useEffect(() => {
    // If auth changes and we become authenticated, fetch data
    if (auth.isAuthenticated && initialFetchDoneRef.current) {
      console.log('Auth changed, refreshing billing data');
      loadAllBillingData().catch(err => {
        console.error('Failed to refresh billing data after auth change:', err);
      });
    }
  }, [auth.isAuthenticated, loadAllBillingData]);

  // Format helpers that can be used in components
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: number, currency: string = 'USD'): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  return {
    // Data
    subscription,
    invoices,
    usageStats,
    paymentMethods,
    plans,

    // State
    isLoading,
    error,
    setError,

    // API functions
    fetchSubscription,
    fetchInvoices,
    fetchUsageStats,
    fetchPaymentMethods,
    fetchPlans,
    cancelSubscription,
    createPaymentIntent,
    addPaymentMethod,
    deletePaymentMethod,
    updateSubscription,
    loadAllBillingData,

    // Helper functions
    formatDate,
    formatCurrency,
  };
};
