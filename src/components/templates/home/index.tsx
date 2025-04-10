'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  FolderPlus,
  Upload,
  BarChart2,
  Share2,
  Clock,
  Plus,
  Calendar,
  Smile,
  Calculator,
  User,
  CreditCard,
  Grid,
  List,
} from 'lucide-react';
import { useFileHandler } from '@/hooks/api/use-file';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/atoms/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/organisms/command';
import { Settings } from '@/components/templates/settings';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/atoms/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/molecules/tabs';
import { FilePickerWrapper } from '@/components/molecules/file-picker';
import { FilesTable } from '@/components/templates/home/files-table';
import { ProjectsTable } from '@/components/templates/home/projects-table';

const ProjectCard = ({ project, onSelect }) => {
  // Function to get status color
  const getStatusColor = status => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800';
      case 'Completed':
        return 'bg-blue-100 text-blue-800';
      case 'Archived':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  // Function to format date
  const formatDate = dateString => {
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

  return (
    <Card className="cursor-pointer overflow-hidden" onClick={() => onSelect(project.id)}>
      <CardHeader className="p-5 pb-2">
        <div className="flex justify-between items-start w-full">
          <div className="flex-1">
            <CardTitle className="text-lg font-medium text-gray-900 mb-1">{project.name}</CardTitle>
            <span
              className={`inline-block px-2 py-1 text-xs rounded-full ${getStatusColor(project.status)}`}
            >
              {project.status}
            </span>
          </div>
          <div className="flex">
            <button
              className="text-gray-400 hover:text-gray-600 p-1"
              onClick={e => e.stopPropagation()}
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              className="text-gray-400 hover:text-gray-600 p-1"
              onClick={e => e.stopPropagation()}
            >
              <BarChart2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-3">
        <div className="flex flex-wrap gap-2 mb-3">
          {project.analysisTypes.slice(0, 2).map((type, index) => (
            <span key={index} className="px-2 py-1 bg-gray-100 rounded-sm text-xs text-gray-600">
              {type}
            </span>
          ))}
          {project.analysisTypes.length > 2 && (
            <span className="px-2 py-1 bg-gray-100 rounded-sm text-xs text-gray-600">
              +{project.analysisTypes.length - 2}
            </span>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex justify-between text-xs text-gray-500 p-5 pt-0">
        <div className="flex items-center">
          <Clock className="w-3 h-3 mr-1" />
          <span>Modified: {formatDate(project.lastModified)}</span>
        </div>
        <div>
          <span>{project.dataPoints.toLocaleString()} data points</span>
        </div>
      </CardFooter>
    </Card>
  );
};

export default function HomeTemplate() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('projects'); // 'projects' or 'files'
  const [selectedView, setSelectedView] = useState('grid'); // 'grid' or 'list'
  const [commandOpen, setCommandOpen] = useState(false);
  const router = useRouter();

  const { files, fetchUserFiles, isLoading: filesLoading, error: filesError } = useFileHandler({});

  useEffect(() => {
    fetchUserFiles();
  }, []);

  const toggleCommandDialog = () => {
    setCommandOpen(prev => !prev);
  };

  // Sample projects data
  const projectsData = [
    {
      id: 1,
      name: 'Market Research Analysis',
      status: 'Active',
      lastModified: 'Today at 2:45 PM',
      created: 'Jan 15, 2025',
      dataPoints: 1458,
      variables: 24,
      analysisTypes: ['Regression', 'Factor Analysis', 'ANOVA'],
    },
    // Other project items...
  ];

  // Function to format file size
  const formatFileSize = bytes => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Filter projects based on search term
  const filteredProjects = projectsData.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter files based on search term
  const filteredFiles = files.filter(file =>
    file.fileName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleFileUploadComplete = fileId => {
    console.log('File uploaded successfully:', fileId);
    fetchUserFiles();
  };

  const handleProjectSelect = projectId => {
    router.push(`/project/${projectId}`);
  };

  const handleFileSelect = fileId => {
    router.push(`/file/${fileId}`);
  };

  const handleCreateProject = () => {
    router.push('/project/new');
  };

  // Render functions for grid view (card-based)
  const renderProjectsGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredProjects.map(project => (
        <ProjectCard key={project.id} project={project} onSelect={handleProjectSelect} />
      ))}

      {/* Add New Project Card */}
      <div
        className="bg-white rounded-lg border border-gray-200 border-dashed flex items-center justify-center p-6 cursor-pointer hover:bg-gray-50"
        onClick={handleCreateProject}
      >
        <div className="text-center">
          <div className="rounded-full bg-blue-50 w-12 h-12 flex items-center justify-center mx-auto mb-3">
            <Plus className="h-6 w-6 text-blue-600" />
          </div>
          <p className="text-gray-700 font-medium">Create New Project</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-secondary">
      {/* Main Content */}
      <div className="flex-1 w-full mx-auto px-4 sm:px-8 lg:px-12 py-8">
        <div className="space-y-4 mb-6">
          {/* Search + Tabs + Filters */}
          <div className="flex flex-wrap justify-between items-center gap-4">
            {/* Command/Search Component */}
            <div className="flex relative flex-1 gap-3">
              <Command className="rounded-lg border border-border md:max-w-lg">
                <CommandInput
                  placeholder="Type a command or search..."
                  onClick={toggleCommandDialog}
                />
                {commandOpen && (
                  <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>
                    <CommandGroup heading="Suggestions">
                      <CommandItem>
                        <Calendar />
                        <span>Calendar</span>
                      </CommandItem>
                      <CommandItem>
                        <Smile />
                        <span>Search Emoji</span>
                      </CommandItem>
                      <CommandItem disabled>
                        <Calculator />
                        <span>Calculator</span>
                      </CommandItem>
                    </CommandGroup>
                    <CommandSeparator />
                    <CommandGroup heading="Settings">
                      <CommandItem>
                        <User />
                        <span>Profile</span>
                        <CommandShortcut>⌘P</CommandShortcut>
                      </CommandItem>
                      <CommandItem>
                        <CreditCard />
                        <span>Billing</span>
                        <CommandShortcut>⌘B</CommandShortcut>
                      </CommandItem>
                      <CommandItem>
                        <Settings />
                        <span>Settings</span>
                        <CommandShortcut>⌘S</CommandShortcut>
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                )}
              </Command>
              <Select>
                <SelectTrigger className="w-[140px] h-10">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Status</SelectLabel>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="complete">Complete</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Tabs defaultValue="projects" onValueChange={value => setActiveTab(value)}>
                <TabsList className="bg-background h-10 border border-border rounded-md">
                  <TabsTrigger
                    className="data-[state=active]:bg-secondary py-1.5 px-3"
                    value="projects"
                  >
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Projects
                  </TabsTrigger>
                  <TabsTrigger
                    className="data-[state=active]:bg-secondary py-1.5 px-3"
                    value="files"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Files
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {activeTab === 'projects' && (
                <Tabs defaultValue="grid">
                  <TabsList className="bg-background h-10 border border-border rounded-md">
                    <TabsTrigger
                      className="data-[state=active]:bg-secondary py-2 px-3"
                      value="grid"
                      onClick={() => setSelectedView('grid')}
                    >
                      <Grid className="h-4 w-4" />
                    </TabsTrigger>
                    <TabsTrigger
                      className="data-[state=active]:bg-secondary py-2 px-3"
                      value="list"
                      onClick={() => setSelectedView('list')}
                    >
                      <List className="h-4 w-4" />
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <FilePickerWrapper onUploadComplete={handleFileUploadComplete}>
                <Button className="h-10">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
              </FilePickerWrapper>

              <Button className="h-10" variant="outline" onClick={handleCreateProject}>
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </div>
          </div>
        </div>

        {/* Projects Tab Content */}
        {activeTab === 'projects' && (
          <div className="space-y-6">
            {/* Recently Modified Projects Section - Always shown as grid */}
            {filteredProjects.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Recently Modified</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProjects
                    .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
                    .slice(0, 3)
                    .map(project => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        onSelect={handleProjectSelect}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* All Projects Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium text-gray-900">All Projects</h2>
                {filteredProjects.length > 0 && <Button variant="ghost">View all projects</Button>}
              </div>

              {filteredProjects.length === 0 ? (
                <div className="bg-white rounded-lg border p-8 text-center">
                  <div className="max-w-sm mx-auto">
                    <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FolderPlus className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-700 text-lg font-medium mb-2">No projects found</p>
                    <p className="text-gray-500 mb-6">
                      Create your first project to get started with your analysis
                    </p>
                    <button
                      onClick={handleCreateProject}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2 mx-auto"
                    >
                      <FolderPlus className="h-4 w-4" />
                      <span>Create New Project</span>
                    </button>
                  </div>
                </div>
              ) : selectedView === 'grid' ? (
                // Grid View (Card view)
                renderProjectsGrid()
              ) : (
                // List View (Table view) - Use the ProjectsTable component
                <ProjectsTable data={filteredProjects} onRowClick={handleProjectSelect} />
              )}
            </div>
          </div>
        )}

        {/* Files Tab Content */}
        {activeTab === 'files' && (
          <div className="space-y-4">
            {/* Files Table View - Use the FilesTable component */}
            <FilesTable
              data={filteredFiles}
              onRowClick={handleFileSelect}
              isLoading={filesLoading}
              onRefresh={fetchUserFiles}
              error={filesError}
            />
          </div>
        )}
      </div>
    </div>
  );
}
