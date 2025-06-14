import { ReactNode, useState } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/atoms/resizable';
import { Button } from '@/components/atoms/button';
import { LuX, LuExpand, LuPanelBottom, LuLayoutPanelLeft, LuShrink } from 'react-icons/lu';
import { ViewType, ProjectActions } from '@/contexts/project-context/types';
import { useProject } from '@/contexts/project-context';
import AnalyticsDashboard from '@/components/templates/analytics-dashboard';

interface NavigationBarProps {
  viewMode: string;
  onViewModeChange: (mode: string) => void;
  onClose: () => void;
}

interface AnalyticsLayoutProps {
  children: ReactNode;
  columns?: { id: string; name?: string }[];
  filePath?: string; // Add filePath prop
}

const NavigationBar = ({ viewMode, onViewModeChange, onClose }: NavigationBarProps) => {
  // If in bottom mode, only show expander and close buttons
  if (viewMode === 'bottom') {
    return (
      <div className="flex flex-row items-center justify-between bg-background border-b border-border px-1 h-8">
        <div className="flex flex-1 items-center justify-between gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onViewModeChange('split')}
            className="h-7 w-7"
            title="Expand"
          >
            <LuExpand className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7" title="Close">
            <LuX className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Full navigation for split and full modes
  return (
    <div className="flex flex-row items-center justify-between bg-background border-b border-border px-1 h-8">
      <div className="flex flex-row items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onViewModeChange('bottom')}
          data-state={viewMode === 'bottom' ? 'active' : 'inactive'}
          className="h-7 w-7"
          title="Bottom Panel"
        >
          <LuPanelBottom className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onViewModeChange('split')}
          data-state={viewMode === 'split' ? 'active' : 'inactive'}
          className="h-7 w-7"
          title="Split View"
        >
          <LuLayoutPanelLeft className="h-4 w-4" />
        </Button>
        {viewMode !== 'full' ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onViewModeChange('full')}
            className="h-7 w-7"
            title="Full Screen"
          >
            <LuExpand className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onViewModeChange('bottom')}
            className="h-7 w-7"
            title="Exit Full Screen"
          >
            <LuShrink className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7" title="Close">
          <LuX className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

const AnalyticsLayout = ({ children, columns, filePath }: AnalyticsLayoutProps) => {
  const { state, dispatch } = useProject();
  const [viewMode, setViewMode] = useState('bottom');

  const toggleAnalytics = () => {
    dispatch({
      type: ProjectActions.SET_VIEW,
      payload: state.activeView === ViewType.CHARTS ? ViewType.SPREADSHEET : ViewType.CHARTS,
    });
  };

  const safeColumns = columns || [];

  const chartContent = (
    <div className="h-full flex flex-col">
      <NavigationBar viewMode={viewMode} onViewModeChange={setViewMode} onClose={toggleAnalytics} />
      <div className="flex-1">
        {/* Pass the viewMode and filePath to the dashboard component */}
        <AnalyticsDashboard columns={safeColumns} viewMode={viewMode} filePath={filePath || ''} />
      </div>
    </div>
  );

  if (state.activeView !== ViewType.CHARTS) {
    return children;
  }

  if (viewMode === 'full') {
    return (
      <div className="absolute inset-0 bg-background" style={{ zIndex: 40 }}>
        {chartContent}
      </div>
    );
  }

  if (viewMode === 'split') {
    return (
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="h-full">{children}</div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={50} minSize={30}>
          {chartContent}
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  }

  return (
    <ResizablePanelGroup direction="vertical" className="h-full">
      <ResizablePanel defaultSize={70} minSize={30}>
        <div className="h-full">{children}</div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={30} minSize={20}>
        {chartContent}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};

export default AnalyticsLayout;
