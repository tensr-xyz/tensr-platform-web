'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Save, ArrowLeft, Upload } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { Textarea } from '@/components/atoms/text-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/atoms/form';
import { useProject } from '@/hooks/api/use-project';
import { useProjectFileUpload } from '@/hooks/api/use-project-file-upload';
import { ProjectStatus } from '@/types/project';
import posthog from 'posthog-js';

// Simple form schema
const projectFormSchema = z.object({
  projectName: z.string().min(3, {
    message: 'Project name must be at least 3 characters.',
  }),
  description: z.string().optional(),
  sourceType: z.enum(['folder', 'zip', 'git'], {
    message: 'Please select a valid source type.',
  }),
  createWithFile: z.boolean().optional(),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

export default function NewProjectForm() {
  const router = useRouter();
  const { createProject, isLoading } = useProject();
  const [createWithFile, setCreateWithFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // File upload hook
  const {
    uploadFile,
    isLoading: isUploading,
    error: uploadError,
  } = useProjectFileUpload({
    allowedExtensions: ['.csv', '.xlsx', '.xls', '.json'],
    onUploadComplete: projectId => {
      router.push(`/workspace/project/${projectId}`);
    },
  });

  // Initialize form
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      projectName: '',
      description: '',
      sourceType: 'folder',
      createWithFile: false,
    },
  });

  // Handle form submission
  async function onSubmit(values: ProjectFormValues) {
    try {
      if (createWithFile && selectedFile) {
        // Upload file and create project automatically
        await uploadFile(selectedFile);
        posthog.capture('project_created', {
          source_type: 'file_upload',
          file_type: selectedFile.name.split('.').pop(),
        });
      } else {
        // Create blank project
        const projectData = {
          projectName: values.projectName,
          description: values.description || '',
          originalName: values.projectName,
          sourceType: values.sourceType,
          status: 'pending_upload' as ProjectStatus,
        };

        const response = await createProject(projectData);
        posthog.capture('project_created', {
          source_type: values.sourceType,
        });
        router.push(`/workspace/project/${response.projectId}`);
      }
    } catch (error) {
      console.error('Error creating project:', error);
      posthog.captureException(error);
    }
  }

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Auto-fill project name from file name (without extension)
      const projectName = file.name.replace(/\.[^/.]+$/, '');
      form.setValue('projectName', projectName);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-row items-center justify-between">
        <h1 className="text-2xl font-bold">Create New Project</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* File Upload Toggle */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="createWithFile"
              checked={createWithFile}
              onChange={e => setCreateWithFile(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="createWithFile" className="text-sm font-medium">
              Upload a file to start with
            </label>
          </div>

          {/* File Upload Section */}
          {createWithFile && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Select File</label>
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.json"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {selectedFile && (
                <p className="text-sm text-gray-600">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
              {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
            </div>
          )}

          <FormField
            control={form.control}
            name="projectName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter project name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter project description"
                    className="min-h-[120px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sourceType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Source Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="folder">Folder</SelectItem>
                    <SelectItem value="zip">ZIP Archive</SelectItem>
                    <SelectItem value="git">Git Repository</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="pt-4 flex justify-between">
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button type="submit" disabled={isLoading || isUploading}>
              {createWithFile ? (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploading ? 'Uploading...' : 'Create Project with File'}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isLoading ? 'Creating...' : 'Create Project'}
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
