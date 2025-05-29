import { OrganizationMember } from '@/hooks/api/use-organisation';
import React from 'react';
import { useOrganizationContext } from '@/contexts/organisation-context';

interface PermissionWrapperProps {
  children: React.ReactNode;
  requiredRole?: OrganizationMember['role'];
  minimumRole?: OrganizationMember['role'];
  requireOrgAdmin?: boolean;
  requireOrgMember?: boolean;
  fallback?: React.ReactNode;
  organizationRequired?: boolean;
}

export const PermissionWrapper: React.FC<PermissionWrapperProps> = ({
  children,
  requiredRole,
  minimumRole,
  requireOrgAdmin = false,
  requireOrgMember = false,
  fallback = null,
  organizationRequired = false,
}) => {
  const { activeOrganization, currentUserRole, hasRole, hasMinimumRole, canManageOrganization } =
    useOrganizationContext();

  // Check if organization is required but not present
  if (organizationRequired && !activeOrganization) {
    return <>{fallback}</>;
  }

  // Check specific role requirement
  if (requiredRole && !hasRole(requiredRole)) {
    return <>{fallback}</>;
  }

  // Check minimum role requirement
  if (minimumRole && !hasMinimumRole(minimumRole)) {
    return <>{fallback}</>;
  }

  // Check org admin requirement
  if (requireOrgAdmin && !canManageOrganization()) {
    return <>{fallback}</>;
  }

  // Check org member requirement
  if (requireOrgMember && !currentUserRole) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
