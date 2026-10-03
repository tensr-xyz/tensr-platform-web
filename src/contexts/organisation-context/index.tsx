'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/api/use-auth';
import {
  decodeSessionJwt,
  getSessionJwt,
  getSessionToken,
  getStytchBearerForTensrApi,
  isSessionValid,
} from '@/utils/auth';
import { getTensrApiBaseUrl, tensrApiUrl } from '@/lib/tensr-api-url';
import { handleUnauthorizedResponse, SessionExpiredError } from '@/lib/session-expired';
import { Organization, OrganizationMember } from '@/hooks/api/use-organisation';
import {
  PERSONAL_ACCOUNT_KEY,
  readIsPersonal,
  resolveWorkspaceSelection,
  saveActiveOrganisationId,
} from '@/lib/active-organisation';
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
    description: raw.description as string | undefined,
    slug: raw.slug as string | undefined,
    logoUrl: raw.logo_url as string | undefined,
    privacyMode: raw.privacy_mode === 'schema_only' ? 'schema_only' : 'full',
    isPersonal: readIsPersonal(raw),
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
  refreshOrganizations: () => Promise<Organization[]>;
  refreshCurrentOrganization: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | null>(null);

// Role hierarchy for permission checking
const ROLE_HIERARCHY: Record<OrganizationMember['role'], number> = {
  VIEWER: 1,
  MEMBER: 2,
  ADMIN: 3,
};

interface OrganizationProviderProps {
  children: ReactNode;
}

export const OrganizationProvider: React.FC<OrganizationProviderProps> = ({ children }) => {
  const { user, isAuthenticated, isAuthReady, session } = useAuth();
  const queryClient = useQueryClient();
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

  // Helper to get auth token (prefer valid JWT, else opaque session_token)
  const getAuthToken = () => {
    const storeJwt = session?.sessionJwt;
    const storeToken = session?.sessionToken;
    if (storeJwt && isSessionValid(storeJwt, 1)) {
      return storeJwt;
    }
    if (storeToken) {
      return storeToken;
    }
    return getStytchBearerForTensrApi() || '';
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
      // Claims live on the session JWT only — never decode the opaque session_token.
      const sessionJwt = getSessionJwt();
      if (!sessionJwt) {
        return [];
      }
      const decoded = decodeSessionJwt(sessionJwt);
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

  // Cached lists were fetched with the previous X-Organization-Id.
  const refetchForWorkspace = (previousOrgId: string | null) => {
    const nextOrgId = localStorage.getItem('activeOrganizationId');
    if (previousOrgId !== nextOrgId) {
      void queryClient.invalidateQueries();
    }
  };

  // Switch to personal account
  const switchToPersonalAccount = () => {
    devLog('Switching to personal account');
    const previousOrgId = localStorage.getItem('activeOrganizationId');

    setActiveOrganization(null);
    setCurrentUserRole(null);
    setIsPersonalAccount(true);
    setError(null);
    setIsSwitching(false);

    // Clear persisted organization
    saveActiveOrganisationId(PERSONAL_ACCOUNT_KEY);
    localStorage.removeItem('activeOrganizationRole');
    refetchForWorkspace(previousOrgId);

    // Emit event for other components to react to account switch
    window.dispatchEvent(
      new CustomEvent('organizationSwitched', {
        detail: { organization: null, role: null, isPersonalAccount: true },
      })
    );
  };

  const openOrganisation = (organization: Organization) => {
    const previousOrgId = localStorage.getItem('activeOrganizationId');
    setActiveOrganization(organization);
    setCurrentUserRole(organization.role);
    setIsPersonalAccount(false);
    setError(null);
    saveActiveOrganisationId(organization.id);
    localStorage.setItem('activeOrganizationRole', organization.role);
    refetchForWorkspace(previousOrgId);
    window.dispatchEvent(
      new CustomEvent('organizationSwitched', {
        detail: { organization, role: organization.role, isPersonalAccount: false },
      })
    );
  };

  // Switch to a different organization or personal account.
  // Membership comes from the API list. Session tokens do not include these orgs.
  const switchOrganization = async (orgId: string | null) => {
    devLog('Switching organization to:', orgId);

    if (!user || !isAuthenticated) {
      throw new Error('User not authenticated');
    }

    if (!orgId || orgId === '' || orgId === PERSONAL_ACCOUNT_KEY) {
      switchToPersonalAccount();
      return;
    }

    setIsSwitching(true);
    setError(null);

    try {
      const organization = userOrganizations.find(org => org.id === orgId && !org.isPersonal);
      if (!organization) {
        throw new Error('User is not a member of this organization');
      }
      openOrganisation(organization);
      devLog('Switched to organization', organization.id);
    } catch (err: any) {
      console.error('Error switching organization:', err);
      setError(err.message);
      switchToPersonalAccount();
      throw err;
    } finally {
      setIsSwitching(false);
    }
  };

  // Refresh organizations list
  const refreshOrganizations = async (): Promise<Organization[]> => {
    if (!isAuthenticated) return [];

    const token = getAuthToken();
    if (!token) {
      console.warn('Cannot refresh organizations: no authentication token available');
      return [];
    }

    setOrgsLoading(true);
    setError(null);

    try {
      const orgs = await fetchUserOrganizations();
      setUserOrganizations(orgs);
      devLog(`Refreshed ${orgs.length} organizations`);
      return orgs;
    } catch (err: any) {
      console.error('Error refreshing organizations:', err);
      setError(err.message);

      try {
        const tokenOrgs = getOrganizationsFromToken();
        setUserOrganizations(tokenOrgs);
        devLog(`Using ${tokenOrgs.length} organizations from token claims`);
        return tokenOrgs;
      } catch (tokenErr) {
        console.error('Failed to get organizations from token:', tokenErr);
        return [];
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

      refreshOrganizations()
        .then(orgs => {
          const choice = resolveWorkspaceSelection(orgs, savedOrgId);
          if (choice.kind === 'personal') {
            switchToPersonalAccount();
            return;
          }
          const organization = orgs.find(org => org.id === choice.id);
          if (!organization) {
            switchToPersonalAccount();
            return;
          }
          openOrganisation(organization);
          devLog('Opened organisation', organization.id);
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
      saveActiveOrganisationId(null);
      localStorage.removeItem('activeOrganizationRole');
    }
  }, [mounted, isAuthReady, isAuthenticated, user?.userId]);

  // Debug effect to log token claims
  useEffect(() => {
    if (isAuthenticated && getSessionJwt()) {
      try {
        const claims = getOrganizationClaimsFromToken();
        devLog('Organization claims from token:', claims);
      } catch (err) {
        console.error('Failed to parse organization claims:', err);
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

/** Null outside the provider, for hooks that also render standalone. */
export const useOptionalOrganizationContext = () => useContext(OrganizationContext);

export const useOrganizationContext = () => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganizationContext must be used within an OrganizationProvider');
  }
  return context;
};
