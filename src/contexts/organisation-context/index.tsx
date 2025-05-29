'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/hooks/api/use-auth';
import { Organization, OrganizationMember } from '@/hooks/api/use-organisation';

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

// Helper function to extract organization claims from JWT token
const getOrganizationClaimsFromToken = (): Array<{
  orgId: string;
  role: OrganizationMember['role'];
}> => {
  try {
    const token = localStorage.getItem('id_token'); // This is actually the ID token
    if (!token) return [];

    const payload = JSON.parse(atob(token.split('.')[1]));
    const orgClaimsString = payload['custom:organizations'];

    if (!orgClaimsString) return [];

    return JSON.parse(orgClaimsString);
  } catch (error) {
    console.error('Error extracting organization claims from token:', error);
    return [];
  }
};

export const OrganizationProvider: React.FC<OrganizationProviderProps> = ({ children }) => {
  const { user, isAuthenticated, tokens } = useAuth();
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<OrganizationMember['role'] | null>(null);
  const [isPersonalAccount, setIsPersonalAccount] = useState(true);
  const [userOrganizations, setUserOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get API base URL
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

  // Helper to get auth token (ID token with claims)
  const getAuthToken = () => {
    return localStorage.getItem('access_token') || tokens?.idToken || '';
  };

  // Helper to get user ID from multiple possible sources
  const getUserId = () => {
    // Try different possible properties for user ID
    return user?.userId || null;
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

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
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
      name: `Organization ${claim.orgId.slice(0, 8)}...`, // Placeholder name
      role: claim.role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  };

  // Fetch full organization details from API
  const fetchUserOrganizations = async (): Promise<Organization[]> => {
    try {
      const data = await apiCall('/organizations');
      return data.organizations || [];
    } catch (err) {
      console.error('Error fetching user organizations:', err);

      // Fallback to token claims if API fails
      console.log('Falling back to organization claims from token');
      return getOrganizationsFromToken();
    }
  };

  // Switch to personal account
  const switchToPersonalAccount = () => {
    console.log('Switching to personal account');

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
        name: `Organization ${orgId.slice(0, 8)}...`,
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
    console.log('Switching organization to:', orgId);

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

      console.log('Successfully switched to organization using JWT claims');
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
    if (!user || !isAuthenticated) return;

    setIsLoading(true);
    setError(null);

    try {
      const orgs = await fetchUserOrganizations();
      setUserOrganizations(orgs);

      console.log(`Refreshed ${orgs.length} organizations`);
    } catch (err: any) {
      console.error('Error refreshing organizations:', err);
      setError(err.message);

      // Fallback to token claims
      try {
        const tokenOrgs = getOrganizationsFromToken();
        setUserOrganizations(tokenOrgs);
        console.log(`Using ${tokenOrgs.length} organizations from token claims`);
      } catch (tokenErr) {
        console.error('Failed to get organizations from token:', tokenErr);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh current organization details
  const refreshCurrentOrganization = async () => {
    if (!activeOrganization || isPersonalAccount) return;

    try {
      const data = await apiCall(
        `/organizations/${activeOrganization.id}`,
        {},
        activeOrganization.id
      );
      setActiveOrganization(data);
      console.log('Refreshed current organization details');
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

  // Initialize on auth change
  useEffect(() => {
    console.log('Auth state changed:', { isAuthenticated, userId: getUserId() });

    if (isAuthenticated && user) {
      // Check for persisted active organization
      const savedOrgId = localStorage.getItem('activeOrganizationId');
      const savedRole = localStorage.getItem(
        'activeOrganizationRole'
      ) as OrganizationMember['role'];

      console.log('Found saved org state:', { savedOrgId, savedRole });

      // First, always refresh organizations (this will also populate from token claims)
      refreshOrganizations()
        .then(() => {
          if (savedOrgId && savedOrgId !== PERSONAL_ACCOUNT_KEY && savedRole) {
            console.log('Attempting to restore saved organization');
            // Try to switch to the saved organization using claims (fast)
            try {
              switchOrganizationFromClaims(savedOrgId);
              console.log('Successfully restored organization from claims');
            } catch (err) {
              console.warn(
                'Failed to restore saved organization from claims, using personal account:',
                err
              );
              switchToPersonalAccount();
            }
          } else {
            console.log('No saved organization or personal account saved, defaulting to personal');
            switchToPersonalAccount();
          }
        })
        .catch(err => {
          console.error('Failed to refresh organizations:', err);
          switchToPersonalAccount();
        });
    } else {
      console.log('User not authenticated, clearing state');
      // Clear state on logout
      setActiveOrganization(null);
      setCurrentUserRole(null);
      setIsPersonalAccount(true);
      setUserOrganizations([]);
      setIsLoading(false);
      setIsSwitching(false);
      setError(null);
      localStorage.removeItem('activeOrganizationId');
      localStorage.removeItem('activeOrganizationRole');
    }
  }, [isAuthenticated, getUserId()]);

  // Debug effect to log token claims
  useEffect(() => {
    if (isAuthenticated && tokens?.idToken) {
      try {
        const claims = getOrganizationClaimsFromToken();
        console.log('Organization claims from token:', claims);
      } catch (err) {
        console.error('Failed to parse organization claims:', err);
      }
    }
  }, [isAuthenticated, tokens?.idToken]);

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
    isLoading,
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
