import React, { useState } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/organisms/sidebar';
import { useApp } from '@/contexts/app-context';
import { DialogType } from '@/contexts/app-context/types';
import NewProject from './new-project';
import { Settings } from '@/components/templates/settings';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/molecules/dropdown';
import { Button } from '@/components/atoms/button';
import { LuSettings } from 'react-icons/lu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/molecules/dialog';

const Projects = React.lazy(() => import('./projects'));
const Customise = React.lazy(() => import('./customise'));
const Plugins = React.lazy(() => import('./plugins'));

export default function AppWizard() {
  const [currentRoute, setCurrentRoute] = useState('projects');
  const { state: appState } = useApp();

  const navigationItems = [
    { id: 'projects', name: 'Projects', component: Projects },
    { id: 'customize', name: 'Customize', component: Customise },
    { id: 'plugins', name: 'Plugins', component: Plugins },
  ];

  const renderContent = () => {
    const route = navigationItems.find(item => item.id === currentRoute);
    if (!route) return null;

    const RouteComponent = route.component;
    return (
      <React.Suspense fallback={<div className="p-4">Loading...</div>}>
        <RouteComponent />
      </React.Suspense>
    );
  };

  return (
    <div className="h-screen w-screen flex flex-col">
      {/* Titlebar */}
      <div className="h-8 min-h-8 bg-foreground border-b border-background flex items-stretch relative shrink-0">
        <div className="absolute left-0 top-0 h-full w-20" />
        <div className="flex-1 flex justify-center items-center h-full">
          <span className="text-xs font-bold truncate">
            {appState.activeDialog !== DialogType.NEW_PROJECT ? 'Welcome to Tensr' : 'New Project'}
          </span>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {appState.activeDialog === DialogType.NEW_PROJECT ? (
          <NewProject />
        ) : (
          <div className="flex w-full">
            <Sidebar collapsible="none" className="border-r bg-foreground p-1 w-52 shrink-0">
              <SidebarHeader className="h-16 mb-4">
                <img src="src/assets/tensr.png" alt="Tensr logo" className="p-2" />
              </SidebarHeader>
              <SidebarContent className="p-2">
                <SidebarMenu>
                  {navigationItems.map(item => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={currentRoute === item.id}
                        className="hover:bg-neutral-200 active:bg-neutral-200 w-full"
                        onClick={() => setCurrentRoute(item.id)}
                      >
                        <button className="w-full truncate text-left px-2 py-1">
                          <span>{item.name}</span>
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarContent>
              <SidebarFooter>
                <DropdownMenu>
                  <DropdownMenuTrigger className="h-8 w-8">
                    <Button variant="ghost" size="icon" title="Settings" className="h-8 w-8">
                      <LuSettings className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="max-w-64" align="start">
                    <Dialog>
                      <DialogTrigger className="w-full">
                        <DropdownMenuItem onSelect={e => e.preventDefault()}>
                          About
                        </DropdownMenuItem>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Are you absolutely sure?</DialogTitle>
                          <DialogDescription>
                            This action cannot be undone. This will permanently delete your account
                            and remove your data from our servers.
                          </DialogDescription>
                        </DialogHeader>
                      </DialogContent>
                    </Dialog>
                    <Dialog>
                      <DialogTrigger className="w-full">
                        <DropdownMenuItem onSelect={e => e.preventDefault()}>
                          Manage Licenses
                        </DropdownMenuItem>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Are you absolutely sure?</DialogTitle>
                          <DialogDescription>
                            This action cannot be undone. This will permanently delete your account
                            and remove your data from our servers.
                          </DialogDescription>
                        </DialogHeader>
                      </DialogContent>
                    </Dialog>
                    <Dialog>
                      <DialogTrigger className="w-full">
                        <DropdownMenuItem onSelect={e => e.preventDefault()}>
                          Check for Updates
                        </DropdownMenuItem>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Are you absolutely sure?</DialogTitle>
                          <DialogDescription>
                            This action cannot be undone. This will permanently delete your account
                            and remove your data from our servers.
                          </DialogDescription>
                        </DialogHeader>
                      </DialogContent>
                    </Dialog>
                    <DropdownMenuItem onSelect={e => e.preventDefault()}>
                      <Settings trigger={<div>Settings</div>} />
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarFooter>
            </Sidebar>
            <main className="flex-1 min-w-0 overflow-auto">{renderContent()}</main>
          </div>
        )}
      </div>
    </div>
  );
}
