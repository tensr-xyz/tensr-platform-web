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
  Filter,
  Grid,
  List,
  Download,
  FilePlus,
} from 'lucide-react';
import { useFileHandler } from '@/hooks/api/use-file';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/atoms/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/molecules/tabs';
import { FilePickerWrapper } from '@/components/molecules/file-picker';
import { FilesTable } from '@/components/templates/home/files-table';
import Loading from '@/components/molecules/loading';

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
  // In MVP, we'll only show 'files' tab but keep projects code commented for future
  const [activeTab, setActiveTab] = useState<string>('files');
  const [selectedView, setSelectedView] = useState<string>('list');
  const [commandOpen, setCommandOpen] = useState<boolean>(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState<boolean>(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState<boolean>(false);

  // Add event listener to close command dialog when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      // Close command dialog if user clicks outside and it's open
      if (commandOpen) {
        setCommandOpen(false);
      }
    };

    // Add event listener for mobile view
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
  }, []);

  // Toggle function to handle command menu
  const toggleCommandDialog = (): void => {
    setCommandOpen(prev => !prev);
    // Reset search term when closing to avoid persisting errors
    if (commandOpen) {
      setSearchTerm('');
    }
  };

  // Function to handle tab change
  const handleTabChange = (value: string): void => {
    setActiveTab(value);

    // Close any open overlays when changing tabs
    setCommandOpen(false);
    setMobileSearchOpen(false);
    setMobileFilterOpen(false);
  };

  // Filter files based on search term
  const filteredFiles = files.filter((file: FileMetadata) =>
    file.fileName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleFileUploadComplete = (fileId: string): void => {
    console.log('File uploaded successfully:', fileId);
    fetchUserFiles();
  };

  const handleFileSelect = (fileId: string): void => {
    router.push(`/workspace/file/${fileId}`);
  };

  // Render mobile search overlay
  const renderMobileSearch = () => (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center pt-20 ${mobileSearchOpen ? 'block' : 'hidden'}`}
      onClick={() => setMobileSearchOpen(false)}
    >
      <div
        className="bg-white w-[90%] max-w-md rounded-lg shadow-lg p-4"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 relative">
            <input
              type="text"
              className="w-full border rounded-md p-2 pr-8"
              placeholder="Search..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              autoFocus
            />
            {searchTerm && (
              <button
                className="absolute right-2 top-2.5 text-gray-400"
                onClick={() => setSearchTerm('')}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Results or suggestions */}
        <div className="max-h-[400px] overflow-y-auto">
          {searchTerm ? (
            filteredFiles.length > 0 ? (
              <div className="space-y-2">
                {filteredFiles.slice(0, 5).map(file => (
                  <div
                    key={file.fileId}
                    className="p-2 hover:bg-gray-100 rounded cursor-pointer"
                    onClick={() => {
                      handleFileSelect(file.fileId);
                      setMobileSearchOpen(false);
                    }}
                  >
                    <div className="font-medium">{file.fileName}</div>
                    <div className="text-xs text-gray-500">
                      {file.fileType} • {(file.size / 1024).toFixed(1)} KB • Last modified:{' '}
                      {new Date(file.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">No results found</div>
            )
          ) : (
            <div>
              <p className="text-sm font-medium text-gray-500 mb-2">Recent searches</p>
              <div className="flex flex-wrap gap-2">
                <button
                  className="px-3 py-1 bg-gray-100 rounded-full text-sm"
                  onClick={() => setSearchTerm('PDF')}
                >
                  PDF
                </button>
                <button
                  className="px-3 py-1 bg-gray-100 rounded-full text-sm"
                  onClick={() => setSearchTerm('CSV')}
                >
                  CSV
                </button>
                <button
                  className="px-3 py-1 bg-gray-100 rounded-full text-sm"
                  onClick={() => setSearchTerm('Excel')}
                >
                  Excel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render mobile filter overlay
  const renderMobileFilter = () => (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center pt-20 ${mobileFilterOpen ? 'block' : 'hidden'}`}
      onClick={() => setMobileFilterOpen(false)}
    >
      <div
        className="bg-white w-[90%] max-w-md rounded-lg shadow-lg p-4"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">Filters</h2>
          <Button variant="ghost" className="p-2" onClick={() => setMobileFilterOpen(false)}>
            ✕
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">File Type</h3>
            <div className="space-y-2">
              <div className="flex items-center">
                <input type="checkbox" id="pdf" className="mr-2" />
                <label htmlFor="pdf">PDF</label>
              </div>
              <div className="flex items-center">
                <input type="checkbox" id="csv" className="mr-2" />
                <label htmlFor="csv">CSV</label>
              </div>
              <div className="flex items-center">
                <input type="checkbox" id="excel" className="mr-2" />
                <label htmlFor="excel">Excel</label>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" variant="outline" onClick={() => setMobileFilterOpen(false)}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={() => setMobileFilterOpen(false)}>
              Apply Filters
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  // Function to render empty state
  const renderEmptyState = () => (
    <div className="bg-white rounded-lg border p-4 sm:p-8 text-center">
      <div className="max-w-sm mx-auto">
        <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="h-8 w-8 text-gray-400" />
        </div>
        <p className="text-gray-700 text-base sm:text-lg font-medium mb-2">No files found</p>
        <p className="text-gray-500 text-sm sm:text-base mb-4 sm:mb-6">
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
      {/* Mobile search and filter overlays */}
      {renderMobileSearch()}
      {renderMobileFilter()}

      {/* Main Content */}
      <div className="flex-1 w-full mx-auto px-3 sm:px-6 lg:px-12 py-4 sm:py-8">
        <div className="space-y-4 mb-4 sm:mb-6">
          {/* Mobile view controls - For MVP, we'll only show Files tab */}
          <div className="flex sm:hidden justify-between items-center mb-4">
            <Tabs defaultValue="files" onValueChange={handleTabChange} className="flex-1">
              <TabsList className="bg-background h-10 border border-border rounded-md w-full">
                {/* Keeping projects tab but making it disabled for MVP */}
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

          <div className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-2 sm:gap-4">
            {/* Mobile buttons for search and filter */}
            <div className="flex sm:hidden items-center gap-2 w-full">
              <Button
                variant="outline"
                className="flex-1 h-10 justify-center"
                onClick={() => setMobileSearchOpen(true)}
              >
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-10 justify-center"
                onClick={() => setMobileFilterOpen(true)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </div>

            {/* Desktop Search + Filters */}
            <div className="hidden sm:flex relative flex-1 gap-3">
              <div className="relative rounded-lg border border-border md:max-w-lg w-full">
                <input
                  type="text"
                  className="w-full h-10 px-3 rounded-lg focus:outline-none bg-background"
                  placeholder="Search files..."
                  onClick={() => setCommandOpen(true)}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />

                {/* Command menu dropdown */}
                {commandOpen && (
                  <div className="absolute top-full left-0 w-full mt-1 bg-white rounded-lg border border-border shadow-lg z-50">
                    {searchTerm && filteredFiles.length === 0 ? (
                      <div className="p-2 text-sm text-gray-500">No files found.</div>
                    ) : (
                      <div className="max-h-[300px] overflow-y-auto">
                        <div className="p-2 text-xs font-medium text-gray-500">Recent Files</div>
                        {filteredFiles.slice(0, 5).map(file => (
                          <div
                            key={file.fileId}
                            className="p-2 flex items-center gap-2 hover:bg-gray-100 cursor-pointer"
                            onClick={() => {
                              handleFileSelect(file.fileId);
                              setCommandOpen(false);
                            }}
                          >
                            <FileText className="h-4 w-4" />
                            <div className="flex flex-col">
                              <span className="text-sm">{file.fileName}</span>
                              <span className="text-xs text-gray-500">
                                {file.fileType.split('/')[1] || file.fileType} •{' '}
                                {(file.size / 1024).toFixed(1)} KB
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* File type filter */}
              <Select>
                <SelectTrigger className="w-[140px] h-10">
                  <SelectValue placeholder="File Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>File Type</SelectLabel>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="excel">Excel</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              {/* Desktop tabs - disabled Projects tab for MVP */}
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

              {/* View options (list/grid) - Now fully functional */}
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

            {/* Action buttons - Mobile optimized */}
            <div className="flex w-full sm:w-auto items-center justify-between sm:justify-start sm:space-x-3">
              <FilePickerWrapper onUploadComplete={handleFileUploadComplete}>
                <Button className="h-10 text-xs sm:text-sm flex-1 sm:flex-none">
                  <Upload className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="sm:inline">Upload</span>
                </Button>
              </FilePickerWrapper>

              {activeTab === 'files' ? (
                <Button
                  className="h-10 text-xs sm:text-sm flex-1 sm:flex-none"
                  variant="outline"
                  onClick={() => router.push('/file/new')}
                >
                  <FilePlus className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="sm:inline">New File</span>
                </Button>
              ) : (
                <Button
                  className="h-10 text-xs sm:text-sm flex-1 sm:flex-none"
                  variant="outline"
                  disabled
                >
                  <Plus className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="sm:inline">New Project</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Files Tab Content - The only content in our MVP */}
        <div className="space-y-4">
          {/* Files View - Now supports both list and grid view */}
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
