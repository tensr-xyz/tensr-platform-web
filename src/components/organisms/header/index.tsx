'use client';

import React, { useState } from 'react';
import { User, Building, Briefcase, X, Menu } from 'lucide-react';
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
      <div className="flex items-center justify-between p-4 h-[72px] border-b">
        <Link href="/" className="flex" onClick={onClose}>
          <Button variant="link" size="sm">
            <Image src="/tensr_logo_light.png" alt="Tensr Logo" height={24} width={96} />
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="rounded-full border active:border-black"
        >
          <X className="h-6 w-6" />
        </Button>
      </div>

      {/* Mobile Menu Content */}
      <div className="flex flex-col h-[calc(100vh-72px)] overflow-y-auto">
        {/* User Section */}
        {isAuthenticated && (
          <div className="p-4 border-b">
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

        {/* Navigation Links */}
        <div className="px-4">
          <Link href="/documentation" onClick={onClose}>
            <div className="text-lg font-medium p-2">Documentation</div>
          </Link>
          <Link href="/plugins" onClick={onClose}>
            <div className="text-lg font-medium p-2">Plugins</div>
          </Link>
        </div>

        <div className="p-4 border-t mt-auto">
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

        {/* Download Button */}
        <div className="p-4 border-t mt-auto">
          <Link href="/download" onClick={onClose}>
            <Button
              variant="default"
              className="w-full border border-black text-black bg-white rounded-full hover:bg-[#c4d4f6]"
            >
              Download
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export function AccountSwitcher({
  teams,
  user,
  onLogout,
}: {
  teams: {
    name: string;
    logo: React.ElementType;
    plan: string;
  }[];
  user: any;
  onLogout?: () => void;
}) {
  const [activeTeam, setActiveTeam] = React.useState(teams[0]);

  if (!activeTeam || !user) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 px-2 py-1.5 h-auto">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
            {user.email.charAt(0).toUpperCase()}
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">{activeTeam.name}</span>
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

        {/*<DropdownMenuSeparator />*/}

        {/*<DropdownMenuLabel className="text-xs text-muted-foreground">Teams</DropdownMenuLabel>*/}
        {/*{teams.map((team, index) => (*/}
        {/*  <DropdownMenuItem*/}
        {/*    key={team.name}*/}
        {/*    onClick={() => setActiveTeam(team)}*/}
        {/*    className="gap-2 p-2"*/}
        {/*  >*/}
        {/*    <div className="flex size-6 items-center justify-center rounded-sm border">*/}
        {/*      {team.logo && <team.logo className="size-4 shrink-0" />}*/}
        {/*    </div>*/}
        {/*    {team.name}*/}
        {/*    {activeTeam.name === team.name && (*/}
        {/*      <DropdownMenuShortcut>*/}
        {/*        <Check className="h-4 w-4" />*/}
        {/*      </DropdownMenuShortcut>*/}
        {/*    )}*/}
        {/*  </DropdownMenuItem>*/}
        {/*))}*/}
        {/*<DropdownMenuItem className="gap-2 p-2">*/}
        {/*  <div className="flex size-6 items-center justify-center rounded-md border bg-background">*/}
        {/*    <Plus className="size-4" />*/}
        {/*  </div>*/}
        {/*  <div className="font-medium text-muted-foreground">Add team</div>*/}
        {/*</DropdownMenuItem>*/}

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout} className="text-red-600">
          Log out
          <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
      <div className="flex items-center justify-between px-6 py-3 bg-background border-b border-border">
        <div className="flex items-center space-x-4">
          <Link href="/" className="flex">
            <Button variant="link" size="sm">
              <Image src="/tensr_logo_light.png" alt="Tensr Logo" height={24} width={96} />
            </Button>
          </Link>
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
        <div className="flex items-center space-x-4">
          {isAuthenticated && user && (
            <AccountSwitcher teams={teams} user={user} onLogout={handleLogout} />
          )}
        </div>
      </div>
    </header>
  );
}
