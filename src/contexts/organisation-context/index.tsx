'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/hooks/api/use-auth';
import { getIdToken, decodeSessionJwt, getSessionJwt, getSessionToken } from '@/utils/auth';
import { getTensrApiBaseUrl, tensrApiUrl } from '@/lib/tensr-api-url';
import { handleUnauthorizedResponse, SessionExpiredError } from '@/lib/session-expired';
import { Organization, OrganizationMember } from '@/hooks/api/use-organisation';
import { authTrace } from '@/lib/auth-trace';
import { devLog } from '@/lib/dev-log';

/** Shown until organisation name is loaded from the API (never expose raw org ids in the UI). */
export const PENDING_ORGANISATION_NAME = 'Your organisation';

function normalizeOrganization(raw: Record<string, unknown>): Organization {
  const roleRaw = String(raw.role ?? '').toLowerCase();
  const role: OrganizationMember['role'] =
    roleRaw === 'owner' || roleRaw === 'admin'
      ? 'ADMIN'
      : roleRaw === 'viewer'
        ? 'VIEWER'
        : 'MEMBER';
  const now = new Date().toISOString();
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? '').trim() || PENDING_ORGANISATION_NAME,
    createdAt: String(raw.created_at ?? raw.createdAt ?? now),
    updatedAt: String(raw.updated_at ?? raw.updatedAt ?? now),
    role,
  };
}

interface OrganizationContextType {
  // Current active organization and user's role in it
  activeOrganization: Organization | null;
  currentUserRole: OrganizationMember['role'] | null;
  isPersonalAccount: boolean;

  // All organizations user belongs to
  userOrganizations: Organization[];

  // Organization switching
  switchOrganization: (orgId: string | null) => Promise<void>;
  switchToPersonalAccount: () => void;

  // Permission checking utilities
  canManageOrganization: () => boolean;
  canManageMembers: () => boolean;
  canViewMembers: () => boolean;
  hasRole: (role: OrganizationMember['role']) => boolean;
  hasMinimumRole: (minRole: OrganizationMember['role']) => boolean;

  // Loading states
  isLoading: boolean;
  isSwitching: boolean;
  error: string | null;

  // Refresh functions
  refreshOrganizations: () => Promise<void>;
  refreshCurrentOrganization: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | null>(null);

// Role hierarchy for permission checking
const ROLE_HIERARCHY: Record<OrganizationMember['role'], number> = {
  VIEWER: 1,
  MEMBER: 2,
  ADMIN: 3,
};

const PERSONAL_ACCOUNT_KEY = 'PERSONAL_ACCOUNT';

interface OrganizationProviderProps {
  children: ReactNode;
}

export const OrganizationProvider: React.FC<OrganizationProviderProps> = ({ children }) => {
  const { user, isAuthenticated, isAuthReady, session } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<OrganizationMember['role'] | null>(null);
  const [isPersonalAccount, setIsPersonalAccount] = useState(true);
  const [userOrganizations, setUserOrganizations] = useState<Organization[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL = getTensrApiBaseUrl();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Helper to get auth token (Stytch session JWT)
  // Check both Zustand store and localStorage for reliability
  const getAuthToken = () => {
    // First try Zustand store (most up-to-date)
    const storeToken = session?.sessionJwt || session?.sessionToken;
    if (storeToken) {
      return storeToken;
    }
    // Fallback to localStorage (for cases where store hasn't hydrated yet)
    return getSessionJwt() || getSessionToken() || '';
  };

  // Helper to get user ID from multiple possible sources
  const getUserId = () => {
    // Try different possible properties for user ID
    return user?.userId || null;
  };

  // Get organization claims from JWT token
  const getOrganizationClaimsFromToken = (): Array<{
    orgId: string;
    role: OrganizationMember['role'];
    joinedAt?: string;
  }> => {
    try {
      const idToken = getIdToken();
      if (!idToken) {
        return [];
      }
      const decoded = decodeSessionJwt(idToken);
      if (!decoded) {
        return [];
      }
      // Extract organization claims from token
      // Assuming organizations are stored in custom claims like 'custom:organizations' or similar
      const orgs = (decoded as any)['custom:organizations'] || (decoded as any).organizations || [];
      return Array.isArray(orgs) ? orgs : [];
    } catch (err) {
      console.error('Failed to get organization claims from token:', err);
      return [];
    }
  };

  // Enhanced API call helper with organization context
  const apiCall = async (endpoint: string, options: RequestInit = {}, orgId?: string) => {
    const token = getAuthToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const headers: { [key: string]: string } = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    // Add organization context header if provided
    if (orgId && orgId !== PERSONAL_ACCOUNT_KEY) {
      headers['X-Organization-Id'] = orgId;
    }

    const response = await fetch(
      tensrApiUrl(endpoint.startsWith('/') ? endpoint : `/${endpoint}`),
      {
        ...options,
        headers,
      }
    );

    if (!response.ok) {
      if (handleUnauthorizedResponse(response, `org:${endpoint}`)) {
        throw new SessionExpiredError();
      }
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(errorData.message || response.statusText);
    }

    return response.json();
  };

  // Get organizations from JWT claims (fast, no API call needed)
  const getOrganizationsFromToken = (): Organization[] => {
    const claims = getOrganizationClaimsFromToken();
    return claims.map(claim => ({
      id: claim.orgId,
      name: PENDING_ORGANISATION_NAME,
      role: claim.role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  };

  // Fetch full organization details from API
  const fetchUserOrganizations = async (): Promise<Organization[]> => {
    try {
      const data = await apiCall('/api/organizations');
      const raw = data.organizations || [];
      return Array.isArray(raw)
        ? raw.map(o => normalizeOrganization(o as Record<string, unknown>))
        : [];
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        throw err;
      }
      console.error('Error fetching user organizations:', err);

      // Fallback to token claims if API fails (network/server errors only)
      devLog('Falling back to organization claims from token');
      return getOrganizationsFromToken();
    }
  };

  // Switch to personal account
  const switchToPersonalAccount = () => {
    devLog('Switching to personal account');

    setActiveOrganization(null);
    setCurrentUserRole(null);
    setIsPersonalAccount(true);
    setError(null);
    setIsSwitching(false);

    // Clear persisted organization
    localStorage.setItem('activeOrganizationId', PERSONAL_ACCOUNT_KEY);
    localStorage.removeItem('activeOrganizationRole');

    // Emit event for other components to react to account switch
    window.dispatchEvent(
      new CustomEvent('organizationSwitched', {
        detail: { organization: null, role: null, isPersonalAccount: true },
      })
    );
  };

  // Switch to organization using JWT claims (no API call needed!)
  const switchOrganizationFromClaims = (orgId: string) => {
    const claims = getOrganizationClaimsFromToken();
    const orgClaim = claims.find(claim => claim.orgId === orgId);

    if (!orgClaim) {
      throw new Error('User is not a member of this organization');
    }

    // Find the organization in our list or create a minimal one
    let organization = userOrganizations.find(org => org.id === orgId);
    if (!organization) {
      organization = {
        id: orgId,
        name: PENDING_ORGANISATION_NAME,
        role: orgClaim.role,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // Update state
    setActiveOrganization(organization);
    setCurrentUserRole(orgClaim.role);
    setIsPersonalAccount(false);

    // Persist active organization
    localStorage.setItem('activeOrganizationId', orgId);
    localStorage.setItem('activeOrganizationRole', orgClaim.role);

    // Emit event
    window.dispatchEvent(
      new CustomEvent('organizationSwitched', {
        detail: { organization, role: orgClaim.role, isPersonalAccount: false },
      })
    );
  };

  // Switch to a different organization or personal account
  const switchOrganization = async (orgId: string | null) => {
    devLog('Switching organization to:', orgId);

    if (!user || !isAuthenticated) {
      throw new Error('User not authenticated');
    }

    // Handle switching to personal account
    if (!orgId || orgId === '' || orgId === PERSONAL_ACCOUNT_KEY) {
      switchToPersonalAccount();
      return;
    }

    setIsSwitching(true);
    setError(null);

    try {
      // Use JWT claims for instant switching (no API call needed)
      switchOrganizationFromClaims(orgId);

      devLog('Successfully switched to organization using JWT claims');
    } catch (err: any) {
      console.error('Error switching organization:', err);
      setError(err.message);

      // If switching fails, fall back to personal account
      switchToPersonalAccount();
      throw err;
    } finally {
      setIsSwitching(false);
    }
  };

  // Refresh organizations list
  const refreshOrganizations = async () => {
    if (!isAuthenticated) return;

    // Check if token is available before making API calls
    const token = getAuthToken();
    if (!token) {
      console.warn('Cannot refresh organizations: no authentication token available');
      return;
    }

    setOrgsLoading(true);
    setError(null);

    try {
      const orgs = await fetchUserOrganizations();
      setUserOrganizations(orgs);

      devLog(`Refreshed ${orgs.length} organizations`);
    } catch (err: any) {
      console.error('Error refreshing organizations:', err);
      setError(err.message);

      // Fallback to token claims
      try {
        const tokenOrgs = getOrganizationsFromToken();
        setUserOrganizations(tokenOrgs);
        devLog(`Using ${tokenOrgs.length} organizations from token claims`);
      } catch (tokenErr) {
        console.error('Failed to get organizations from token:', tokenErr);
      }
    } finally {
      setOrgsLoading(false);
    }
  };

  // Refresh current organization details
  const refreshCurrentOrganization = async () => {
    if (!activeOrganization || isPersonalAccount) return;

    try {
      const data = await apiCall('/api/me', {}, activeOrganization.id);
      const match = (data.organizations || []).find(
        (o: { id: string }) => o.id === activeOrganization.id
      );
      if (match) {
        setActiveOrganization(normalizeOrganization(match as Record<string, unknown>));
      }
      devLog('Refreshed current organization details');
    } catch (err: any) {
      console.error('Error refreshing current organization:', err);
      setError(err.message);
      // If refresh fails, fall back to personal account
      switchToPersonalAccount();
    }
  };

  // Permission checking utilities
  const canManageOrganization = () => !isPersonalAccount && currentUserRole === 'ADMIN';
  const canManageMembers = () => !isPersonalAccount && currentUserRole === 'ADMIN';
  const canViewMembers = () => !isPersonalAccount && currentUserRole !== null;
  const hasRole = (role: OrganizationMember['role']) =>
    !isPersonalAccount && currentUserRole === role;
  const hasMinimumRole = (minRole: OrganizationMember['role']) => {
    if (isPersonalAccount || !currentUserRole) return false;
    return ROLE_HIERARCHY[currentUserRole] >= ROLE_HIERARCHY[minRole];
  };

  // Initialize on auth change (client-only — avoids SSR/localStorage hydration mismatch)
  useEffect(() => {
    if (!mounted || !isAuthReady) return;

    devLog('Auth state changed:', { isAuthenticated, userId: getUserId() });
    authTrace('org:auth-state-changed', { isAuthenticated, userId: getUserId() });

    // Only proceed if authenticated AND token is available
    const token = getAuthToken();
    if (isAuthenticated && token) {
      // Check for persisted active organization
      const savedOrgId = localStorage.getItem('activeOrganizationId');
      const savedRole = localStorage.getItem(
        'activeOrganizationRole'
      ) as OrganizationMember['role'];

      devLog('Found saved org state:', { savedOrgId, savedRole });

      // First, always refresh organizations (this will also populate from token claims)
      refreshOrganizations()
        .then(() => {
          if (savedOrgId && savedOrgId !== PERSONAL_ACCOUNT_KEY && savedRole) {
            devLog('Attempting to restore saved organization');
            // Try to switch to the saved organization using claims (fast)
            try {
              switchOrganizationFromClaims(savedOrgId);
              devLog('Successfully restored organization from claims');
            } catch (err) {
              console.warn(
                'Failed to restore saved organization from claims, using personal account:',
                err
              );
              switchToPersonalAccount();
            }
          } else {
            devLog('No saved organization or personal account saved, defaulting to personal');
            switchToPersonalAccount();
          }
        })
        .catch(err => {
          console.error('Failed to refresh organizations:', err);
          switchToPersonalAccount();
        });
    } else if (!isAuthenticated && !getSessionJwt() && !getSessionToken()) {
      devLog('User not authenticated, clearing state');
      authTrace('org:clearing-state');
      // Clear state on logout
      setActiveOrganization(null);
      setCurrentUserRole(null);
      setIsPersonalAccount(true);
      setUserOrganizations([]);
      setOrgsLoading(false);
      setIsSwitching(false);
      setError(null);
      localStorage.removeItem('activeOrganizationId');
      localStorage.removeItem('activeOrganizationRole');
    }
  }, [mounted, isAuthReady, isAuthenticated, user?.userId]);

  // Debug effect to log token claims
  useEffect(() => {
    if (isAuthenticated) {
      const idToken = getIdToken();
      if (idToken) {
        try {
          const claims = getOrganizationClaimsFromToken();
          devLog('Organization claims from token:', claims);
        } catch (err) {
          console.error('Failed to parse organization claims:', err);
        }
      }
    }
  }, [isAuthenticated]);

  const value: OrganizationContextType = {
    activeOrganization,
    currentUserRole,
    isPersonalAccount,
    userOrganizations,
    switchOrganization,
    switchToPersonalAccount,
    canManageOrganization,
    canManageMembers,
    canViewMembers,
    hasRole,
    hasMinimumRole,
    isLoading: orgsLoading,
    isSwitching,
    error,
    refreshOrganizations,
    refreshCurrentOrganization,
  };

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
};

export const useOrganizationContext = () => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganizationContext must be used within an OrganizationProvider');
  }
  return context;
};
