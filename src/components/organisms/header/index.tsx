'use client';

import React, { useState } from 'react';
import {
  Search,
  Package,
  Tag,
  History,
  Users,
  User,
  Building,
  Briefcase,
  Check,
} from 'lucide-react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogTrigger } from '@/components/molecules/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/organisms/command';
import { Button } from '@/components/atoms/button';
import { ChevronsUpDown, Plus, ArrowRight } from 'lucide-react';
import { EmailForm, OTPForm } from '@/components/organisms/forms/auth-form';
import useAuth from '@/hooks/api/use-auth';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from '@/components/molecules/navigation-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/molecules/dropdown';

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

        <DropdownMenuItem>
          Profile
          <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>
          Settings
          <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-xs text-muted-foreground">Teams</DropdownMenuLabel>
        {teams.map((team, index) => (
          <DropdownMenuItem
            key={team.name}
            onClick={() => setActiveTeam(team)}
            className="gap-2 p-2"
          >
            <div className="flex size-6 items-center justify-center rounded-sm border">
              {team.logo && <team.logo className="size-4 shrink-0" />}
            </div>
            {team.name}
            {activeTeam.name === team.name && (
              <DropdownMenuShortcut>
                <Check className="h-4 w-4" />
              </DropdownMenuShortcut>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem className="gap-2 p-2">
          <div className="flex size-6 items-center justify-center rounded-md border bg-background">
            <Plus className="size-4" />
          </div>
          <div className="font-medium text-muted-foreground">Add team</div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout} className="text-red-600">
          Log out
          <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const CommandSearch = () => {
  const [open, setOpen] = React.useState(false);
  const commandRef = React.useRef<HTMLDivElement>(null);

  // Set up event listeners to handle clicking outside to close
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (commandRef.current && !commandRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    // Handle Cmd+K shortcut
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
        // Focus the input when opened with keyboard shortcut
        const input = commandRef.current?.querySelector('input');
        if (input) input.focus();
      }

      // Close on escape
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Handle input focus
  const handleFocus = () => setOpen(true);
  const handleBlur = () => {
    // Don't close immediately on blur to allow for clicking on menu items
    // This will be handled by the click outside handler
  };

  return (
    <div className="relative w-full" ref={commandRef}>
      <div className="flex items-center border-0 px-3" cmdk-input-wrapper="">
        <Search className="mr-2 h-5 w-5 shrink-0 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name or cert #"
          className="h-11 w-full bg-transparent py-3 text-sm outline-hidden placeholder:text-gray-400"
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        <span className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded-sm border bg-muted px-1.5 font-mono text-xs font-medium opacity-50">
          <span className="text-xs">⌘</span>K
        </span>
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1">
          <Command className="rounded-md border shadow-md bg-white">
            <CommandList className="max-h-[300px] overflow-y-auto">
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup heading="Suggestions">
                <CommandItem>
                  <span>Popular Cards</span>
                </CommandItem>
                <CommandItem>
                  <History className="mr-2 h-4 w-4" />
                  <span>Trending This Week</span>
                </CommandItem>
                <CommandItem>
                  <span className="mr-2 h-2 w-2 rounded-full bg-red-500" />
                  <span>Live Auctions</span>
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Categories">
                <CommandItem>
                  <Package className="mr-2 h-4 w-4" />
                  <span>Sports Cards</span>
                </CommandItem>
                <CommandItem>
                  <Package className="mr-2 h-4 w-4" />
                  <span>TCG (Trading Card Games)</span>
                </CommandItem>
                <CommandItem>
                  <Package className="mr-2 h-4 w-4" />
                  <span>Memorabilia</span>
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Tools">
                <CommandItem>
                  <Tag className="mr-2 h-4 w-4" />
                  <span>Price Guide</span>
                </CommandItem>
                <CommandItem>
                  <Users className="mr-2 h-4 w-4" />
                  <span>Grading Companies</span>
                </CommandItem>
                <CommandItem>
                  <Search className="mr-2 h-4 w-4" />
                  <span>Certificate Lookup</span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
};

const DefaultTrigger = () => (
  <Button variant="ghost" className="group cursor-pointer">
    Log in
    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
  </Button>
);

const LoginDialog = ({ trigger, className }: { trigger?: React.ReactNode; className?: string }) => {
  // State for the dialog
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [showOTP, setShowOTP] = useState(false);
  const [activeSession, setActiveSession] = useState<string | null>(null);

  // Handle email form success - Now gets the session directly
  const handleEmailSuccess = (emailAddress: string, session: string) => {
    console.log('Email auth success, received session');
    setEmail(emailAddress);
    setActiveSession(session);
    setShowOTP(true);
  };

  // Handle dialog close - reset state
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Only reset form state when dialog closes
      setShowOTP(false);
      setEmail('');
      setActiveSession(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <div className="cursor-pointer">{trigger || <DefaultTrigger />}</div>
      </DialogTrigger>
      <DialogContent className={`sm:max-w-[425px] ${className || ''}`}>
        {showOTP && email && activeSession ? (
          <OTPForm email={email} session={activeSession} />
        ) : (
          <EmailForm onSuccess={handleEmailSuccess} />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();

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

  return (
    <header>
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-border">
        <div className="flex items-center space-x-8">
          <h1 className="text-xl font-bold text-gray-800">Projects</h1>
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <Link href="/docs" legacyBehavior passHref>
                  <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                    Documentation
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <Link href="/docs" legacyBehavior passHref>
                  <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                    Documentation
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <Link href="/docs" legacyBehavior passHref>
                  <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                    Documentation
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <Link href="/docs" legacyBehavior passHref>
                  <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                    Documentation
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>
        <div className="flex items-center space-x-4">
          {isAuthenticated && user ? (
            <AccountSwitcher teams={teams} user={user} onLogout={handleLogout} />
          ) : (
            <LoginDialog />
          )}
        </div>
      </div>
    </header>
  );
}
