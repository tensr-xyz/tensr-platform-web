import { useState } from 'react';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { Label } from '@/components/atoms/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/card';
import { Alert, AlertDescription } from '@/components/atoms/alert';
import { Upload, Plus, FileText, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useProjectFileUpload } from '@/hooks/api/use-project-file-upload';

interface ProjectCreatorProps {
  onProjectCreated?: (project: any) => void;
}

export function ProjectCreator({ onProjectCreated }: ProjectCreatorProps) {
  const [projectName, setProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Use the new project-centric file upload hook
  const {
    uploadFile,
    isLoading: isUploading,
    error: uploadError,
    uploadProgress,
  } = useProjectFileUpload({
    allowedExtensions: ['.csv', '.xlsx', '.xls', '.json'],
    onUploadComplete: projectId => {
      setSuccess(`File uploaded successfully! Project created with ID: ${projectId}`);
      setSelectedFile(null);
      if (onProjectCreated) {
        onProjectCreated({ projectId });
      }
    },
  });

  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      setError('Project name is required');
      return;
    }

    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
      // Create project
      const project = await apiClient.projects.create({
        name: projectName.trim(),
        userId: 'current-user', // TODO: Get from auth context
      });

      setSuccess(`Project "${project.name}" created successfully!`);
      setProjectName('');

      if (onProjectCreated) {
        onProjectCreated(project);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
    } finally {
      setIsCreating(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['.csv', '.xlsx', '.xls', '.json'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

      if (!allowedTypes.includes(fileExtension)) {
        setError('Please select a valid file type (CSV, Excel, or JSON)');
        return;
      }

      // Validate file size (100MB limit)
      if (file.size > 100 * 1024 * 1024) {
        setError('File size must be less than 100MB');
        return;
      }

      setSelectedFile(file);
      setError(null);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    setError(null);
    setSuccess(null);

    try {
      await uploadFile(selectedFile);
    } catch (err: any) {
      setError(err.message || 'Failed to upload file');
    }
  };

  return (
    <div className="space-y-6">
      {/* Project Creation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Project
          </CardTitle>
          <CardDescription>Start a new data analysis project</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              placeholder="Enter project name..."
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleCreateProject();
                }
              }}
            />
          </div>

          <Button
            onClick={handleCreateProject}
            disabled={isCreating || !projectName.trim()}
            className="w-full"
          >
            {isCreating ? 'Creating...' : 'Create Project'}
          </Button>
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Dataset
          </CardTitle>
          <CardDescription>Upload a CSV, Excel, or JSON file to analyze</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file-upload">Select File</Label>
            <Input
              id="file-upload"
              type="file"
              accept=".csv,.xlsx,.xls,.json"
              onChange={handleFileSelect}
              disabled={isUploading}
            />
            <p className="text-xs text-muted-foreground">
              Supported formats: CSV, Excel (.xlsx, .xls), JSON. Max size: 100MB
            </p>
          </div>

          {selectedFile && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <FileText className="h-4 w-4" />
              <span className="text-sm font-medium">{selectedFile.name}</span>
              <span className="text-xs text-muted-foreground">
                ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </span>
            </div>
          )}

          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <Button
            onClick={handleFileUpload}
            disabled={!selectedFile || isUploading}
            className="w-full"
          >
            {isUploading ? 'Uploading...' : 'Upload Dataset'}
          </Button>
        </CardContent>
      </Card>

      {/* Error Display */}
      {(error || uploadError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || uploadError}</AlertDescription>
        </Alert>
      )}

      {/* Success Display */}
      {success && (
        <Alert>
          <FileText className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
