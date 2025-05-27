import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/api/use-auth';

// API base URL - should be configured via environment variable
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// Organization types
export interface Organization {
  id: string;
  name: string;
  description?: string;
  settings?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER'; // User's role in this organization
  slug?: string;
  logoUrl?: string;
}

export interface OrganizationMember {
  organizationId: string;
  userId: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
  joinedAt: string;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    profilePicture?: string;
  };
}

interface UseOrganizationReturn {
  organizations: Organization[];
  activeOrganization: Organization | null;
  setActiveOrganization: (org: Organization) => void;
  createOrganization: (data: {
    name: string;
    description?: string;
    settings?: any;
  }) => Promise<Organization>;
  updateOrganization: (
    orgId: string,
    data: { name?: string; description?: string; settings?: any }
  ) => Promise<Organization>;
  deleteOrganization: (orgId: string) => Promise<boolean>;
  members: OrganizationMember[];
  addMember: (
    orgId: string,
    userId: string,
    role: 'ADMIN' | 'MEMBER' | 'VIEWER'
  ) => Promise<OrganizationMember>;
  removeMember: (orgId: string, userId: string) => Promise<boolean>;
  updateMemberRole: (
    orgId: string,
    userId: string,
    role: 'ADMIN' | 'MEMBER' | 'VIEWER'
  ) => Promise<OrganizationMember>;
  isLoading: boolean;
  error: string | null;
  fetchOrganizations: () => Promise<Organization[]>;
  fetchMembers: (orgId: string) => Promise<OrganizationMember[]>;
}

export const useOrganization = (): UseOrganizationReturn => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const auth = useAuth();

  // Helper function to get access token
  const getToken = useCallback((): string => {
    // First try to get from auth context
    if (auth.tokens?.accessToken) {
      return auth.tokens.accessToken;
    }

    // Fallback to localStorage directly
    const token = localStorage.getItem('access_token');
    return token || '';
  }, [auth.tokens]);

  // Function to fetch user's organizations
  const fetchOrganizations = useCallback(async (): Promise<Organization[]> => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        setError('No authentication token available. Please log in again.');
        return [];
      }

      console.log('Fetching organizations with token');
      const response = await fetch(`${API_BASE_URL}/organizations`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(`Failed to get organizations: ${errorData.message || response.statusText}`);
      }

      const data = await response.json();
      const userOrgs = data.organizations || [];
      setOrganizations(userOrgs);

      // If we have organizations but no active one, set the first as active
      if (userOrgs.length > 0 && !activeOrganization) {
        setActiveOrganization(userOrgs[0]);

        // Save to localStorage for persistence
        localStorage.setItem('activeOrganizationId', userOrgs[0].id);
      }

      return userOrgs;
    } catch (err: any) {
      console.error('Error fetching organizations:', err);
      setError(err.message || 'Failed to fetch organizations');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [getToken, activeOrganization]);

  // Function to create a new organization
  const createOrganization = async (data: {
    name: string;
    description?: string;
    settings?: any;
  }): Promise<Organization> => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        throw new Error('No authentication token available. Please log in again.');
      }

      const response = await fetch(`${API_BASE_URL}/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(
          `Failed to create organization: ${errorData.message || response.statusText}`
        );
      }

      const newOrg = await response.json();

      // Update local state
      setOrganizations(prev => [...prev, newOrg]);

      // Set as active organization
      setActiveOrganization(newOrg);
      localStorage.setItem('activeOrganizationId', newOrg.id);

      return newOrg;
    } catch (err: any) {
      console.error('Error creating organization:', err);
      setError(err.message || 'Failed to create organization');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Function to update an organization
  const updateOrganization = async (
    orgId: string,
    data: { name?: string; description?: string; settings?: any }
  ): Promise<Organization> => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        throw new Error('No authentication token available. Please log in again.');
      }

      const response = await fetch(`${API_BASE_URL}/organizations/${orgId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(
          `Failed to update organization: ${errorData.message || response.statusText}`
        );
      }

      const updatedOrg = await response.json();

      // Update local state
      setOrganizations(prev => prev.map(org => (org.id === orgId ? updatedOrg : org)));

      // Update active organization if it's the one being updated
      if (activeOrganization?.id === orgId) {
        setActiveOrganization(updatedOrg);
      }

      return updatedOrg;
    } catch (err: any) {
      console.error('Error updating organization:', err);
      setError(err.message || 'Failed to update organization');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Function to delete an organization
  const deleteOrganization = async (orgId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        throw new Error('No authentication token available. Please log in again.');
      }

      const response = await fetch(`${API_BASE_URL}/organizations/${orgId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(
          `Failed to delete organization: ${errorData.message || response.statusText}`
        );
      }

      // Update local state
      setOrganizations(prev => prev.filter(org => org.id !== orgId));

      // If we deleted the active organization, set a new active one
      if (activeOrganization?.id === orgId) {
        const remainingOrgs = organizations.filter(org => org.id !== orgId);
        if (remainingOrgs.length > 0) {
          setActiveOrganization(remainingOrgs[0]);
          localStorage.setItem('activeOrganizationId', remainingOrgs[0].id);
        } else {
          setActiveOrganization(null);
          localStorage.removeItem('activeOrganizationId');
        }
      }

      return true;
    } catch (err: any) {
      console.error('Error deleting organization:', err);
      setError(err.message || 'Failed to delete organization');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Function to fetch organization members
  const fetchMembers = async (orgId: string): Promise<OrganizationMember[]> => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        setError('No authentication token available. Please log in again.');
        return [];
      }

      const response = await fetch(`${API_BASE_URL}/organizations/${orgId}/members`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(`Failed to get members: ${errorData.message || response.statusText}`);
      }

      const data = await response.json();
      const orgMembers = data.members || [];
      setMembers(orgMembers);
      return orgMembers;
    } catch (err: any) {
      console.error('Error fetching members:', err);
      setError(err.message || 'Failed to fetch members');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Function to add a member
  const addMember = async (
    orgId: string,
    userId: string,
    role: 'ADMIN' | 'MEMBER' | 'VIEWER'
  ): Promise<OrganizationMember> => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        throw new Error('No authentication token available. Please log in again.');
      }

      const response = await fetch(`${API_BASE_URL}/organizations/${orgId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, role }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(`Failed to add member: ${errorData.message || response.statusText}`);
      }

      const newMember = await response.json();

      // Update local state
      setMembers(prev => [...prev, newMember]);

      return newMember;
    } catch (err: any) {
      console.error('Error adding member:', err);
      setError(err.message || 'Failed to add member');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Function to remove a member
  const removeMember = async (orgId: string, userId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        throw new Error('No authentication token available. Please log in again.');
      }

      const response = await fetch(`${API_BASE_URL}/organizations/${orgId}/members/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(`Failed to remove member: ${errorData.message || response.statusText}`);
      }

      // Update local state
      setMembers(prev => prev.filter(member => member.userId !== userId));

      return true;
    } catch (err: any) {
      console.error('Error removing member:', err);
      setError(err.message || 'Failed to remove member');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Function to update member role
  const updateMemberRole = async (
    orgId: string,
    userId: string,
    role: 'ADMIN' | 'MEMBER' | 'VIEWER'
  ): Promise<OrganizationMember> => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        throw new Error('No authentication token available. Please log in again.');
      }

      const response = await fetch(
        `${API_BASE_URL}/organizations/${orgId}/members/${userId}/role`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ role }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(
          `Failed to update member role: ${errorData.message || response.statusText}`
        );
      }

      const updatedMember = await response.json();

      // Update local state
      setMembers(prev => prev.map(member => (member.userId === userId ? updatedMember : member)));

      return updatedMember;
    } catch (err: any) {
      console.error('Error updating member role:', err);
      setError(err.message || 'Failed to update member role');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    organizations,
    activeOrganization,
    setActiveOrganization: (org: Organization) => {
      setActiveOrganization(org);
      localStorage.setItem('activeOrganizationId', org.id);
    },
    createOrganization,
    updateOrganization,
    deleteOrganization,
    members,
    addMember,
    removeMember,
    updateMemberRole,
    isLoading,
    error,
    fetchOrganizations,
    fetchMembers,
  };
};
