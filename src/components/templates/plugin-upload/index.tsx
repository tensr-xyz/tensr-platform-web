'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Upload, Save, ArrowLeft } from 'lucide-react';
import { Loader } from '@/components/molecules/loading';

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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/card';
import { Label } from '@/components/atoms/label';
import { Switch } from '@/components/atoms/switch';
import { tensrApiUrl } from '@/lib/tensr-api-url';
import { getIdToken } from '@/utils/auth';

// Form schema for plugin upload. Monetization fields (isPaid/pricing) are validated
// server-side by PluginPricingBody in app/routers/plugins.py.
const pluginUploadSchema = z
  .object({
    name: z.string().min(3, { message: 'Plugin name must be at least 3 characters' }),
    description: z.string().min(10, { message: 'Description must be at least 10 characters' }),
    version: z.string().min(1, { message: 'Version is required' }),
    language: z.enum(['typescript', 'python', 'r']),
    entryPoint: z.string().min(1, { message: 'Entry point is required' }),
    tags: z.string().optional(),
    thumbnailUrl: z.string().url().optional().or(z.literal('')),
    inputTypes: z.string().optional(),
    outputTypes: z.string().optional(),
    isPaid: z.boolean(),
    pricingModel: z.enum(['one-time', 'subscription']).optional(),
    price: z.string().optional(),
    subscriptionInterval: z.enum(['monthly', 'yearly']).optional(),
    trialDays: z.string().optional(),
  })
  .refine(data => !data.isPaid || (data.price && Number(data.price) > 0), {
    message: 'Price must be greater than 0 for paid plugins',
    path: ['price'],
  });

type PluginUploadFormValues = z.infer<typeof pluginUploadSchema>;

export default function PluginUploadForm() {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const form = useForm<PluginUploadFormValues>({
    resolver: zodResolver(pluginUploadSchema),
    defaultValues: {
      name: '',
      description: '',
      version: '1.0.0',
      language: 'typescript',
      entryPoint: 'dist/index.js',
      tags: '',
      thumbnailUrl: '',
      inputTypes: 'text,csv,json',
      outputTypes: 'json,chart,table',
      isPaid: false,
      pricingModel: 'one-time',
      price: '',
      subscriptionInterval: 'monthly',
      trialDays: '',
    },
  });

  const isPaid = form.watch('isPaid');
  const pricingModel = form.watch('pricingModel');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.name.endsWith('.zip')) {
      setSelectedFile(file);
    } else {
      alert('Please select a valid ZIP file');
    }
  };

  const onSubmit = async (values: PluginUploadFormValues) => {
    if (!selectedFile) {
      alert('Please select a plugin file');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const pricing = values.isPaid
      ? {
          model: values.pricingModel || 'one-time',
          price: Number(values.price),
          currency: 'usd',
          subscriptionInterval:
            values.pricingModel === 'subscription' ? values.subscriptionInterval : undefined,
          trialDays:
            values.pricingModel === 'subscription' && values.trialDays
              ? Number(values.trialDays)
              : undefined,
        }
      : undefined;

    try {
      const token = getIdToken();
      if (!token) {
        throw new Error('Authentication required');
      }
      const uploadUrlRes = await fetch(tensrApiUrl('/plugins/upload-url'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: values.version,
          name: values.name,
          description: values.description,
          entryPoint: values.entryPoint,
          language: values.language,
          content_type: 'application/zip',
          isPaid: values.isPaid,
          pricing,
        }),
      });
      if (!uploadUrlRes.ok) {
        throw new Error(await uploadUrlRes.text());
      }
      const uploadUrlData = (await uploadUrlRes.json()) as {
        mode?: string;
        plugin_id?: string;
        upload_url?: string;
        s3_key?: string;
      };

      if (
        uploadUrlData.mode === 's3' &&
        uploadUrlData.upload_url &&
        uploadUrlData.plugin_id &&
        uploadUrlData.s3_key
      ) {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.addEventListener('progress', event => {
            if (event.lengthComputable) {
              const pct = Math.round((event.loaded / event.total) * 90);
              setUploadProgress(pct);
            }
          });
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`S3 upload failed (${xhr.status})`));
          });
          xhr.addEventListener('error', () => reject(new Error('Network error during S3 upload')));
          xhr.open('PUT', uploadUrlData.upload_url!);
          xhr.setRequestHeader('Content-Type', 'application/zip');
          xhr.send(selectedFile);
        });
        setUploadProgress(96);
        const completeRes = await fetch(
          tensrApiUrl(`/plugins/${uploadUrlData.plugin_id}/complete-upload`),
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              s3_key: uploadUrlData.s3_key,
              version: values.version,
              name: values.name,
              description: values.description,
              entryPoint: values.entryPoint,
              language: values.language,
              isPaid: values.isPaid,
              pricing,
            }),
          }
        );
        if (!completeRes.ok) {
          throw new Error(await completeRes.text());
        }
      } else {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('name', values.name);
        formData.append('version', values.version);
        formData.append('description', values.description);
        formData.append('entryPoint', values.entryPoint);
        formData.append('language', values.language);
        formData.append('isPaid', String(values.isPaid));
        if (pricing) {
          formData.append('pricingModel', pricing.model);
          formData.append('price', String(pricing.price));
          formData.append('currency', pricing.currency);
          if (pricing.subscriptionInterval) {
            formData.append('subscriptionInterval', pricing.subscriptionInterval);
          }
          if (pricing.trialDays != null) {
            formData.append('trialDays', String(pricing.trialDays));
          }
        }
        const response = await fetch(tensrApiUrl('/plugins/upload'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!response.ok) {
          throw new Error(await response.text());
        }
      }

      setUploadProgress(100);
      router.push('/plugins');
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">Upload New Plugin</h1>
      </div>

      <p className="mb-6 text-sm text-muted-foreground">
        Publish for free, or set a price to earn from your plugin. Tensr takes a 10% platform fee on
        paid sales; the rest goes to you via Stripe Connect (set up payouts from your{' '}
        <a href="/creator" className="underline">
          creator dashboard
        </a>
        ).
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Plugin File</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="plugin-file">Plugin ZIP File</Label>
                  <Input
                    id="plugin-file"
                    type="file"
                    accept=".zip"
                    onChange={handleFileSelect}
                    className="mt-2"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Upload a ZIP file containing your plugin code
                  </p>
                </div>

                {selectedFile && (
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm">
                      <strong>Selected:</strong> {selectedFile.name} (
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plugin Name</FormLabel>
                      <FormControl>
                        <Input placeholder="My Awesome Plugin" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="version"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Version</FormLabel>
                      <FormControl>
                        <Input placeholder="1.0.0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe what your plugin does..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Language</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="typescript">TypeScript</SelectItem>
                          <SelectItem value="python">Python</SelectItem>
                          <SelectItem value="r">R</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="entryPoint"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Entry Point</FormLabel>
                      <FormControl>
                        <Input placeholder="dist/index.js" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tags (comma-separated)</FormLabel>
                      <FormControl>
                        <Input placeholder="analytics, visualization, ml" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="thumbnailUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Thumbnail URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com/thumbnail.png" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Capabilities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="inputTypes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Input Types (comma-separated)</FormLabel>
                      <FormControl>
                        <Input placeholder="csv, json, text" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="outputTypes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Output Types (comma-separated)</FormLabel>
                      <FormControl>
                        <Input placeholder="chart, table, json" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monetization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="isPaid"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Paid plugin</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Charge users to access this plugin via Stripe Checkout.
                      </p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {isPaid && (
                <div className="space-y-4 rounded-md border p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="pricingModel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pricing model</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select pricing model" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="one-time">One-time purchase</SelectItem>
                              <SelectItem value="subscription">Subscription</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Price (USD){pricingModel === 'subscription' ? ' per interval' : ''}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="9.99"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {pricingModel === 'subscription' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="subscriptionInterval"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Billing interval</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select interval" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="yearly">Yearly</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="trialDays"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Free trial (days, optional)</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" max="365" placeholder="0" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Tensr takes a 10% platform fee. Payouts require a connected Stripe account - set
                    this up from your creator dashboard after publishing.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={isUploading || !selectedFile}>
              {isUploading ? (
                <Loader size="sm" className="mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {isUploading ? 'Uploading...' : 'Upload Plugin'}
            </Button>
          </div>

          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Uploading...</span>
                <span className="text-sm font-medium">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </form>
      </Form>
    </div>
  );
}
