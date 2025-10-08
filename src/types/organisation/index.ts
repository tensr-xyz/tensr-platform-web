interface Organisation {
  // Primary key
  orgId: string;
  name: string;
  slug?: string; // URL-friendly identifier (optional for now)

  // Billing and subscription
  billingEmail?: string; // Optional for now
  subscriptionTier?: 'FREE' | 'TEAM' | 'ENTERPRISE'; // Optional for now
  subscriptionStatus?: 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELLED'; // Optional for now

  // Organization details
  logoUrl?: string;
  website?: string;
  description?: string;
  settings?: Record<string, any>;

  // Ownership
  ownerId?: string; // Reference to the user who created/owns organization

  // Audit
  createdAt: string;
  updatedAt: string;
}

// Team model
interface Team {
  // Primary key
  teamId: string;

  // Organization relationship
  orgId: string;

  // Team details
  name: string;
  description?: string;

  // Permissions/access control
  accessLevel: 'READ_ONLY' | 'READ_WRITE' | 'ADMIN';

  // Audit
  createdAt: string;
  updatedAt: string;
}

// Member model for associating users with orgs and teams
interface OrgMember {
  // Composite key
  orgId: string;
  userId: string;

  // Role within organization
  role: 'ADMIN' | 'MEMBER' | 'VIEWER'; // Updated to match backend

  // Teams this user belongs to in this org
  teamIds?: string[]; // Optional for now

  // Invite status
  status?: 'ACTIVE' | 'INVITED' | 'SUSPENDED'; // Optional for now
  inviteEmail?: string; // Optional for now

  // Audit
  addedAt?: string; // Optional for now
  updatedAt?: string; // Optional for now
}
