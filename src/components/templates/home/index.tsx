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
  Search,
  Grid,
  List,
  Download,
  FilePlus,
  MoreHorizontal,
  Image,
} from 'lucide-react';
import { useFileHandler } from '@/hooks/api/use-file';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/atoms/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/molecules/tabs';
import { FilePickerWrapper } from '@/components/molecules/file-picker';
import { FilesTable } from '@/components/templates/home/files-table';
import Loading from '@/components/molecules/loading';
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/molecules/drawer';

// Define types for the application
interface FileMetadata {
  fileId: string;
  fileName: string;
  fileType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  uploadedAt: string;
}

interface ProjectData {
  id: string;
  projectId?: string;
  name: string;
  status: string;
  lastModified?: string;
  updatedAt?: string;
  analysisTypes?: string[];
  metadata?: {
    analysisTypes?: string[];
    dataPoints?: number;
  };
  dataPoints?: number;
}

// File Card Component directly embedded in the HomeTemplate
const FileCard: React.FC<{ file: FileMetadata; onSelect: (id: string) => void }> = ({
  file,
  onSelect,
}) => {
  // Function to get icon based on file type
  const getFileIcon = (fileType: string) => {
    // You can expand this to include different icons for different file types
    return <FileText className="w-5 h-5" />;
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
      className="cursor-pointer overflow-hidden hover:border-foreground transition-colors border border-border rounded-lg bg-white"
      onClick={() => onSelect(file.fileId)}
    >
      <div className="p-4 pb-2">
        <div className="flex justify-between items-start w-full">
          <div className="flex-1">
            <div className="flex items-center mb-1">
              {getFileIcon(file.fileType)}
              <h3 className="text-base font-medium text-gray-900 ml-2 line-clamp-1">
                {file.fileName}
              </h3>
            </div>
            <span className="inline-block px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
              {getFileTypeDisplay(file.fileType)}
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
            {formatDate(file.updatedAt || file.uploadedAt || '')}
          </span>
        </div>
        <div>
          <span>{formatFileSize(file.size)}</span>
        </div>
      </div>
    </div>
  );
};

// ProjectCard component (unchanged from original)
const ProjectCard: React.FC<{ project: ProjectData; onSelect: (id: string) => void }> = ({
  project,
  onSelect,
}) => {
  // Function to get status color
  const getStatusColor = (status: string): string => {
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

  // Extract analysis types from project object if available
  const analysisTypes = project.analysisTypes || project.metadata?.analysisTypes || [];
  // Extract data points from project object if available
  const dataPoints = project.dataPoints || project.metadata?.dataPoints || 0;
  // Use projectId as the identifier
  const projectId = project.id || project.projectId;

  return (
    <div
      className="cursor-pointer overflow-hidden hover:border-foreground transition-colors border rounded-lg bg-white"
      onClick={() => onSelect(projectId || '')}
    >
      <div className="p-4 pb-2">
        <div className="flex justify-between items-start w-full">
          <div className="flex-1">
            <h3 className="text-base font-medium text-gray-900 mb-1 line-clamp-1">
              {project.name}
            </h3>
            <span
              className={`inline-block px-2 py-1 text-xs rounded-full ${getStatusColor(project.status)}`}
            >
              {project.status}
            </span>
          </div>
          <div className="flex">
            <button
              className="text-gray-400 hover:text-gray-600 p-1"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              className="text-gray-400 hover:text-gray-600 p-1"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <BarChart2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 pt-2">
        <div className="flex flex-wrap gap-2 mb-2">
          {analysisTypes.slice(0, 2).map((type, index) => (
            <span key={index} className="px-2 py-1 bg-gray-100 rounded-sm text-xs text-gray-600">
              {type}
            </span>
          ))}
          {analysisTypes.length > 2 && (
            <span className="px-2 py-1 bg-gray-100 rounded-sm text-xs text-gray-600">
              +{analysisTypes.length - 2}
            </span>
          )}
        </div>
      </div>

      <div className="flex justify-between text-xs text-gray-500 p-4 pt-0">
        <div className="flex items-center">
          <Clock className="w-3 h-3 mr-1" />
          <span className="truncate max-w-[100px]">
            {formatDate(project.lastModified || project.updatedAt || '')}
          </span>
        </div>
        <div>
          <span>{dataPoints.toLocaleString()} data points</span>
        </div>
      </div>
    </div>
  );
};

// Main component
const HomeTemplate: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('files');
  const [selectedView, setSelectedView] = useState<string>('list');
  const [commandOpen, setCommandOpen] = useState<boolean>(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState<boolean>(false);
  const [createDrawerOpen, setCreateDrawerOpen] = useState<boolean>(false);

  // Add event listener to close command dialog when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (commandOpen) {
        setCommandOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [commandOpen]);

  const router = useRouter();

  // Use the file handler hook with proper types
  const { files, fetchUserFiles, isLoading: filesLoading, error: filesError } = useFileHandler({});

  // Load files when component mounts
  useEffect(() => {
    fetchUserFiles();
  }, [fetchUserFiles]);

  // Function to handle tab change
  const handleTabChange = (value: string): void => {
    setActiveTab(value);

    // Close any open overlays when changing tabs
    setCommandOpen(false);
    setFilterDrawerOpen(false);
    setCreateDrawerOpen(false);
  };

  // Filter files based on search term
  const filteredFiles = files.filter((file: FileMetadata) =>
    file.fileName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleFileUploadComplete = (fileId: string): void => {
    console.log('File uploaded successfully:', fileId);
    fetchUserFiles();
    setCreateDrawerOpen(false);
  };

  const handleFileSelect = (fileId: string): void => {
    router.push(`/workspace/file/${fileId}`);
  };

  // Function to render empty state
  const renderEmptyState = () => (
    <div className="p-4 sm:p-8 text-center">
      <div className="max-w-sm mx-auto">
        <div className="bg-white border border-border w-16 h-16 rounded flex items-center justify-center mx-auto mb-4">
          <FileText className="h-8 w-8" />
        </div>
        <p className="text-sm font-medium mb-2">No files found</p>
        <p className="text-muted-foreground text-sm mb-4 sm:mb-6">
          Upload your first file to get started with your analysis
        </p>
        <FilePickerWrapper onUploadComplete={handleFileUploadComplete}>
          <Button className="w-full sm:w-auto">
            <Upload className="h-4 w-4 mr-2" />
            Upload File
          </Button>
        </FilePickerWrapper>
      </div>
    </div>
  );

  // Render files grid view
  const renderFilesGrid = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {filteredFiles.map(file => (
        <FileCard key={file.fileId} file={file} onSelect={handleFileSelect} />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen">
      {/* Main Content */}
      <div className="flex-1 w-full mx-auto px-3 sm:px-6 lg:px-12 py-4 sm:py-8">
        {/* Tabs and Search Bar Container */}
        <div className="space-y-4 mb-4 sm:mb-6">
          {/* Mobile view controls */}
          <div className="flex sm:hidden justify-between items-center mb-4">
            <Tabs defaultValue={activeTab} onValueChange={handleTabChange} className="flex-1">
              <TabsList className="bg-background h-10 border border-border rounded-md w-full">
                <TabsTrigger
                  isClosable={false}
                  className="data-[state=active]:bg-secondary py-1.5 px-3 flex-1 opacity-50"
                  value="projects"
                  disabled
                >
                  <FolderPlus className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="text-xs sm:text-sm">Projects</span>
                </TabsTrigger>
                <TabsTrigger
                  isClosable={false}
                  className="data-[state=active]:bg-secondary py-1.5 px-3 flex-1"
                  value="files"
                >
                  <FileText className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="text-xs sm:text-sm">Files</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Combined Search and Controls Row */}
          <div className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-2 sm:gap-4">
            {/* NEW MOBILE SEARCH UI */}
            <div className="flex sm:hidden items-center gap-2 w-full">
              <div className="flex flex-1 items-center relative border border-gray-200 rounded-lg bg-white">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />

                <input
                  type="text"
                  placeholder="Search Files and Projects..."
                  className="w-full h-10 pl-10 focus:outline-none rounded-lg"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />

                {/* Drawer Trigger Button inside the input */}
                <Drawer open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen}>
                  <DrawerTrigger asChild>
                    <Button variant="ghost">
                      <MoreHorizontal className="w-5 h-5 text-gray-600" />
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent>
                    <DrawerHeader>
                      <DrawerTitle>Filters</DrawerTitle>
                    </DrawerHeader>
                    <div className="px-4 pb-2">
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-sm font-medium mb-2">File Type</h3>
                          <div className="flex flex-wrap gap-2">
                            <button className="px-3 py-1 bg-gray-100 rounded-full text-sm flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              <span>Documents</span>
                            </button>
                            <button className="px-3 py-1 bg-gray-100 rounded-full text-sm flex items-center gap-1">
                              <Image className="w-3 h-3" />
                              <span>Images</span>
                            </button>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-medium mb-2">Date Modified</h3>
                          <div className="flex flex-wrap gap-2">
                            <button className="px-3 py-1 bg-gray-100 rounded-full text-sm flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>Last 7 days</span>
                            </button>
                            <button className="px-3 py-1 bg-gray-100 rounded-full text-sm flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>Last 30 days</span>
                            </button>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-medium mb-2">Status</h3>
                          <div className="space-y-2">
                            <div className="flex items-center">
                              <input type="checkbox" id="active" className="mr-2" />
                              <label htmlFor="active">Active</label>
                            </div>
                            <div className="flex items-center">
                              <input type="checkbox" id="completed" className="mr-2" />
                              <label htmlFor="completed">Completed</label>
                            </div>
                            <div className="flex items-center">
                              <input type="checkbox" id="archived" className="mr-2" />
                              <label htmlFor="archived">Archived</label>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <DrawerFooter>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => setFilterDrawerOpen(false)}
                        >
                          Reset
                        </Button>
                        <Button className="flex-1" onClick={() => setFilterDrawerOpen(false)}>
                          Apply Filters
                        </Button>
                      </div>
                    </DrawerFooter>
                  </DrawerContent>
                </Drawer>
              </div>

              <Drawer open={createDrawerOpen} onOpenChange={setCreateDrawerOpen}>
                <DrawerTrigger asChild>
                  <button className="p-2 bg-black rounded-lg text-white">
                    <Plus className="w-5 h-5" />
                  </button>
                </DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader>
                    <DrawerTitle>Create</DrawerTitle>
                  </DrawerHeader>
                  <div className="px-4 pb-4">
                    <div className="space-y-3">
                      <FilePickerWrapper onUploadComplete={handleFileUploadComplete}>
                        <button className="w-full py-3 px-4 bg-gray-50 rounded-lg flex items-center justify-between group hover:bg-gray-100">
                          <div className="flex items-center">
                            <div className="bg-blue-100 p-2 rounded-lg mr-3">
                              <Upload className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="text-left">
                              <p className="font-medium">Upload File</p>
                              <p className="text-sm text-gray-500">Upload from your device</p>
                            </div>
                          </div>
                        </button>
                      </FilePickerWrapper>

                      <button
                        className="w-full py-3 px-4 bg-gray-50 rounded-lg flex items-center justify-between group hover:bg-gray-100"
                        onClick={() => {
                          router.push('/file/new');
                          setCreateDrawerOpen(false);
                        }}
                      >
                        <div className="flex items-center">
                          <div className="bg-green-100 p-2 rounded-lg mr-3">
                            <FilePlus className="w-5 h-5 text-green-600" />
                          </div>
                          <div className="text-left">
                            <p className="font-medium">New File</p>
                            <p className="text-sm text-gray-500">Create a new file</p>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                </DrawerContent>
              </Drawer>
            </div>

            {/* Desktop Search + Tabs (combined into one row) */}
            <div className="hidden sm:flex items-center flex-1 gap-3">
              {/* Search bar */}
              <div className="relative border border-border rounded md:max-w-md w-full">
                <input
                  type="text"
                  className="w-full h-10 px-3 pl-10 focus:outline-none bg-white rounded"
                  placeholder="Search files..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              </div>

              {/* Desktop tabs */}
              <Tabs defaultValue="files" onValueChange={handleTabChange} className="hidden sm:flex">
                <TabsList className="bg-background h-10 border border-border rounded-md">
                  <TabsTrigger
                    isClosable={false}
                    className="data-[state=active]:bg-secondary py-1.5 px-3 opacity-50"
                    value="projects"
                    disabled
                  >
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Projects
                  </TabsTrigger>
                  <TabsTrigger
                    isClosable={false}
                    className="data-[state=active]:bg-secondary py-1.5 px-3"
                    value="files"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Files
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <Tabs
                defaultValue={selectedView}
                onValueChange={setSelectedView}
                className="hidden sm:flex"
              >
                <TabsList className="bg-background h-10 border border-border rounded-md">
                  <TabsTrigger
                    isClosable={false}
                    className="data-[state=active]:bg-secondary h-8"
                    value="grid"
                  >
                    <Grid className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger
                    isClosable={false}
                    className="data-[state=active]:bg-secondary h-8"
                    value="list"
                  >
                    <List className="h-4 w-4" />
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Action dropdown button (Desktop only) */}
            <div className="hidden sm:flex w-auto items-center justify-start space-x-3">
              <Select
                onValueChange={value => {
                  if (value === 'new-file') {
                    router.push('/file/new');
                  } else if (value === 'upload') {
                    // Trigger file input click
                    const fileInput = document.getElementById('file-upload-input');
                    if (fileInput) {
                      fileInput.click();
                    }
                  }
                }}
              >
                <SelectTrigger className="w-[140px] h-10 bg-foreground !text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Create..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="upload">
                      <div className="flex items-center">
                        <Upload className="h-4 w-4 mr-2" />
                        <span>Upload File</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="new-file">
                      <div className="flex items-center">
                        <FilePlus className="h-4 w-4 mr-2" />
                        <span>New File</span>
                      </div>
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              {/* Hidden file input */}
              <FilePickerWrapper onUploadComplete={handleFileUploadComplete}>
                <input id="file-upload-input" type="file" className="hidden" />
              </FilePickerWrapper>
            </div>
          </div>
        </div>

        {/* Files/Projects Content */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            {filesLoading ? (
              <Loading />
            ) : filesError ? (
              <div className="bg-white rounded-lg border p-4 sm:p-8 text-center">
                <p className="text-red-500">Error loading files: {String(filesError)}</p>
                <Button onClick={fetchUserFiles} className="mt-4">
                  Retry
                </Button>
              </div>
            ) : filteredFiles.length === 0 ? (
              renderEmptyState()
            ) : selectedView === 'list' ? (
              <FilesTable
                data={filteredFiles}
                onRowClick={handleFileSelect}
                isLoading={filesLoading}
                onRefresh={fetchUserFiles}
                error={filesError}
                hideControls={true} // Hide the table's internal controls
              />
            ) : (
              renderFilesGrid()
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeTemplate;
