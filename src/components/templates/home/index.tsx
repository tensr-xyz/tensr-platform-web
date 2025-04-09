"use client"

import React, { useState, useEffect } from 'react';
import {
    Search,
    FileText,
    FolderPlus,
    Upload,
    BarChart2,
    Share2,
    Clock,
    ChevronDown,
    Filter,
    Plus,
    Command
} from 'lucide-react';
import { useFileHandler } from '@/hooks/api/use-file';
import { useRouter } from "next/navigation";
import useAuth from '@/hooks/api/use-auth';
import {Button} from "@/components/atoms/button";

export default function HomeTemplate() {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('projects'); // 'projects' or 'files'
    const [selectedView, setSelectedView] = useState('grid'); // 'grid' or 'list'
    const [filterOpen, setFilterOpen] = useState(false);
    const router = useRouter();
    const {user, isAuthenticated} = useAuth();

    const {
        files,
        fetchUserFiles,
        isLoading: filesLoading,
        error: filesError
    } = useFileHandler({});

    useEffect(() => {
        fetchUserFiles();
    }, []);

    // Sample projects data
    const projectsData = [
        {
            id: 1,
            name: "Market Research Analysis",
            status: "Active",
            lastModified: "Today at 2:45 PM",
            created: "Jan 15, 2025",
            dataPoints: 1458,
            variables: 24,
            analysisTypes: ["Regression", "Factor Analysis", "ANOVA"]
        },
        {
            id: 2,
            name: "Customer Satisfaction Survey",
            status: "Active",
            lastModified: "Yesterday at 11:20 AM",
            created: "Jan 10, 2025",
            dataPoints: 873,
            variables: 18,
            analysisTypes: ["Descriptive Statistics", "Correlation", "Cluster Analysis"]
        },
        {
            id: 3,
            name: "Product Testing Results",
            status: "Completed",
            lastModified: "Jan 20, 2025",
            created: "Dec 5, 2024",
            dataPoints: 562,
            variables: 12,
            analysisTypes: ["T-Tests", "Chi-Square", "Regression"]
        },
        {
            id: 4,
            name: "Employee Performance Metrics",
            status: "Active",
            lastModified: "Jan 25, 2025",
            created: "Jan 2, 2025",
            dataPoints: 246,
            variables: 30,
            analysisTypes: ["Descriptive Statistics", "Correlation", "MANOVA"]
        },
        {
            id: 5,
            name: "Market Segmentation Study",
            status: "Archived",
            lastModified: "Dec 15, 2024",
            created: "Nov 28, 2024",
            dataPoints: 2140,
            variables: 28,
            analysisTypes: ["Cluster Analysis", "Factor Analysis", "Discriminant Analysis"]
        },
    ];

    // Filter projects based on search term
    const filteredProjects = projectsData.filter(project =>
        project.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Filter files based on search term
    const filteredFiles = files.filter(file =>
        file.fileName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Function to get status color
    const getStatusColor = (status) => {
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
    const formatDate = (dateString) => {
        try {
            const date = new Date(dateString);
            const now = new Date();

            // If today
            if (date.toDateString() === now.toDateString()) {
                return `Today at ${date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`;
            }

            // If yesterday
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            if (date.toDateString() === yesterday.toDateString()) {
                return `Yesterday at ${date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`;
            }

            // Otherwise show the full date
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        } catch (e) {
            return 'Unknown date';
        }
    };

    // Function to format file size
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Function to get file icon based on file type
    const getFileIcon = (fileType) => {
        const type = fileType.toLowerCase();
        if (type.includes('csv')) {
            return <FileText className="h-5 w-5 text-green-600"/>;
        } else if (type.includes('xlsx') || type.includes('excel')) {
            return <FileText className="h-5 w-5 text-blue-600"/>;
        } else if (type.includes('pdf')) {
            return <FileText className="h-5 w-5 text-red-600"/>;
        } else {
            return <FileText className="h-5 w-5 text-gray-600"/>;
        }
    };

    const handleProjectSelect = (projectId) => {
        router.push(`/project/${projectId}`);
    };

    const handleFileSelect = (fileId) => {
        router.push(`/file/${fileId}`);
    };

    const handleCreateProject = () => {
        router.push('/project/new');
    };

    const handleUploadFile = () => {
        // Implement file upload logic
    };

    const renderProjectsGrid = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map(project => (
                <div
                    key={project.id}
                    className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
                    onClick={() => handleProjectSelect(project.id)}
                >
                    <div className="p-5">
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                                <h3 className="text-lg font-medium text-gray-900 mb-1">{project.name}</h3>
                                <span
                                    className={`inline-block px-2 py-1 text-xs rounded-full ${getStatusColor(project.status)}`}>
                  {project.status}
                </span>
                            </div>
                            <div className="flex">
                                <button className="text-gray-400 hover:text-gray-600 p-1">
                                    <Share2 className="w-4 h-4"/>
                                </button>
                                <button className="text-gray-400 hover:text-gray-600 p-1">
                                    <BarChart2 className="w-4 h-4"/>
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-3">
                            {project.analysisTypes.slice(0, 2).map((type, index) => (
                                <span key={index} className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                  {type}
                </span>
                            ))}
                            {project.analysisTypes.length > 2 && (
                                <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                  +{project.analysisTypes.length - 2}
                </span>
                            )}
                        </div>

                        <div className="flex justify-between text-xs text-gray-500 mt-4">
                            <div className="flex items-center">
                                <Clock className="w-3 h-3 mr-1"/>
                                <span>Modified: {formatDate(project.lastModified)}</span>
                            </div>
                            <div>
                                <span>{project.dataPoints.toLocaleString()} data points</span>
                            </div>
                        </div>
                    </div>
                </div>
            ))}

            {/* Add New Project Card */}
            <div
                className="bg-white rounded-lg border border-gray-200 border-dashed flex items-center justify-center p-6 cursor-pointer hover:bg-gray-50"
                onClick={handleCreateProject}
            >
                <div className="text-center">
                    <div className="rounded-full bg-blue-50 w-12 h-12 flex items-center justify-center mx-auto mb-3">
                        <Plus className="h-6 w-6 text-blue-600"/>
                    </div>
                    <p className="text-gray-700 font-medium">Create New Project</p>
                </div>
            </div>
        </div>
    );

    const renderProjectsList = () => (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                <tr>
                    <th scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Project Name
                    </th>
                    <th scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                    </th>
                    <th scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Data Points
                    </th>
                    <th scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Analysis Types
                    </th>
                    <th scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Modified
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                        <span className="sr-only">Actions</span>
                    </th>
                </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                {filteredProjects.map((project) => (
                    <tr
                        key={project.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleProjectSelect(project.id)}
                    >
                        <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                                <div
                                    className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-blue-50 rounded">
                                    <FileText className="h-5 w-5 text-blue-600"/>
                                </div>
                                <div className="ml-4">
                                    <div className="text-sm font-medium text-gray-900">{project.name}</div>
                                    <div className="text-xs text-gray-500">Created: {project.created}</div>
                                </div>
                            </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                <span
                    className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(project.status)}`}>
                  {project.status}
                </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {project.dataPoints.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex flex-wrap gap-1">
                                {project.analysisTypes.slice(0, 2).map((type, index) => (
                                    <span key={index} className="px-2 py-1 bg-gray-100 rounded text-xs">
                      {type}
                    </span>
                                ))}
                                {project.analysisTypes.length > 2 && (
                                    <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                      +{project.analysisTypes.length - 2}
                    </span>
                                )}
                            </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(project.lastModified)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button className="text-blue-600 hover:text-blue-900">Open</button>
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );

    const renderFilesView = () => (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center">
                <h2 className="text-lg font-medium">Your Files</h2>
                <button
                    onClick={() => fetchUserFiles()}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
                >
                    <span className="mr-1">Refresh</span>
                    {filesLoading && <span className="animate-spin h-4 w-4">↻</span>}
                </button>
            </div>

            {filesLoading && files.length === 0 ? (
                <div className="px-6 py-10 text-center text-gray-500">
                    <p>Loading files...</p>
                </div>
            ) : filesError ? (
                <div className="px-6 py-10 text-center text-red-500">
                    <p>Error loading files: {filesError}</p>
                    <button
                        onClick={() => fetchUserFiles()}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        Retry
                    </button>
                </div>
            ) : files.length === 0 ? (
                <div className="px-6 py-16 text-center text-gray-500">
                    <div className="max-w-sm mx-auto">
                        <div
                            className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Upload className="h-8 w-8 text-gray-400"/>
                        </div>
                        <p className="text-gray-700 text-lg font-medium mb-2">No files found</p>
                        <p className="text-gray-500 mb-6">Upload a file to get started with your analysis</p>
                        <button
                            onClick={handleUploadFile}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2 mx-auto"
                        >
                            <Upload className="h-4 w-4"/>
                            <span>Upload File</span>
                        </button>
                    </div>
                </div>
            ) : (
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                    <tr>
                        <th scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            File Name
                        </th>
                        <th scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
                        </th>
                        <th scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Size
                        </th>
                        <th scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Uploaded
                        </th>
                        <th scope="col" className="relative px-6 py-3">
                            <span className="sr-only">Actions</span>
                        </th>
                    </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                    {filteredFiles.map((file) => (
                        <tr
                            key={file.fileId}
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => handleFileSelect(file.fileId)}
                        >
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                    <div
                                        className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-gray-100 rounded">
                                        {getFileIcon(file.fileType)}
                                    </div>
                                    <div className="ml-4">
                                        <div className="text-sm font-medium text-gray-900">{file.fileName}</div>
                                        <div className="text-xs text-gray-500">{file.fileId.substring(0, 8)}...</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {file.fileType.split('/').pop()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatFileSize(file.size)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatDate(file.uploadedAt || file.createdAt)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                    className="text-blue-600 hover:text-blue-900"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleFileSelect(file.fileId);
                                    }}
                                >
                                    Open
                                </button>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            )}
        </div>
    );

    return (
        <div className="flex flex-col min-h-screen bg-gray-50">
            {/* Hero Section */}
            <div className="border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="mt-4 flex md:mt-0 space-x-3">
                        <Button
                            onClick={handleUploadFile}
                        >
                            <Upload className="h-4 w-4 mr-2"/>
                            Upload File
                        </Button>
                        <Button
                            variant='outline'
                            onClick={handleCreateProject}
                        >
                            <Plus className="h-4 w-4 mr-2"/>
                            New Project
                        </Button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div className="flex flex-1 items-center space-x-4">
                        <div className="relative flex-1 max-w-md">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-gray-400"/>
                            </div>
                            <input
                                type="text"
                                className="pl-10 pr-4 py-2 border rounded-md w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder={activeTab === 'projects' ? "Search projects..." : "Search files..."}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
              <span className="text-xs border px-1 py-0.5 rounded">
                <Command className="h-3 w-3 inline mr-1"/>K
              </span>
                            </div>
                        </div>
                        <div className="flex bg-white rounded-md border overflow-hidden">
                            <button
                                className={`px-4 py-2 text-sm font-medium ${activeTab === 'projects' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                                onClick={() => setActiveTab('projects')}
                            >
                                Projects
                            </button>
                            <button
                                className={`px-4 py-2 text-sm font-medium ${activeTab === 'files' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                                onClick={() => setActiveTab('files')}
                            >
                                Files
                            </button>
                        </div>
                    </div>
                    {activeTab === 'projects' && (
                        <div className="flex items-center space-x-2">
                            <div className="relative">
                                <button
                                    className="flex items-center px-3 py-2 text-sm bg-white border rounded-md text-gray-700 hover:bg-gray-50"
                                    onClick={() => setFilterOpen(!filterOpen)}
                                >
                                    <Filter className="h-4 w-4 mr-2"/>
                                    Filter
                                    <ChevronDown className="h-4 w-4 ml-2"/>
                                </button>
                                {filterOpen && (
                                    <div
                                        className="absolute right-0 mt-2 w-48 bg-white border rounded-md shadow-lg z-10">
                                        <div className="p-3">
                                            <div className="text-xs font-semibold text-gray-500 uppercase pb-2">Status
                                            </div>
                                            <div className="space-y-1">
                                                <label className="flex items-center">
                                                    <input type="checkbox" className="form-checkbox"/>
                                                    <span className="ml-2 text-sm">Active</span>
                                                </label>
                                                <label className="flex items-center">
                                                    <input type="checkbox" className="form-checkbox"/>
                                                    <span className="ml-2 text-sm">Completed</span>
                                                </label>
                                                <label className="flex items-center">
                                                    <input type="checkbox" className="form-checkbox"/>
                                                    <span className="ml-2 text-sm">Archived</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="flex border rounded-md overflow-hidden">
                                <button
                                    className={`p-2 ${selectedView === 'grid' ? 'bg-gray-100' : 'bg-white'}`}
                                    onClick={() => setSelectedView('grid')}
                                >
                                    <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor"
                                         viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                              d="M4 6h16M4 10h16M4 14h16M4 18h16"></path>
                                    </svg>
                                </button>
                                <button
                                    className={`p-2 ${selectedView === 'list' ? 'bg-gray-100' : 'bg-white'}`}
                                    onClick={() => setSelectedView('list')}
                                >
                                    <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor"
                                         viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Content Area */}
                <div className="space-y-6">
                    {activeTab === 'projects' ? (
                        <div>
                            {/* Recently Modified Projects Section - Always shown as grid */}
                            {filteredProjects.length > 0 && (
                                <div className="mb-8">
                                    <h2 className="text-lg font-medium text-gray-900 mb-4">Recently Modified</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {filteredProjects
                                            .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
                                            .slice(0, 3)
                                            .map(project => (
                                                <div
                                                    key={project.id}
                                                    className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
                                                    onClick={() => handleProjectSelect(project.id)}
                                                >
                                                    <div className="p-5">
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div className="flex-1">
                                                                <h3 className="text-lg font-medium text-gray-900 mb-1">{project.name}</h3>
                                                                <span
                                                                    className={`inline-block px-2 py-1 text-xs rounded-full ${getStatusColor(project.status)}`}>
                                {project.status}
                              </span>
                                                            </div>
                                                            <div className="flex">
                                                                <button
                                                                    className="text-gray-400 hover:text-gray-600 p-1">
                                                                    <Share2 className="w-4 h-4"/>
                                                                </button>
                                                                <button
                                                                    className="text-gray-400 hover:text-gray-600 p-1">
                                                                    <BarChart2 className="w-4 h-4"/>
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-wrap gap-2 mb-3">
                                                            {project.analysisTypes.slice(0, 2).map((type, index) => (
                                                                <span key={index}
                                                                      className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                                {type}
                              </span>
                                                            ))}
                                                            {project.analysisTypes.length > 2 && (
                                                                <span
                                                                    className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                                +{project.analysisTypes.length - 2}
                              </span>
                                                            )}
                                                        </div>

                                                        <div
                                                            className="flex justify-between text-xs text-gray-500 mt-4">
                                                            <div className="flex items-center">
                                                                <Clock className="w-3 h-3 mr-1"/>
                                                                <span>{formatDate(project.lastModified)}</span>
                                                            </div>
                                                            <div>
                                                                <span>{project.dataPoints.toLocaleString()} points</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}

                            {/* All Projects Section */}
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-lg font-medium text-gray-900">All Projects</h2>
                                    {filteredProjects.length > 0 && (
                                        <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                                            View all projects
                                        </button>
                                    )}
                                </div>
                                {filteredProjects.length === 0 ? (
                                    <div className="bg-white rounded-lg border p-8 text-center">
                                        <div className="max-w-sm mx-auto">
                                            <div
                                                className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <FolderPlus className="h-8 w-8 text-gray-400"/>
                                            </div>
                                            <p className="text-gray-700 text-lg font-medium mb-2">No projects found</p>
                                            <p className="text-gray-500 mb-6">Create your first project to get started
                                                with your analysis</p>
                                            <button
                                                onClick={handleCreateProject}
                                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2 mx-auto"
                                            >
                                                <FolderPlus className="h-4 w-4"/>
                                                <span>Create New Project</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : selectedView === 'grid' ? (
                                    renderProjectsGrid()
                                ) : (
                                    renderProjectsList()
                                )}
                            </div>
                        </div>
                    ) : (
                        <div>
                            {/* Files Section with Stats */}
                            {files.length > 0 && (
                                <div className="mb-6">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="bg-white p-4 rounded-lg border shadow-sm">
                                            <div className="text-sm text-gray-500 mb-1">Total Files</div>
                                            <div className="text-2xl font-semibold">{files.length}</div>
                                        </div>
                                        <div className="bg-white p-4 rounded-lg border shadow-sm">
                                            <div className="text-sm text-gray-500 mb-1">CSV Files</div>
                                            <div className="text-2xl font-semibold">
                                                {files.filter(f => f.fileType.toLowerCase().includes('csv')).length}
                                            </div>
                                        </div>
                                        <div className="bg-white p-4 rounded-lg border shadow-sm">
                                            <div className="text-sm text-gray-500 mb-1">Excel Files</div>
                                            <div className="text-2xl font-semibold">
                                                {files.filter(f => f.fileType.toLowerCase().includes('xls')).length}
                                            </div>
                                        </div>
                                        <div className="bg-white p-4 rounded-lg border shadow-sm">
                                            <div className="text-sm text-gray-500 mb-1">Total Size</div>
                                            <div className="text-2xl font-semibold">
                                                {formatFileSize(files.reduce((total, file) => total + file.size, 0))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Files List */}
                            {renderFilesView()}

                            {/* Recently Used in Projects */}
                            {files.length > 0 && (
                                <div className="mt-6">
                                    <h2 className="text-lg font-medium text-gray-900 mb-4">Recently Used in
                                        Projects</h2>
                                    <div className="bg-white rounded-lg border shadow-sm p-4">
                                        <p className="text-sm text-gray-500 italic">This feature is coming soon.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
