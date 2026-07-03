import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/api/use-auth';
import { getIdToken } from '@/utils/auth';
import { getTensrApiBaseUrl } from '@/lib/tensr-api-url';
import { devLog } from '@/lib/dev-log';

const API_BASE_URL = getTensrApiBaseUrl();

function mapApiOrganization(raw: Record<string, unknown>): Organization {
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
    name: String(raw.name ?? 'Organization'),
    createdAt: String(raw.created_at ?? raw.createdAt ?? now),
    updatedAt: String(raw.updated_at ?? raw.updatedAt ?? now),
    role,
    description: raw.description as string | undefined,
    slug: raw.slug as string | undefined,
    logoUrl: raw.logo_url as string | undefined,
  };
}

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

// Team types
export interface Team {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  accessLevel: 'READ_ONLY' | 'READ_WRITE' | 'ADMIN';
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  teamId: string;
  userId: string;
  role: 'MEMBER' | 'LEADER';
  joinedAt: string;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    profilePicture?: string;
  };
}

// Invitation types
export interface OrganizationInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
  invitedBy: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
  token: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
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
  // Team methods
  teams: Team[];
  createTeam: (
    orgId: string,
    data: {
      name: string;
      description?: string;
      accessLevel?: 'READ_ONLY' | 'READ_WRITE' | 'ADMIN';
    }
  ) => Promise<Team>;
  updateTeam: (
    orgId: string,
    teamId: string,
    data: {
      name?: string;
      description?: string;
      accessLevel?: 'READ_ONLY' | 'READ_WRITE' | 'ADMIN';
    }
  ) => Promise<Team>;
  deleteTeam: (orgId: string, teamId: string) => Promise<boolean>;
  listTeams: (orgId: string) => Promise<Team[]>;
  // Team member methods
  listTeamMembers: (teamId: string) => Promise<TeamMember[]>;
  addMemberToTeam: (
    teamId: string,
    data: {
      email: string;
      role: 'MEMBER' | 'LEADER';
    }
  ) => Promise<TeamMember>;
  removeMemberFromTeam: (teamId: string, userId: string) => Promise<boolean>;
  updateTeamMemberRole: (
    teamId: string,
    userId: string,
    role: 'MEMBER' | 'LEADER'
  ) => Promise<TeamMember>;
  // Invitation methods
  invitations: OrganizationInvitation[];
  createInvitation: (
    orgId: string,
    data: {
      email: string;
      role: 'ADMIN' | 'MEMBER' | 'VIEWER';
    }
  ) => Promise<OrganizationInvitation>;
  listInvitations: (orgId: string) => Promise<OrganizationInvitation[]>;
  deleteInvitation: (token: string) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
  fetchOrganizations: () => Promise<Organization[]>;
  fetchMembers: (orgId: string) => Promise<OrganizationMember[]>;
}

export const useOrganization = (): UseOrganizationReturn => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const auth = useAuth();

  // Helper function to get access token
  const getToken = useCallback((): string => {
    // Get token directly from localStorage via helper function
    const token = getIdToken() || localStorage.getItem('access_token') || '';
    return token;
  }, []);

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

      devLog('Fetching organizations with token');
      const response = await fetch(`${API_BASE_URL}/api/organizations`, {
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
      const rawOrgs = data.organizations || [];
      const userOrgs = Array.isArray(rawOrgs)
        ? rawOrgs.map(o => mapApiOrganization(o as Record<string, unknown>))
        : [];
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

      const response = await fetch(`${API_BASE_URL}/api/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: data.name }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(
          `Failed to create organization: ${errorData.message || response.statusText}`
        );
      }

      const created = await response.json();
      const rawOrg = (created.organization ?? created) as Record<string, unknown>;
      const newOrg = mapApiOrganization(rawOrg);

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

      const response = await fetch(`${API_BASE_URL}/api/organizations/${orgId}`, {
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

      const response = await fetch(`${API_BASE_URL}/api/organizations/${orgId}`, {
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

      const response = await fetch(`${API_BASE_URL}/api/organizations/${orgId}/members`, {
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

      if (!userId.includes('@')) {
        throw new Error('Adding organization members requires an email address.');
      }

      const response = await fetch(`${API_BASE_URL}/api/organizations/${orgId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: userId.trim(),
          role: role === 'ADMIN' ? 'owner' : 'member',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(`Failed to add member: ${errorData.message || response.statusText}`);
      }

      const memberPayload = await response.json();
      const newMember = memberPayload.member ?? memberPayload;

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

      const response = await fetch(`${API_BASE_URL}/api/organizations/${orgId}/members/${userId}`, {
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
        `${API_BASE_URL}/api/organizations/${orgId}/members/${userId}/role`,
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

  // Team methods
  const createTeam = async (
    orgId: string,
    data: {
      name: string;
      description?: string;
      accessLevel?: 'READ_ONLY' | 'READ_WRITE' | 'ADMIN';
    }
  ): Promise<Team> => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        throw new Error('No authentication token available. Please log in again.');
      }

      const response = await fetch(`${API_BASE_URL}/api/teams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: data.name }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(`Failed to create team: ${errorData.message || response.statusText}`);
      }

      const payload = await response.json();
      const rawTeam = (payload.team ?? payload) as Record<string, unknown>;
      const newTeam: Team = {
        id: String(rawTeam.id ?? ''),
        organizationId: orgId,
        name: String(rawTeam.name ?? data.name),
        description: data.description,
        accessLevel: data.accessLevel ?? 'READ_WRITE',
        createdAt: String(rawTeam.created_at ?? rawTeam.createdAt ?? new Date().toISOString()),
        updatedAt: String(rawTeam.updated_at ?? rawTeam.updatedAt ?? new Date().toISOString()),
      };

      // Update local state
      setTeams(prev => [...prev, newTeam]);

      return newTeam;
    } catch (err: any) {
      console.error('Error creating team:', err);
      setError(err.message || 'Failed to create team');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateTeam = async (
    orgId: string,
    teamId: string,
    data: {
      name?: string;
      description?: string;
      accessLevel?: 'READ_ONLY' | 'READ_WRITE' | 'ADMIN';
    }
  ): Promise<Team> => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        throw new Error('No authentication token available. Please log in again.');
      }

      const response = await fetch(`${API_BASE_URL}/api/teams/${teamId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(`Failed to update team: ${errorData.message || response.statusText}`);
      }

      const updatedTeam = await response.json();

      // Update local state
      setTeams(prev => prev.map(team => (team.id === teamId ? updatedTeam : team)));

      return updatedTeam;
    } catch (err: any) {
      console.error('Error updating team:', err);
      setError(err.message || 'Failed to update team');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTeam = async (orgId: string, teamId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        throw new Error('No authentication token available. Please log in again.');
      }

      const response = await fetch(`${API_BASE_URL}/api/teams/${teamId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(`Failed to delete team: ${errorData.message || response.statusText}`);
      }

      // Update local state
      setTeams(prev => prev.filter(team => team.id !== teamId));

      return true;
    } catch (err: any) {
      console.error('Error deleting team:', err);
      setError(err.message || 'Failed to delete team');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const listTeams = async (orgId: string): Promise<Team[]> => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        setError('No authentication token available. Please log in again.');
        return [];
      }

      const response = await fetch(`${API_BASE_URL}/api/teams`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(`Failed to get teams: ${errorData.message || response.statusText}`);
      }

      const data = await response.json();
      const rawTeams = data.teams || [];
      const orgTeams: Team[] = Array.isArray(rawTeams)
        ? rawTeams.map((t: Record<string, unknown>) => ({
            id: String(t.id ?? ''),
            organizationId: orgId,
            name: String(t.name ?? ''),
            createdAt: String(t.created_at ?? t.createdAt ?? new Date().toISOString()),
            updatedAt: String(t.updated_at ?? t.updatedAt ?? new Date().toISOString()),
            accessLevel: 'READ_WRITE',
          }))
        : [];
      setTeams(orgTeams);

      return orgTeams;
    } catch (err: any) {
      console.error('Error fetching teams:', err);
      setError(err.message || 'Failed to fetch teams');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Team member methods
  const listTeamMembers = async (teamId: string): Promise<TeamMember[]> => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        setError('No authentication token available. Please log in again.');
        return [];
      }

      const response = await fetch(`${API_BASE_URL}/api/teams/${teamId}/members`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(`Failed to get team members: ${errorData.message || response.statusText}`);
      }

      const data = await response.json();
      const teamMembers = data.members || [];
      // Update local state
      // This state is not directly managed by this hook, so we just return
      return teamMembers;
    } catch (err: any) {
      console.error('Error fetching team members:', err);
      setError(err.message || 'Failed to fetch team members');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const addMemberToTeam = async (
    teamId: string,
    data: {
      email: string;
      role: 'MEMBER' | 'LEADER';
    }
  ): Promise<TeamMember> => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        throw new Error('No authentication token available. Please log in again.');
      }

      const response = await fetch(`${API_BASE_URL}/api/teams/${teamId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(`Failed to add team member: ${errorData.message || response.statusText}`);
      }

      const newMember = await response.json();
      // Update local state
      // This state is not directly managed by this hook, so we just return
      return newMember;
    } catch (err: any) {
      console.error('Error adding team member:', err);
      setError(err.message || 'Failed to add team member');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const removeMemberFromTeam = async (teamId: string, userId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        throw new Error('No authentication token available. Please log in again.');
      }

      const response = await fetch(`${API_BASE_URL}/api/teams/${teamId}/members/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(
          `Failed to remove team member: ${errorData.message || response.statusText}`
        );
      }

      // Update local state
      // This state is not directly managed by this hook, so we just return
      return true;
    } catch (err: any) {
      console.error('Error removing team member:', err);
      setError(err.message || 'Failed to remove team member');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateTeamMemberRole = async (
    teamId: string,
    userId: string,
    role: 'MEMBER' | 'LEADER'
  ): Promise<TeamMember> => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        throw new Error('No authentication token available. Please log in again.');
      }

      const response = await fetch(`${API_BASE_URL}/api/teams/${teamId}/members/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(
          `Failed to update team member role: ${errorData.message || response.statusText}`
        );
      }

      const updatedMember = await response.json();
      // Update local state
      // This state is not directly managed by this hook, so we just return
      return updatedMember;
    } catch (err: any) {
      console.error('Error updating team member role:', err);
      setError(err.message || 'Failed to update team member role');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Invitation methods
  const createInvitation = async (
    orgId: string,
    data: {
      email: string;
      role: 'ADMIN' | 'MEMBER' | 'VIEWER';
    }
  ): Promise<OrganizationInvitation> => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        throw new Error('No authentication token available. Please log in again.');
      }

      const response = await fetch(`${API_BASE_URL}/api/organizations/${orgId}/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: data.email.trim(),
          role: data.role === 'ADMIN' ? 'owner' : 'member',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        const detail = errorData.detail;
        const message =
          typeof detail === 'string' ? detail : errorData.message || response.statusText;
        throw new Error(`Failed to create invitation: ${message}`);
      }

      const payload = await response.json();
      const newInvitation = payload.invitation ?? payload;
      // Update local state
      setInvitations(prev => [...prev, newInvitation]);
      return newInvitation;
    } catch (err: any) {
      console.error('Error creating invitation:', err);
      setError(err.message || 'Failed to create invitation');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const listInvitations = async (orgId: string): Promise<OrganizationInvitation[]> => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        setError('No authentication token available. Please log in again.');
        return [];
      }

      const response = await fetch(`${API_BASE_URL}/api/organizations/${orgId}/invitations`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(`Failed to get invitations: ${errorData.message || response.statusText}`);
      }

      const data = await response.json();
      const orgInvitations = data.invitations || [];
      // Update local state
      setInvitations(orgInvitations);
      return orgInvitations;
    } catch (err: any) {
      console.error('Error fetching invitations:', err);
      setError(err.message || 'Failed to fetch invitations');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const deleteInvitation = async (invitationToken: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getToken();
      if (!token) {
        throw new Error('No authentication token available. Please log in again.');
      }

      const response = await fetch(`${API_BASE_URL}/api/invitations/${invitationToken}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(`Failed to delete invitation: ${errorData.message || response.statusText}`);
      }

      // Update local state
      setInvitations(prev => prev.filter(inv => inv.token !== invitationToken));
      return true;
    } catch (err: any) {
      console.error('Error deleting invitation:', err);
      setError(err.message || 'Failed to delete invitation');
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
    teams,
    createTeam,
    updateTeam,
    deleteTeam,
    listTeams,
    listTeamMembers,
    addMemberToTeam,
    removeMemberFromTeam,
    updateTeamMemberRole,
    invitations,
    createInvitation,
    listInvitations,
    deleteInvitation,
    isLoading,
    error,
    fetchOrganizations,
    fetchMembers,
  };
};
