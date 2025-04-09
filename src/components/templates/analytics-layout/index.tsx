import { ReactNode, useState } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/atoms/resizable';
import { Button } from '@/components/atoms/button';
import {
  LuPanelBottom,
  LuLayoutPanelLeft,
  LuLayoutDashboard,
  LuChartBar,
  LuGitCompare,
  LuX,
  LuExpand,
  LuShrink,
} from 'react-icons/lu';
import { ViewType, ProjectActions } from '@/contexts/project-context/types';
import { useProject } from '@/contexts/project-context';
import AnalyticsDashboard from '@/components/templates/analytics-dashboard';
import { Separator } from '@/components/atoms/separator';

interface NavigationBarProps {
  activeView: string;
  viewMode: string;
  onViewChange: (view: string) => void;
  onViewModeChange: (mode: string) => void;
  onClose: () => void;
}

interface AnalyticsLayoutProps {
  children: ReactNode;
  data?: Record<string, any>[];
  columns?: any[];
}

const NavigationBar = ({
  activeView,
  viewMode,
  onViewChange,
  onViewModeChange,
  onClose,
}: NavigationBarProps) => {
  return (
    <div className="flex flex-row items-center justify-between bg-background border-b px-1 h-8">
      <div className="flex flex-row items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onViewChange('overview')}
          data-state={activeView === 'overview' ? 'active' : 'inactive'}
          className="h-7 w-7"
        >
          <LuLayoutDashboard className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onViewChange('distribution')}
          data-state={activeView === 'distribution' ? 'active' : 'inactive'}
          className="h-7 w-7"
        >
          <LuChartBar className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onViewChange('relationships')}
          data-state={activeView === 'relationships' ? 'active' : 'inactive'}
          className="h-7 w-7"
        >
          <LuGitCompare className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="h-4 mx-2" />
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

const AnalyticsLayout = ({ children, data, columns }: AnalyticsLayoutProps) => {
  const { state, dispatch } = useProject();
  const [viewMode, setViewMode] = useState('bottom');
  const [activeView, setActiveView] = useState('overview');

  const toggleAnalytics = () => {
    dispatch({
      type: ProjectActions.SET_VIEW,
      payload: state.activeView === ViewType.CHARTS ? ViewType.SPREADSHEET : ViewType.CHARTS,
    });
  };

  const chartContent = (
    <div className="h-full flex flex-col">
      <NavigationBar
        activeView={activeView}
        viewMode={viewMode}
        onViewChange={setActiveView}
        onViewModeChange={setViewMode}
        onClose={toggleAnalytics}
      />
      <div className="flex-1 flex">
        <div className="flex-none transition-all duration-200"></div>
        <div className="flex-1">
          <div className="p-4">
            <AnalyticsDashboard data={data} columns={columns} activeView={activeView} />
          </div>
        </div>
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
