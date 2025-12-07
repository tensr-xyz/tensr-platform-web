'use client';

import React, { useState } from 'react';
import {
  User,
  Building,
  X,
  Menu,
  Check,
  Plus,
  Settings,
  Users,
  LogOut,
  Bell,
  BookOpen,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/atoms/button';
import { ChevronsUpDown } from 'lucide-react';
import useAuth from '@/hooks/api/use-auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/molecules/dropdown';
import Image from 'next/image';
import { Avatar, AvatarFallback } from '@/components/atoms/avatar';
import { useIsMobile } from '@/hooks/ui/use-mobile';
import { User as UserType } from '@/types/user';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from '@/hooks/ui/use-toast';
import { useOrganizationContext } from '@/contexts/organisation-context';
import { PermissionWrapper } from '@/wrappers/permission';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserType | null;
  logout: () => void;
}

const getInitials = (email: string) => {
  if (!email) return '??';
  const localPart = email.split('@')[0];
  const parts = localPart.split(/[._-]/).filter(part => part.length > 0);

  if (parts.length > 1) {
    return parts.map(part => part[0].toUpperCase()).join('');
  }

  return localPart.length > 1 ? localPart.slice(0, 2).toUpperCase() : localPart[0].toUpperCase();
};

export const MobileMenu = ({ isOpen, onClose, user, logout }: MobileMenuProps) => {
  const isAuthenticated = !!user;
  const initials = user ? getInitials(user.email) : '';
  const {
    activeOrganization,
    currentUserRole,
    isPersonalAccount,
    canManageOrganization,
    canManageMembers,
  } = useOrganizationContext();

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-red-100 text-red-800';
      case 'MEMBER':
        return 'bg-blue-100 text-blue-800';
      case 'VIEWER':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div
      className={`fixed inset-0 bg-white transform transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      } z-50`}
    >
      {/* Mobile Menu Header */}
      <div className="flex items-center justify-between p-4 h-[72px] border-b border-border">
        <Link href="/" className="flex" onClick={onClose}>
          <Button variant="link" size="sm">
            <Image
              src="/tensr_logo_light.png"
              alt="Tensr Logo"
              height={24}
              width={96}
              priority
              onError={e => console.error('Image failed to load:', e)}
            />
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="rounded-full border border-border active:border-black"
        >
          <X className="h-6 w-6" />
        </Button>
      </div>

      {/* Mobile Menu Content */}
      <div className="flex flex-col h-[calc(100vh-72px)] overflow-y-auto">
        {/* User Section */}
        {isAuthenticated && (
          <div className="p-4 border-b border-border">
            <div className="flex items-center space-x-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium">{user.email}</p>
                <p className="text-sm text-gray-600">{user.subscriptionTier}</p>

                {/* Organization Context */}
                <div className="flex items-center gap-2 mt-1">
                  {isPersonalAccount ? (
                    <>
                      <User className="w-3 h-3 text-gray-500" />
                      <span className="text-xs text-gray-600">Personal Account</span>
                    </>
                  ) : activeOrganization ? (
                    <>
                      <Building className="w-3 h-3 text-gray-500" />
                      <span className="text-xs text-gray-600">{activeOrganization.name}</span>
                      {currentUserRole && (
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(currentUserRole)}`}
                        >
                          {currentUserRole}
                        </span>
                      )}
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Organization Actions - Only show when in an organization */}
        {isAuthenticated && !isPersonalAccount && activeOrganization && (
          <div className="p-4 border-b border-border">
            <div className="text-sm font-medium text-gray-500 mb-2">Organization Actions</div>

            <PermissionWrapper requireOrgAdmin>
              <Link href="/settings/organization" onClick={onClose}>
                <div className="flex items-center gap-2 text-sm font-medium p-2 hover:bg-gray-50 rounded">
                  <Settings className="w-4 h-4" />
                  Organization Settings
                </div>
              </Link>
            </PermissionWrapper>

            <PermissionWrapper minimumRole="MEMBER">
              <Link href="/settings/members" onClick={onClose}>
                <div className="flex items-center gap-2 text-sm font-medium p-2 hover:bg-gray-50 rounded">
                  <Users className="w-4 h-4" />
                  Team Members
                </div>
              </Link>
            </PermissionWrapper>
          </div>
        )}

        <div className="p-4 border-t border-border mt-auto">
          {isAuthenticated && (
            <div>
              <Link href="/settings/general" onClick={onClose}>
                <div className="text-lg font-medium p-2">Settings</div>
              </Link>
              <Button
                variant="ghost"
                className="px-0"
                onClick={() => {
                  logout();
                  onClose();
                }}
              >
                <div className="text-lg font-medium p-2">Logout</div>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const UserProfileMenu: React.FC = () => {
  const { user, handleLogout: logout } = useAuth();
  const router = useRouter();

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{getInitials(user.email)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.email}</p>
            <p className="text-xs leading-none text-muted-foreground">{user.subscriptionTier}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/settings/general')}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
          <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
          <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const NavigationTabs = () => {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 bg-background z-50 border-b border-border">
      <div className="flex items-center px-4">
        <Link
          href="/"
          className={`inline-flex items-center justify-center border-b-2 p-3 text-sm font-medium transition-colors ${
            pathname === '/'
              ? 'border-black text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
          }`}
        >
          Overview
        </Link>
        <Link
          href="/plugins"
          className={`inline-flex items-center justify-center border-b-2 p-3 text-sm font-medium transition-colors ${
            pathname === '/plugins'
              ? 'border-black text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
          }`}
        >
          Plugins
        </Link>
      </div>
    </div>
  );
};

export const AccountSwitcher: React.FC = () => {
  const router = useRouter();
  const { user, handleLogout: logout } = useAuth();
  const {
    activeOrganization,
    currentUserRole,
    isPersonalAccount,
    userOrganizations,
    switchOrganization,
    switchToPersonalAccount,
    canManageOrganization,
    canManageMembers,
    isSwitching,
  } = useOrganizationContext();

  const [isOpen, setIsOpen] = useState(false);

  const handleSwitchToPersonalAccount = () => {
    switchToPersonalAccount();
    setIsOpen(false);
    toast({
      title: 'Switched to Personal Account',
      description: 'You are now in your personal workspace',
    });
  };

  const handleSwitchOrganization = async (orgId: string) => {
    try {
      await switchOrganization(orgId);
      setIsOpen(false);
      const orgName = userOrganizations.find(o => o.id === orgId)?.name;
      toast({
        title: 'Organization switched',
        description: `Switched to ${orgName}`,
      });
    } catch (err: any) {
      toast({
        title: 'Failed to switch organization',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleLogout = () => {
    logout();
    setIsOpen(false);
  };

  if (!user) return null;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 px-2 py-1.5 h-auto"
          disabled={isSwitching}
        >
          {isPersonalAccount ? (
            <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-medium">
              <User className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
              <Building className="w-4 h-4" />
            </div>
          )}

          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">
              {isPersonalAccount ? 'Personal Account' : activeOrganization?.name || 'Loading...'}
            </span>
          </div>
          <ChevronsUpDown className="ml-auto h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-[--radix-dropdown-menu-trigger-width] min-w-64 rounded-lg"
        align="start"
        sideOffset={4}
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.email}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {isPersonalAccount
                ? 'Personal Account'
                : `${activeOrganization?.name} • ${currentUserRole}`}
            </p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Personal Account */}
        <DropdownMenuItem onClick={handleSwitchToPersonalAccount} className="gap-2 p-2">
          <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-medium text-xs">
            <User className="w-3 h-3" />
          </div>
          <div>
            <div className="font-medium">Personal Account</div>
            <div className="text-xs text-muted-foreground">Individual workspace</div>
          </div>
          {isPersonalAccount && (
            <DropdownMenuShortcut>
              <Check className="h-4 w-4" />
            </DropdownMenuShortcut>
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Organizations */}
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Organizations ({userOrganizations.length})
        </DropdownMenuLabel>

        {userOrganizations.map(org => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => handleSwitchOrganization(org.id)}
            className="gap-2 p-2"
          >
            <div className="w-6 h-6 rounded-sm border border-blue-200 bg-blue-50 flex items-center justify-center">
              <Building className="w-3 h-3 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="font-medium">{org.name}</div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {org.description || 'Organization workspace'}
                </span>
              </div>
            </div>
            {!isPersonalAccount && activeOrganization?.id === org.id && (
              <DropdownMenuShortcut>
                <Check className="h-4 w-4" />
              </DropdownMenuShortcut>
            )}
          </DropdownMenuItem>
        ))}

        <DropdownMenuItem
          className="gap-2 p-2"
          onClick={() => router.push('/organizations/create')}
        >
          <div className="w-6 h-6 rounded-md border bg-background flex items-center justify-center">
            <Plus className="w-4 h-4" />
          </div>
          <div className="font-medium text-muted-foreground">Create organization</div>
        </DropdownMenuItem>

        {/* Organization-specific actions - Only show when in an organization */}
        {!isPersonalAccount && activeOrganization && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {activeOrganization.name} Actions
            </DropdownMenuLabel>

            {canManageOrganization() && (
              <DropdownMenuItem onClick={() => router.push('/settings/organization')}>
                <Settings className="mr-2 h-4 w-4" />
                Organization Settings
              </DropdownMenuItem>
            )}

            {canManageMembers() && (
              <DropdownMenuItem onClick={() => router.push('/settings/members')}>
                <Users className="mr-2 h-4 w-4" />
                Manage Members
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default function Header() {
  const { user, isAuthenticated, handleLogout: logout } = useAuth();
  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (isMobile) {
    return (
      <>
        <header className="w-full bg-background z-40">
          <div className="flex items-center justify-between p-4 h-[72px]">
            <Link href="/" className="flex">
              <Button className="h-12 w-24" variant="ghost" size="icon">
                <Image
                  src="/tensr_logo_light.png"
                  alt="Tensr Logo"
                  height={128}
                  width={128}
                  unoptimized
                />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(true)}
              className="rounded-full"
            >
              <Menu className="!h-6 !w-6" />
            </Button>
          </div>
        </header>
        <MobileMenu
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          user={user}
          logout={logout}
        />
      </>
    );
  }

  return (
    <div className="w-full">
      {/* Main header - not sticky, will scroll out of view */}
      <header className="w-full bg-background z-40 relative">
        <div className="flex justify-between items-center h-16 px-4">
          <div className="flex items-center space-x-1">
            <Link href="/" className="flex">
              <Button variant="link" size="sm">
                <Image
                  src="/tensr_logo_light.png"
                  alt="Tensr Logo"
                  height={24}
                  width={96}
                  unoptimized
                />
              </Button>
            </Link>
            {isAuthenticated && user && <AccountSwitcher />}
          </div>

          <div className="flex items-center space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full h-8 w-8">
                  <Bell className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {/* Mock Notifications */}
                <DropdownMenuItem className="flex flex-col items-start gap-1">
                  <p className="text-sm font-medium leading-none">Goal Due Soon</p>
                  <p className="text-xs leading-snug text-muted-foreground">
                    Your goal Finish header is due tomorrow.
                  </p>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex flex-col items-start gap-1">
                  <p className="text-sm font-medium leading-none">New Comment</p>
                  <p className="text-xs leading-snug text-muted-foreground">
                    New comment on ticket #101.
                  </p>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex flex-col items-start gap-1">
                  <p className="text-sm font-medium leading-none">Workspace Invitation</p>
                  <p className="text-xs leading-snug text-muted-foreground">
                    Oliver Darby invited you to a workspace.
                  </p>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex flex-col items-start gap-1">
                  <p className="text-sm font-medium leading-none">Report Ready</p>
                  <p className="text-xs leading-snug text-muted-foreground">
                    Weekly progress report is ready.
                  </p>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Link href="https://tensr-1.gitbook.io/tensr/">
              <Button variant="outline" size="icon" className="rounded-full h-8 w-8">
                <BookOpen className="h-5 w-5" />
              </Button>
            </Link>
            {isAuthenticated && user && <UserProfileMenu />}
          </div>
        </div>
      </header>

      {/* Navigation tabs - overlapped and sticky */}
      <div className="relative -mt-4 z-50">
        <NavigationTabs />
      </div>
    </div>
  );
}
