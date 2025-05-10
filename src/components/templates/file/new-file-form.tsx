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
const fileFormSchema = z.object({
  fileName: z.string().min(3, {
    message: 'Project name must be at least 3 characters.',
  }),
});

type FileFormValues = z.infer<typeof fileFormSchema>;

export default function NewFileForm() {
  const router = useRouter();
  const { createProject, isLoading } = useProject();

  // Initialize form
  const form = useForm<FileFormValues>({
    resolver: zodResolver(fileFormSchema),
    defaultValues: {
      fileName: '',
    },
  });

  // Handle form submission
  async function onSubmit(values: FileFormValues) {
    try {
      // Create simple file
      const fileData = {
        projectName: values.fileName,
        status: 'pending_upload' as ProjectStatus,
      };

      const response = await createProject(fileData);
      router.push(`/projects/${response.projectId}`);
    } catch (error) {
      console.error('Error creating project:', error);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-row items-center justify-between">
        <h1 className="text-2xl font-bold">Create New File</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="fileName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>File Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter file name" {...field} />
                </FormControl>
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
              {isLoading ? 'Creating...' : 'Create File'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
