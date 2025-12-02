'use client';

import {
  Settings2,
  Zap,
  Home,
  ChevronRight,
  ChevronsUpDown,
  LogOut,
  Package,
  ShoppingCart,
  FileText,
  Store,
  User,
  Wallet,
  Building,
  Check,
  Plus,
  Settings,
  Users,
  Bell,
  BookOpen,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import * as React from 'react';
import { useState } from 'react';
import Image from 'next/image';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/atoms/avatar';
import { Button } from '@/components/atoms/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/atoms/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuShortcut,
} from '@/components/molecules/dropdown';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/organisms/sidebar';
import useAuth from '@/hooks/api/use-auth';
import { User as UserType } from '@/types/user';
import { useOrganizationContext } from '@/contexts/organisation-context';
import { PermissionWrapper } from '@/wrappers/permission';
import { toast } from '@/hooks/ui/use-toast';

const getInitials = (email: string) => {
  if (!email) return '??';
  const localPart = email.split('@')[0];
  const parts = localPart.split(/[._-]/).filter(part => part.length > 0);

  if (parts.length > 1) {
    return parts.map(part => part[0].toUpperCase()).join('');
  }

  return localPart.length > 1 ? localPart.slice(0, 2).toUpperCase() : localPart[0].toUpperCase();
};

// Navigation data based on the header content
const navItems = [
  {
    title: 'Overview',
    url: '/',
    icon: Home,
    items: [],
  },
  {
    title: 'Plugins',
    url: '/plugins',
    icon: Package,
    items: [],
  },
];

function ControlCenter() {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const { user, handleLogout } = useAuth();
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

  const handleLogoutClick = () => {
    handleLogout();
    setIsOpen(false);
  };

  if (!user) return null;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer"
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
                  {isPersonalAccount
                    ? 'Personal Account'
                    : activeOrganization?.name || 'Loading...'}
                </span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
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

            <DropdownMenuSeparator />

            {/* Settings, Profile */}
            <DropdownMenuItem onClick={() => router.push('/settings/general')}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
              <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogoutClick} className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
              <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function NavMain({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon?: React.ElementType;
    isActive?: boolean;
    items?: {
      title: string;
      url: string;
    }[];
  }[];
}) {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Navigation</SidebarGroupLabel>
      <SidebarMenu>
        {items.map(item => {
          const Icon = item.icon;
          const isActive = pathname === item.url || pathname.startsWith(`${item.url}/`);

          return (
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={isActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={isActive}
                    asChild={!item.items || item.items.length === 0}
                    className="cursor-pointer"
                  >
                    {!item.items || item.items.length === 0 ? (
                      <Link href={item.url} className="cursor-pointer">
                        {Icon && <Icon />}
                        <span>{item.title}</span>
                      </Link>
                    ) : (
                      <>
                        {Icon && <Icon />}
                        <span>{item.title}</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </>
                    )}
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                {item.items && item.items.length > 0 && (
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items.map(subItem => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild>
                            <Link href={subItem.url}>
                              <span>{subItem.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                )}
              </SidebarMenuItem>
            </Collapsible>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, isAuthenticated } = useAuth();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        {/* <div className="flex items-center justify-center p-4">
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
        </div> */}
        {isAuthenticated && user && <ControlCenter />}
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />

        {/* Additional Actions - Always show these */}
        <SidebarGroup>
          <SidebarGroupLabel>Actions</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton className="cursor-pointer">
                    <Bell className="h-4 w-4" />
                    <span>Notifications</span>
                  </SidebarMenuButton>
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
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild className="cursor-pointer">
                <Link href="https://tensr-1.gitbook.io/tensr/">
                  <BookOpen className="h-4 w-4" />
                  <span>Documentation</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
