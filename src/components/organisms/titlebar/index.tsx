import React from 'react';
import {
  LuCalculator,
  LuCalendar,
  LuPanelBottom,
  LuPanelLeft,
  LuPanelRight,
  LuSearch,
  LuSettings,
} from 'react-icons/lu';
import { Button } from '@/components/atoms/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/organisms/command';
import { Settings } from '@/components/templates/settings';
import { useProject } from '@/contexts/project-context';
import { ProjectActions } from '@/contexts/project-context/types';
import { Separator } from '@/components/atoms/separator';
import { ProjectMenu } from '@/components/organisms/project-menu';

interface TitlebarProps {
  onToggleSidebar: () => void;
}

const Titlebar = ({ onToggleSidebar }: TitlebarProps) => {
  const [isCommandOpen, setIsCommandOpen] = React.useState(false);
  const { state, dispatch } = useProject();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsCommandOpen(open => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <>
      <div className="h-9 bg-foreground border-b border-background flex items-stretch relative">
        {/* Traffic light spacing for macOS - adjust left padding based on platform */}
        <div className="absolute left-0 top-0 h-full w-20" />

        {/* Main titlebar content */}
        <div className="flex-1 flex justify-between items-center">
          {/* Left section */}
          <div className="flex items-center h-full">
            <div className="pl-20 flex items-center gap-4">
              <ProjectMenu />
            </div>
          </div>

          {/* Right section */}
          <div className="flex items-center h-full gap-1">
            <Button
              data-sidebar="trigger"
              variant="ghost"
              size="icon"
              onClick={() =>
                dispatch({
                  type: ProjectActions.TOGGLE_LEFT_SIDEBAR,
                  payload: !state.leftSidebarOpen,
                })
              }
              className="h-8"
            >
              <LuPanelLeft className="size-4" />
              <span className="sr-only">Toggle Sidebar</span>
            </Button>
            <Button
              data-sidebar="trigger"
              variant="ghost"
              size="icon"
              onClick={() =>
                dispatch({ type: ProjectActions.TOGGLE_FOOTER, payload: !state.footerOpen })
              }
              className="h-8"
            >
              <LuPanelBottom className="size-4" />
              <span className="sr-only">Toggle Footer</span>
            </Button>
            <Button
              data-sidebar="trigger"
              variant="ghost"
              size="icon"
              onClick={onToggleSidebar}
              className="h-8"
            >
              <LuPanelRight className="size-4" />
              <span className="sr-only">Toggle Sidebar</span>
            </Button>
            <Separator orientation="vertical" className="h-4 mx-2" />
            {/*<CollaborationMenu activeTab={activeTab} />*/}
            <Button
              variant="ghost"
              size="icon"
              title="Search (⌘K)"
              onClick={() => setIsCommandOpen(true)}
              className="h-8"
            >
              <LuSearch className="size-4" />
            </Button>
            <Settings />
          </div>
        </div>
      </div>

      <CommandDialog open={isCommandOpen} onOpenChange={setIsCommandOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Quick Actions">
            <CommandItem
              onSelect={() => {
                setIsCommandOpen(false);
                onToggleSidebar();
              }}
            >
              <LuPanelRight />
              <span>Toggle Sidebar</span>
            </CommandItem>
            <CommandItem>
              <LuSettings />
              <span>Open Settings</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Tools">
            <CommandItem>
              <LuCalendar />
              <span>Calendar</span>
            </CommandItem>
            <CommandItem>
              <LuCalculator />
              <span>Calculator</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
};

export default Titlebar;
