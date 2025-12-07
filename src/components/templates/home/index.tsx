'use client';

import React, { useState } from 'react';
import {
  FileText,
  FolderPlus,
  Upload,
  Share2,
  Clock,
  Plus,
  Download,
  X,
  AlertCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/atoms/button';
import { FilePickerWrapper } from '@/components/molecules/file-picker';
import { ProjectsTable } from '@/components/templates/home/projects-table';
import Loading from '@/components/molecules/loading';
import { useProjects, projectKeys } from '@/hooks/api/use-projects';
import { useQueryClient } from '@tanstack/react-query';
import { Project } from '@/types/project';
import { useToast } from '@/hooks/ui/use-toast';

// Project Card Component directly embedded in the HomeTemplate
const ProjectCard: React.FC<{ project: Project; onSelect: (id: string) => void }> = ({
  project,
  onSelect,
}) => {
  // Function to get icon based on project type
  const getProjectIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'zip':
        return <FileText className="w-5 h-5" />;
      case 'git':
        return <FileText className="w-5 h-5" />;
      case 'folder':
      default:
        return <FolderPlus className="w-5 h-5" />;
    }
  };

  // Function to format date
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();

      // If today
      if (date.toDateString() === now.toDateString()) {
        return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }

      // If yesterday
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
        return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }

      // Otherwise show the full date
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (e) {
      return 'Unknown date';
    }
  };

  // Function to get file type display name
  const getFileTypeDisplay = (fileType: string): string => {
    if (!fileType) return 'Unknown';

    // Handle MIME types
    if (fileType.includes('/')) {
      const type = fileType.split('/')[1]?.toUpperCase();
      return type || fileType;
    }

    return fileType.toUpperCase();
  };

  // Function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div
      className="cursor-pointer overflow-hidden hover:border-foreground transition-colors border border-border rounded-lg bg-background"
      onClick={() => {
        console.log('ProjectCard - onClick called with project.projectId:', project.projectId);
        onSelect(project.projectId);
      }}
    >
      <div className="p-4 pb-2">
        <div className="flex justify-between items-start w-full">
          <div className="flex-1">
            <div className="flex items-center mb-1">
              {getProjectIcon(project.sourceType)}
              <h3 className="text-base font-medium text-gray-900 ml-2 line-clamp-1">
                {project.projectName}
              </h3>
            </div>
            <span className="inline-block px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
              {project.sourceType}
            </span>
          </div>
          <div className="flex">
            <button
              className="text-gray-400 hover:text-gray-600 p-1"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                // Download functionality would go here
              }}
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              className="text-gray-400 hover:text-gray-600 p-1"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                // Share functionality would go here
              }}
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 pt-2 flex justify-between text-xs text-gray-500">
        <div className="flex items-center">
          <Clock className="w-3 h-3 mr-1" />
          <span className="truncate max-w-[120px]">
            {formatDate(project.updatedAt || project.createdAt || '')}
          </span>
        </div>
        <div>
          <span>{formatFileSize(project.size || 0)}</span>
        </div>
      </div>
    </div>
  );
};

// Beta Card Component
const BetaCard: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="relative border border-border bg-background p-4 mb-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium">Welcome to our beta</p>
          <p className="text-xs text-muted-foreground mt-1">
            We're actively developing and improving the platform. You may encounter features that
            are still in development. Your feedback helps us build better.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0"
          onClick={() => setIsVisible(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

// Main component
const HomeTemplate: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedView, setSelectedView] = useState<string>('list');
  const { toast } = useToast();

  const router = useRouter();
  const queryClient = useQueryClient();

  // Use the projects hook
  const { data: projects, isLoading: projectsLoading, error: projectsError } = useProjects();

  // Filter projects based on search term
  const projectsArray = Array.isArray(projects) ? projects : [];
  const filteredProjects = projectsArray.filter((project: Project) =>
    project.projectName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleProjectUploadComplete = (projectId: string): void => {
    // Invalidate the projects cache to force a fresh fetch
    queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    toast({
      title: 'Project created successfully',
      description: 'Your project has been created and is ready to use.',
    });
  };

  const handleProjectSelect = (projectId: string): void => {
    router.push(`/workspace/project/${projectId}`);
  };

  // Function to render empty state
  const renderEmptyState = () => (
    <div className="p-4 sm:p-8 text-center">
      <div className="max-w-sm mx-auto">
        <div className="border border-border w-16 h-16 rounded flex items-center justify-center mx-auto mb-4 bg-background">
          <FileText className="h-8 w-8" />
        </div>
        <p className="text-sm font-medium mb-2">No projects found</p>
        <p className="text-muted-foreground text-sm mb-4 sm:mb-6">
          Create your first project to get started with your analysis
        </p>
        <FilePickerWrapper onUploadComplete={handleProjectUploadComplete}>
          <Button className="w-full sm:w-auto">
            <Upload className="h-4 w-4 mr-2" />
            Create Project
          </Button>
        </FilePickerWrapper>
      </div>
    </div>
  );

  // Render projects grid view
  const renderProjectsGrid = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {filteredProjects.map((project: Project) => (
        <ProjectCard key={project.projectId} project={project} onSelect={handleProjectSelect} />
      ))}
    </div>
  );

  return (
    <>
      <div className="pt-10">
        <BetaCard />
        <h1 className="text-center font-normal text-xl tracking-tighter md:text-left md:text-3xl mt-6">
          Projects
        </h1>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 lg:hidden">
          <FilePickerWrapper onUploadComplete={handleProjectUploadComplete}>
            <Button variant="outline" size="sm" className="gap-2">
              <Upload className="h-4 w-4" />
              <span>Upload</span>
            </Button>
          </FilePickerWrapper>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => {
              router.push('/project/new');
            }}
          >
            <Plus className="h-4 w-4" />
            <span>New</span>
          </Button>
        </div>
      </div>

      <div>
        {projectsLoading ? (
          <Loading fullScreen />
        ) : projectsError ? (
          <div className="border bg-background p-6 text-center">
            <p className="text-red-500">Error loading projects: {String(projectsError)}</p>
            <Button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
                toast({
                  title: 'Refreshing projects',
                  description: 'Attempting to reload your projects...',
                });
              }}
              className="mt-4"
            >
              Retry
            </Button>
          </div>
        ) : filteredProjects.length === 0 ? (
          renderEmptyState()
        ) : selectedView === 'list' ? (
          <ProjectsTable data={filteredProjects} onRowClick={handleProjectSelect} />
        ) : (
          renderProjectsGrid()
        )}
      </div>
    </>
  );
};

// Export the component directly without the QueryClientProvider wrapper
export default HomeTemplate;
