interface Organisation {
  // Primary key
  orgId: string;
  name: string;
  slug: string; // URL-friendly identifier

  // Billing and subscription
  billingEmail: string;
  subscriptionTier: 'FREE' | 'TEAM' | 'ENTERPRISE';
  subscriptionStatus: 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELLED';

  // Organization details
  logoUrl?: string;
  website?: string;

  // Ownership
  ownerId: string; // Reference to the user who created/owns organization

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
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';

  // Teams this user belongs to in this org
  teamIds: string[];

  // Invite status
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
  inviteEmail?: string;

  // Audit
  addedAt: string;
  updatedAt: string;
}
