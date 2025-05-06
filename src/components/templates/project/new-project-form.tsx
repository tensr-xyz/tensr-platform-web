'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Save, ArrowLeft } from 'lucide-react';

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
import { ProjectStatus } from '@/types/project';

// Simple form schema
const projectFormSchema = z.object({
  projectName: z.string().min(3, {
    message: 'Project name must be at least 3 characters.',
  }),
  description: z.string().optional(),
  sourceType: z.enum(['folder', 'zip', 'git'], {
    message: 'Please select a valid source type.',
  }),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

export default function NewProjectForm() {
  const router = useRouter();
  const { createProject, isLoading } = useProject();

  // Initialize form
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      projectName: '',
      description: '',
      sourceType: 'folder',
    },
  });

  // Handle form submission
  async function onSubmit(values: ProjectFormValues) {
    try {
      // Create simple project
      const projectData = {
        projectName: values.projectName,
        description: values.description || '',
        originalName: values.projectName,
        sourceType: values.sourceType,
        status: 'pending_upload' as ProjectStatus,
      };

      const response = await createProject(projectData);
      router.push(`/projects/${response.projectId}`);
    } catch (error) {
      console.error('Error creating project:', error);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-row items-center justify-between">
        <h1 className="text-2xl font-bold">Create New Project</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
            <Button variant="outline" onClick={() => router.push('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button type="submit" disabled={isLoading}>
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
