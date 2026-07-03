'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutGrid,
  Compass,
  Settings,
  HelpCircle,
  Sparkles,
  Bell,
  Search,
  Upload,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { DatasetFilePicker } from '@/components/molecules/dataset-file-picker';
import { FeedbackDialog } from '@/components/molecules/feedback-button';
import { ThemeToggle } from '@/components/molecules/theme-toggle';
import useAuth from '@/hooks/api/use-auth';
import Titlebar from '@/components/organisms/titlebar';
import { useTabsStore } from '@/stores/tabs-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/molecules/dropdown';
import { Avatar, AvatarFallback } from '@/components/atoms/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/molecules/tabs';

/** Overview, Plugins, and Settings: no workspace titlebar / app sidebar. */
function isMinimalAppShellPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname === '/dashboard') return true;
  if (pathname === '/plugins') return true;
  if (pathname.startsWith('/plugins/')) return true;
  if (pathname.startsWith('/settings')) return true;
  return false;
}

function getMinimalShellTab(pathname: string): 'overview' | 'plugins' {
  if (pathname === '/plugins' || pathname.startsWith('/plugins/')) return 'plugins';
  return 'overview';
}

const getInitials = (value: string) => {
  if (!value) return '??';
  const [localPart] = value.split('@');
  if (!localPart) {
    return value.slice(0, 2).toUpperCase();
  }
  return localPart.slice(0, 2).toUpperCase();
};

const NotificationMenu: React.FC = () => (
  <div className="flex h-10 w-10 items-center justify-center">
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative inline-flex h-[38px] w-[38px] items-center justify-center rounded-full transition-all border border-border hover:bg-gray-200 dark:hover:bg-gray-900/50"
        >
          <Bell className="h-[15px] w-[15px]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px]">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="flex flex-col items-start gap-1 py-2">
          <p className="text-sm leading-none">All caught up</p>
          <p className="text-xs text-muted-foreground">You do not have new alerts right now.</p>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);

function MinimalShellNavTabs({ pathname }: { pathname: string }) {
  const router = useRouter();
  const isSettings = pathname.startsWith('/settings');
  const value = isSettings ? '' : getMinimalShellTab(pathname);

  return (
    <Tabs
      value={value}
      onValueChange={v => {
        router.push(v === 'plugins' ? '/plugins' : '/dashboard');
      }}
      className="w-auto"
    >
      <TabsList className="inline-flex h-9 items-center gap-0 rounded-full border border-border bg-muted p-1 text-muted-foreground shadow-none">
        <TabsTrigger
          value="overview"
          isClosable={false}
          className="rounded-full px-4 py-1.5 text-xs font-medium data-[state=active]:shadow-sm"
        >
          Overview
        </TabsTrigger>
        <TabsTrigger
          value="plugins"
          isClosable={false}
          className="rounded-full px-4 py-1.5 text-xs font-medium data-[state=active]:shadow-sm"
        >
          Plugins
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

const UserMenu: React.FC = () => {
  const { user, handleLogout } = useAuth();
  const [feedbackOpen, setFeedbackOpen] = React.useState(false);

  if (!user) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="group flex h-10 w-auto cursor-pointer select-none items-center gap-1 rounded-full border border-border pr-3 pl-1.5 transition-all duration-200 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-black/20 sm:w-[164px] sm:pr-3 sm:pl-1.5 dark:hover:bg-gray-900/50 dark:focus:ring-white/20"
          >
            <div className="relative h-7 w-7 flex-shrink-0 overflow-hidden rounded-full bg-gradient-to-b from-white/60 via-white/30 to-white/10 p-[0.5px]">
              <div className="h-full w-full overflow-hidden rounded-full bg-background">
                <Avatar className="h-full w-full">
                  <AvatarFallback className="text-xs">{getInitials(user.email)}</AvatarFallback>
                </Avatar>
              </div>
            </div>
            <div className="hidden flex-1 flex-row items-center gap-0 sm:flex">
              <span className="font-normal text-foreground text-sm leading-5 tracking-[-0.02em]">
                {user.email.slice(0, 8)}...
              </span>
            </div>
            <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-background">
              <svg
                fill="none"
                height="16"
                viewBox="0 0 16 16"
                width="16"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="3.5" cy="8" fill="#909090" r="1.5" />
                <circle cx="8" cy="8" fill="#909090" r="1.5" />
                <circle cx="12.5" cy="8" fill="#909090" r="1.5" />
              </svg>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm leading-none">{user.email}</p>
              <p className="text-xs leading-none text-muted-foreground">{user.subscriptionTier}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings/general" className="cursor-pointer">
              <Settings className="size-4 shrink-0" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onSelect={() => setFeedbackOpen(true)}>
            <MessageSquare className="size-4 shrink-0" />
            Feedback
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
};

const SharedHeader: React.FC = () => {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const isMinimalShell = isMinimalAppShellPath(pathname);

  return (
    <div className="sticky top-0 z-20 bg-background">
      <header
        className="relative flex h-[80px] min-h-[80px] w-full items-center justify-between overflow-hidden bg-transparent"
        style={{ paddingLeft: '28px', paddingRight: '14px' }}
      >
        <div className="-z-10 absolute inset-0 bg-background" />
        <div className="relative z-[1] flex min-w-0 flex-1 items-center gap-2 md:gap-4">
          {isMinimalShell ? (
            <nav aria-label="Primary">
              <MinimalShellNavTabs pathname={pathname} />
            </nav>
          ) : null}
        </div>
        {!isMinimalShell && (
          <div className="hidden w-full max-w-[400px] items-center lg:flex lg:ml-4 lg:justify-start xl:-translate-x-1/2 xl:-translate-y-1/2 xl:absolute xl:top-1/2 xl:left-1/2 xl:z-[1] xl:ml-0 xl:justify-center">
            <div className="w-full">
              <div className="hidden h-12 w-full max-w-[400px] sm:flex flex cursor-pointer flex-row items-center justify-between gap-3 border pr-2.5 pl-4 transition-all bg-background border-black/[0.06] shadow-[0px_0px_4px_rgba(0,0,0,0.02),0px_2px_2px_rgba(0,0,0,0.04)] rounded-[24px]">
                <div className="flex flex-1 items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center">
                    <Search className="h-5 w-5" />
                  </div>
                  <input
                    value={searchTerm}
                    onChange={event => setSearchTerm(event.target.value)}
                    className="text-sm leading-5 tracking-tight flex-1 bg-transparent border-none outline-none focus:outline-none"
                    placeholder="Search datasets..."
                    style={{ color: 'rgb(216, 216, 216)' }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="relative z-[1] flex shrink-0 items-center gap-2">
          {isAuthenticated ? <UserMenu /> : null}
        </div>
      </header>
    </div>
  );
};

interface SharedLayoutProps {
  children: React.ReactNode;
}

function SharedFooter() {
  return (
    <footer className="mt-auto shrink-0 border-t border-border bg-background py-6">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-4 px-4 md:flex-row md:px-8">
        <div className="flex flex-col items-center gap-3 md:flex-row md:items-center md:gap-6 md:justify-start">
          <Link
            href="/dashboard"
            className="flex h-[18px] w-[112px] shrink-0 items-center justify-center md:justify-start"
            aria-label="Tensr home"
          >
            <Image
              src="/tensr_logo_light.png"
              alt=""
              width={112}
              height={16}
              className="dark:hidden block h-4 w-[112px] object-contain object-left"
            />
            <Image
              src="/tensr_logo_dark.png"
              alt=""
              width={112}
              height={16}
              className="hidden dark:block h-4 w-[112px] object-contain object-left"
            />
          </Link>
          <span className="flex max-w-xs items-center text-center text-[11px] leading-snug text-muted-foreground md:text-left">
            Modern collaborative statistical workspace
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-6 md:justify-end">
          <a href="#" className="text-[11px] text-muted-foreground hover:text-foreground">
            Documentation
          </a>
          <a href="#" className="text-[11px] text-muted-foreground hover:text-foreground">
            API reference
          </a>
          <a href="#" className="text-[11px] text-muted-foreground hover:text-foreground">
            Support
          </a>
        </div>
        <div className="flex items-center gap-1 md:ml-4">
          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
}

export const SharedLayout: React.FC<SharedLayoutProps> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { tabs, activeTabId, closeTab } = useTabsStore();
  const activeTab = tabs.find(tab => tab.id === activeTabId);
  const isMinimalShell = isMinimalAppShellPath(pathname);

  if (isMinimalShell) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SharedHeader />
        <div className="flex min-h-0 flex-1 flex-col">
          <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            <div className="relative flex w-full min-h-full flex-col bg-background px-2 md:px-8">
              <div className="relative mx-auto flex w-full max-w-[1440px] flex-1 flex-col pb-8">
                {children}
              </div>
            </div>
          </main>
          <SharedFooter />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Titlebar
        onToggleSidebar={() => {}}
        tabs={tabs}
        activeTab={activeTab}
        onTabClose={closeTab}
      />
      <div
        className="group/sidebar-wrapper flex min-h-svh w-full"
        style={{ '--sidebar-width-icon': '3rem' } as React.CSSProperties}
      >
        <div className="flex h-screen w-full flex-col">
          <SharedHeader />
          <div className="flex h-full w-full overflow-x-hidden">
            <aside
              className="group peer sticky top-0 h-full md:block"
              data-collapsible=""
              data-side="left"
              data-state="expanded"
              data-variant="inset"
            >
              <div
                className="h-full transition-[left,right,width] duration-200 ease-linear left-0"
                style={{ width: 'var(--sidebar-width)' }}
              >
                <div
                  className="flex h-full w-full flex-col bg-background group-data-[variant=floating]:shadow"
                  data-sidebar="sidebar"
                >
                  <div
                    className="min-h-0 flex-1 overflow-auto scrollbar-hide group-data-[collapsible=icon]:overflow-hidden flex h-[calc(100vh-80px-40px)] flex-col gap-0 border-stroke-separator/[0.06] border-r dark:border-stroke-separator/[0.12]"
                    data-sidebar="content"
                  >
                    <div className="flex flex-1 flex-col justify-between px-4 py-4">
                      <ul className="w-full min-w-0 gap-1 flex flex-col" data-sidebar="menu">
                        <div className="flex flex-col gap-1.5">
                          <li className="group/menu-item relative" data-sidebar="menu-item">
                            <Link href="/dashboard">
                              <button
                                className="peer/menu-button group-data-[collapsible=icon]:!size-8 flex w-full items-center gap-2 overflow-hidden rounded-full p-4 px-3 text-left outline-none ring-sidebar-ring transition-[width,height,padding] focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[state=open]:hover:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 group-data-[collapsible=icon]:!p-0 text-sm h-12 border border-transparent stroke-current text-muted-foreground hover:text-foreground data-[active=true]:text-foreground cursor-pointer"
                                data-active={pathname === '/'}
                                data-sidebar="menu-button"
                                data-size="lg"
                              >
                                <div className="flex min-w-0 flex-row items-center justify-start gap-3 overflow-hidden">
                                  <LayoutGrid className="size-4 shrink-0" />
                                  <span className="truncate whitespace-nowrap text-sm">
                                    Overview
                                  </span>
                                </div>
                              </button>
                            </Link>
                          </li>
                          <li className="group/menu-item relative" data-sidebar="menu-item">
                            <Link href="/plugins">
                              <button
                                className="peer/menu-button group-data-[collapsible=icon]:!size-8 flex w-full items-center gap-2 overflow-hidden rounded-full p-4 px-3 text-left outline-none ring-sidebar-ring transition-[width,height,padding] focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[state=open]:hover:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 group-data-[collapsible=icon]:!p-0 text-sm h-12 border border-transparent stroke-current text-muted-foreground hover:text-foreground data-[active=true]:text-foreground cursor-pointer"
                                data-active={
                                  pathname === '/plugins' || pathname?.startsWith('/plugins/')
                                }
                                data-sidebar="menu-button"
                                data-size="lg"
                              >
                                <div className="flex min-w-0 flex-row items-center justify-start gap-3 overflow-hidden">
                                  <Compass className="size-4 shrink-0" />
                                  <span className="truncate whitespace-nowrap text-sm">
                                    Plugins
                                  </span>
                                </div>
                              </button>
                            </Link>
                          </li>
                        </div>
                      </ul>
                      <div className="flex flex-col gap-1.5">
                        <ul className="w-full min-w-0 gap-1 flex flex-col" data-sidebar="menu">
                          <li className="group/menu-item relative" data-sidebar="menu-item">
                            <Link href="/settings/general">
                              <button
                                className="peer/menu-button group-data-[collapsible=icon]:!size-8 flex w-full items-center gap-2 overflow-hidden rounded-full p-4 px-3 text-left outline-none ring-sidebar-ring transition-[width,height,padding] focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[state=open]:hover:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 group-data-[collapsible=icon]:!p-0 text-sm h-12 stroke-current text-muted-foreground hover:text-foreground data-[active=true]:text-foreground cursor-pointer"
                                data-active={pathname?.startsWith('/settings')}
                                data-sidebar="menu-button"
                                data-size="lg"
                              >
                                <div className="flex min-w-0 flex-row items-center justify-start gap-3 overflow-hidden">
                                  <Settings className="size-4 shrink-0" />
                                  <span className="truncate whitespace-nowrap text-sm">
                                    Settings
                                  </span>
                                </div>
                              </button>
                            </Link>
                          </li>
                          <li className="group/menu-item relative" data-sidebar="menu-item">
                            <button
                              className="peer/menu-button group-data-[collapsible=icon]:!size-8 flex w-full items-center gap-2 overflow-hidden rounded-full p-4 px-3 text-left outline-none ring-sidebar-ring transition-[width,height,padding] focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[state=open]:hover:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 group-data-[collapsible=icon]:!p-0 text-sm h-12 stroke-current text-muted-foreground hover:text-foreground data-[active=true]:text-foreground cursor-pointer"
                              data-active="false"
                              data-sidebar="menu-button"
                              data-size="lg"
                            >
                              <div className="flex flex-row items-center justify-center gap-3">
                                <HelpCircle className="size-4" />
                                <span className="text-sm">Help</span>
                              </div>
                            </button>
                          </li>
                          <li
                            className="group/menu-item relative flex items-center px-3"
                            data-sidebar="menu-item"
                          >
                            <span className="mr-2 text-sm text-muted-foreground">Theme</span>
                            <ThemeToggle />
                          </li>
                        </ul>
                        <div className="mt-4">
                          <div className="rounded-3xl border border-black/[0.05] bg-background p-4 shadow-sm">
                            <div className="flex items-center gap-2 text-sm text-gray-900">
                              <Sparkles className="size-4 text-primary" aria-hidden />
                              Create
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              Upload a dataset to open it in the workspace and run analyses.
                            </p>
                            <div className="mt-4 flex w-full flex-col gap-2">
                              <DatasetFilePicker
                                onUploaded={(datasetId, fileName) =>
                                  router.push(
                                    `/workspace/dataset/${datasetId}?name=${encodeURIComponent(fileName)}`
                                  )
                                }
                              >
                                <Button variant="outline" size="sm" className="w-full rounded-full">
                                  <Upload className="mr-2 size-4" />
                                  Upload dataset
                                </Button>
                              </DatasetFilePicker>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
            <main className="flex min-w-0 flex-1 flex-col bg-background overflow-x-hidden h-[calc(100vh-80px-40px)]">
              <div className="relative h-full">
                <div className="flex h-full flex-col">
                  <div className="flex flex-1 flex-col overflow-y-auto">
                    <div className="relative flex w-full flex-1 flex-col bg-background px-2 md:px-8">
                      <div className="relative flex w-full max-w-[1440px] flex-1 flex-col">
                        {children}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
};
