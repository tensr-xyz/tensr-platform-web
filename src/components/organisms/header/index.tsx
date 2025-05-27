'use client';

import React, { useState } from 'react';
import {
  User,
  Building,
  Briefcase,
  X,
  Menu,
  Check,
  Plus,
  Settings,
  Users,
  LogOut,
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
import { Organization, useOrganization } from '@/hooks/api/use-organisation';
import { toast } from '@/hooks/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/molecules/dialog';
import { Input } from '@/components/atoms/input';
import { Label } from '@/components/atoms/label';

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
            <Image src="/tensr_logo_light.png" alt="Tensr Logo" height={24} width={96} />
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
              <div>
                <p className="font-medium">{user.email}</p>
                <p className="text-sm text-gray-600">{user.subscriptionTier}</p>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 border-t border-border mt-auto">
          {isAuthenticated && (
            <div>
              <Link href="/settings/account" onClick={onClose}>
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

const NavigationTabs = () => {
  const pathname = usePathname();

  // Only the Overview tab as requested
  const tabs = [{ name: 'Overview', path: '/' }];

  return (
    <div>
      <div className="flex h-10 items-center px-4">
        {tabs.map(tab => (
          <Link
            key={tab.path}
            href={tab.path}
            className={`inline-flex h-10 items-center justify-center border-b-2 px-4 pt-1 text-sm font-medium transition-colors ${
              pathname === tab.path
                ? 'border-black text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
            }`}
          >
            {tab.name}
          </Link>
        ))}
      </div>
    </div>
  );
};

export const AccountSwitcher = React.memo(
  ({ user, onLogout }: { user: any; onLogout?: () => void }) => {
    const router = useRouter();
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newOrgName, setNewOrgName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const {
      organizations,
      activeOrganization,
      setActiveOrganization,
      createOrganization,
      fetchOrganizations,
      isLoading,
    } = useOrganization();

    const handleDropdownOpenChange = (open: boolean) => {
      if (open && organizations.length === 0) {
        fetchOrganizations();
      }
    };

    const handleCreateOrganization = async () => {
      if (!newOrgName.trim()) return;

      setIsCreating(true);
      try {
        const newOrg = await createOrganization({ name: newOrgName });
        toast({
          title: 'Organization created',
          description: `${newOrgName} has been created successfully.`,
        });
        setShowCreateDialog(false);
        setNewOrgName('');

        // Navigate to the new organization's settings page
        router.push('/settings/organisation');
      } catch (err: any) {
        toast({
          title: 'Failed to create organization',
          description: err.message || 'An error occurred while creating the organization',
          variant: 'destructive',
        });
      } finally {
        setIsCreating(false);
      }
    };

    const handleSwitchOrganization = (org: Organization) => {
      setActiveOrganization(org);
      // Optional: refresh relevant data or navigate to a specific page
      router.push('/');
    };

    const handleOrganizationSettings = () => {
      router.push('/settings/organisation');
    };

    const handleTeamMembers = () => {
      router.push('/settings/members');
    };

    if (!user) {
      return null;
    }

    return (
      <>
        <DropdownMenu onOpenChange={handleDropdownOpenChange}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2 py-1.5 h-auto">
              {activeOrganization ? (
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                  {activeOrganization.name.charAt(0).toUpperCase()}
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-medium">
                  {user.email.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {activeOrganization ? activeOrganization.name : user.name || user.email}
                </span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg border-border"
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user.name || user.email}</p>
                <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <Link href="/settings/account">
              <DropdownMenuItem>
                Settings
                <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
              </DropdownMenuItem>
            </Link>

            <DropdownMenuSeparator />

            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Organizations
            </DropdownMenuLabel>
            {organizations.map(org => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => handleSwitchOrganization(org)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-sm border border-blue-200 bg-blue-50">
                  {org.name.charAt(0).toUpperCase()}
                </div>
                {org.name}
                {activeOrganization?.id === org.id && (
                  <DropdownMenuShortcut>
                    <Check className="h-4 w-4" />
                  </DropdownMenuShortcut>
                )}
              </DropdownMenuItem>
            ))}

            <DropdownMenuItem className="gap-2 p-2" onClick={() => setShowCreateDialog(true)}>
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <Plus className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">Create organization</div>
            </DropdownMenuItem>

            {activeOrganization && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Organization Settings
                </DropdownMenuLabel>

                <DropdownMenuItem onClick={handleOrganizationSettings}>
                  <Settings className="mr-2 h-4 w-4" />
                  Organization Settings
                </DropdownMenuItem>

                <DropdownMenuItem onClick={handleTeamMembers}>
                  <Users className="mr-2 h-4 w-4" />
                  Team Members
                </DropdownMenuItem>
              </>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
              <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Create Organization Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Organization</DialogTitle>
            </DialogHeader>

            <div className="py-4">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                value={newOrgName}
                onChange={e => setNewOrgName(e.target.value)}
                placeholder="Enter organization name"
                className="mt-1"
                autoFocus
              />
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateOrganization}
                disabled={!newOrgName.trim() || isCreating}
              >
                {isCreating ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }
);

AccountSwitcher.displayName = 'AccountSwitcher';

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Sample team data - replace with your actual team data source
  const teams = [
    {
      name: 'Personal Account',
      logo: User,
      plan: 'Free',
    },
    {
      name: 'Acme Inc',
      logo: Building,
      plan: 'Pro',
    },
    {
      name: 'Monsters Inc',
      logo: Briefcase,
      plan: 'Team',
    },
  ];

  // Handle logout
  const handleLogout = () => {
    if (logout) {
      logout();
    }
  };

  if (isMobile) {
    return (
      <>
        <header className="w-full bg-background z-40">
          <div className="flex items-center justify-between p-4 h-[72px]">
            <Link href="/" className="flex">
              <Button className="h-12 w-24" variant="ghost" size="icon">
                <Image src="/tensr_logo_light.png" alt="Tensr Logo" height={128} width={128} />
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
    <header>
      <div className="flex flex-col justify-between px-1 pt-2 bg-background border-b border-border">
        <div className="flex justify-between items-center space-x-4">
          <Link href="/" className="flex">
            <Button variant="link" size="sm">
              <Image src="/tensr_logo_light.png" alt="Tensr Logo" height={24} width={96} />
            </Button>
          </Link>
          <div className="flex items-center space-x-4 px-4">
            {isAuthenticated && user && <AccountSwitcher user={user} onLogout={handleLogout} />}
          </div>
          {/*<NavigationMenu>*/}
          {/*  <NavigationMenuList>*/}
          {/*    <NavigationMenuItem>*/}
          {/*      <Link href="/plugins" legacyBehavior passHref>*/}
          {/*        <NavigationMenuLink className={navigationMenuTriggerStyle()}>*/}
          {/*          Plugins*/}
          {/*        </NavigationMenuLink>*/}
          {/*      </Link>*/}
          {/*    </NavigationMenuItem>*/}

          {/*    <NavigationMenuItem>*/}
          {/*      <Link href="/docs" legacyBehavior passHref>*/}
          {/*        <NavigationMenuLink className={navigationMenuTriggerStyle()}>*/}
          {/*          Documentation*/}
          {/*        </NavigationMenuLink>*/}
          {/*      </Link>*/}
          {/*    </NavigationMenuItem>*/}
          {/*  </NavigationMenuList>*/}
          {/*</NavigationMenu>*/}
        </div>
        <NavigationTabs />
      </div>
    </header>
  );
}
