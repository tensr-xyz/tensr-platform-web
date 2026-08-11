'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Upload, ArrowLeft } from 'lucide-react';
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
import { Switch } from '@/components/atoms/switch';
import { tensrApiUrl } from '@/lib/tensr-api-url';
import { getIdToken } from '@/utils/auth';
import Link from 'next/link';

const labelClass = 'text-sm font-medium text-muted-foreground';

// Form schema aligned with tensr-sdk TensrPluginManifest capabilities.
// Server authority is still manifest.json inside the zip (parsed on upload).
const pluginUploadSchema = z
  .object({
    name: z.string().min(3, { message: 'Plugin name must be at least 3 characters' }),
    description: z.string().min(10, { message: 'Description must be at least 10 characters' }),
    version: z.string().regex(/^\d+\.\d+\.\d+/, { message: 'Version must be semver (e.g. 1.0.0)' }),
    // Execute path is QuickJS/JS only — python/r are not accepted at upload.
    language: z.enum(['typescript', 'javascript']),
    entryPoint: z.string().min(1, { message: 'Entry point is required' }),
    ui: z.string().min(1, { message: 'UI file path is required' }),
    tags: z.string().optional(),
    thumbnailUrl: z.string().url().optional().or(z.literal('')),
    inputTypes: z.string().min(1, { message: 'At least one input type is required' }),
    outputTypes: z.string().min(1, { message: 'At least one output type is required' }),
    network: z.literal(false),
    filesystem: z.enum(['none', 'scratch']),
    maxMemoryMb: z.coerce.number().min(16).max(1024),
    maxExecutionSeconds: z.coerce.number().min(1).max(120),
    dataAccess: z.string().min(1, { message: 'dataAccess is required (e.g. schema,columns,rows)' }),
    isPaid: z.boolean(),
    pricingModel: z.enum(['one-time', 'subscription']).optional(),
    price: z.string().optional(),
    subscriptionInterval: z.enum(['monthly', 'yearly']).optional(),
    trialDays: z.string().optional(),
  })
  .refine(data => !data.isPaid || (data.price && Number(data.price) > 0), {
    message: 'Price must be greater than 0 for paid plugins',
    path: ['price'],
  })
  .refine(
    data =>
      data.dataAccess
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .every(t => ['schema', 'columns', 'rows', 'metadata'].includes(t)),
    {
      message: 'dataAccess tokens must be schema, columns, rows, and/or metadata',
      path: ['dataAccess'],
    }
  );

type PluginUploadFormValues = z.infer<typeof pluginUploadSchema>;

function Section({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="border-b border-border px-6 py-4">
        <h3 className="text-base font-medium">{title}</h3>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="space-y-6 p-6">{children}</div>
      {footer ? (
        <div className="flex items-center justify-between border-t border-border bg-muted/30 px-6 py-4">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

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
      ui: 'ui.html',
      tags: '',
      thumbnailUrl: '',
      inputTypes: 'csv,json',
      outputTypes: 'json,chart,table',
      network: false as const,
      filesystem: 'none',
      maxMemoryMb: 256,
      maxExecutionSeconds: 30,
      dataAccess: 'schema,columns,rows',
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
      router.push('/plugins/mine');
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 sm:px-0">
      {isUploading ? <Loader fullScreen message={`Uploading… ${uploadProgress}%`} /> : null}

      <div className="text-center">
        <h2 className="text-lg font-medium tracking-tight">Publish plugin</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a ZIP with <code className="text-xs">manifest.json</code>. Free or paid — Tensr
          takes 10% on paid sales via{' '}
          <Link href="/creator" className="underline underline-offset-2">
            Stripe Connect
          </Link>
          .
        </p>
      </div>

      <div className="flex justify-start">
        <Button type="button" variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Section
            title="Plugin file"
            description="ZIP must include manifest.json (source of truth). Uploads land in PENDING review."
          >
            <div>
              <label htmlFor="plugin-file" className={`mb-1 block ${labelClass}`}>
                Plugin ZIP
              </label>
              <Input
                id="plugin-file"
                type="file"
                accept=".zip"
                onChange={handleFileSelect}
                disabled={isUploading}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Network egress is not supported — manifests with{' '}
                <code>capabilities.network: true</code> are rejected.
              </p>
            </div>
            {selectedFile ? (
              <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm">
                <span className="font-medium">Selected:</span>{' '}
                <span className="text-muted-foreground">
                  {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </div>
            ) : null}
          </Section>

          <Section title="Basic information" description="Identity shown in the marketplace">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClass}>Plugin name</FormLabel>
                    <FormControl>
                      <Input placeholder="My Awesome Plugin" disabled={isUploading} {...field} />
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
                    <FormLabel className={labelClass}>Version</FormLabel>
                    <FormControl>
                      <Input placeholder="1.0.0" disabled={isUploading} {...field} />
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
                  <FormLabel className={labelClass}>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe what your plugin does…"
                      className="min-h-[100px]"
                      disabled={isUploading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClass}>Language</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isUploading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="typescript">TypeScript / JavaScript</SelectItem>
                        <SelectItem value="javascript">JavaScript</SelectItem>
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
                    <FormLabel className={labelClass}>Entry point</FormLabel>
                    <FormControl>
                      <Input placeholder="dist/index.js" disabled={isUploading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClass}>Tags (comma-separated)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="analytics, visualization"
                        disabled={isUploading}
                        {...field}
                      />
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
                    <FormLabel className={labelClass}>Thumbnail URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://example.com/thumbnail.png"
                        disabled={isUploading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Section>

          <Section title="Capabilities" description="Must match manifest.json inside the ZIP">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="inputTypes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClass}>Input types</FormLabel>
                    <FormControl>
                      <Input placeholder="csv, json" disabled={isUploading} {...field} />
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
                    <FormLabel className={labelClass}>Output types</FormLabel>
                    <FormControl>
                      <Input placeholder="chart, table, json" disabled={isUploading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="filesystem"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClass}>Filesystem</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isUploading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">none</SelectItem>
                        <SelectItem value="scratch">scratch (ephemeral)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dataAccess"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClass}>Data access</FormLabel>
                    <FormControl>
                      <Input placeholder="schema,columns,rows" disabled={isUploading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxMemoryMb"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClass}>Max memory (MB)</FormLabel>
                    <FormControl>
                      <Input type="number" min={16} max={1024} disabled={isUploading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxExecutionSeconds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClass}>Max execution (seconds)</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={120} disabled={isUploading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ui"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClass}>UI file</FormLabel>
                    <FormControl>
                      <Input placeholder="ui.html" disabled={isUploading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Section>

          <Section
            title="Monetization"
            description="Optional paid access via Stripe Checkout"
            footer={
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isUploading}
                  onClick={() => router.back()}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isUploading || !selectedFile}>
                  {isUploading ? (
                    'Uploading…'
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload plugin
                    </>
                  )}
                </Button>
              </>
            }
          >
            <FormField
              control={form.control}
              name="isPaid"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-md border border-border px-4 py-3">
                  <div className="space-y-0.5 pr-4">
                    <FormLabel className="text-sm font-medium text-foreground">
                      Paid plugin
                    </FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Charge users to access this plugin. Payouts need Stripe Connect on your
                      creator dashboard.
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isUploading}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {isPaid ? (
              <div className="space-y-6 rounded-md border border-border p-4">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="pricingModel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>Pricing model</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          disabled={isUploading}
                        >
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
                        <FormLabel className={labelClass}>
                          Price (USD)
                          {pricingModel === 'subscription' ? ' per interval' : ''}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="9.99"
                            disabled={isUploading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {pricingModel === 'subscription' ? (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="subscriptionInterval"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={labelClass}>Billing interval</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            disabled={isUploading}
                          >
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
                          <FormLabel className={labelClass}>Free trial (days)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="365"
                              placeholder="0"
                              disabled={isUploading}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ) : null}

                <p className="text-xs text-muted-foreground">
                  Tensr takes a 10% platform fee on paid sales.
                </p>
              </div>
            ) : null}
          </Section>
        </form>
      </Form>
    </div>
  );
}
