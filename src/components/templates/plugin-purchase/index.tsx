'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/card';
import { Button } from '@/components/atoms/button';
import { Separator } from '@/components/atoms/separator';
import { ArrowLeft, CreditCard, Download, CheckCircle, Lock } from 'lucide-react';
import { PluginRecord } from '@/types/plugin';
import usePlugins from '@/hooks/api/use-plugin';
import { Loader } from '@/components/molecules/loading';
import { apiClient } from '@/lib/api-client';
import { formatApiErrorMessage } from '@/lib/api-error';
import posthog from 'posthog-js';

export default function PluginPurchase() {
  const params = useParams();
  const router = useRouter();
  const { getPlugin } = usePlugins();

  const [plugin, setPlugin] = useState<PluginRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseComplete, setPurchaseComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.pluginId) {
      fetchPlugin();
    }
  }, [params.pluginId]);

  const fetchPlugin = async () => {
    try {
      const pluginData = await getPlugin(params.pluginId as string);
      setPlugin(pluginData);
    } catch (err) {
      setError('Failed to load plugin');
    } finally {
      setLoading(false);
    }
  };

  // Paid plugin checkout redirects to Stripe (POST /plugins/{id}/purchase — see
  // app/routers/plugins.py). Free plugins complete immediately with no redirect.
  const handlePurchase = async () => {
    if (!plugin) return;

    setPurchasing(true);
    setError(null);

    try {
      const result = await apiClient.plugins.purchase(plugin.pluginId, {
        pricingModel: plugin.pricing?.model || 'free',
        returnTo: `/plugins/${plugin.pluginId}`,
      });

      posthog.capture('plugin_purchase_started', {
        plugin_id: plugin.pluginId,
        plugin_name: plugin.name,
        pricing_model: plugin.pricing?.model,
        price: plugin.pricing?.price,
      });

      if (result.status === 'requires_checkout' && result.checkout_url) {
        window.location.href = result.checkout_url;
        return;
      }

      setPurchaseComplete(true);
    } catch (err) {
      setError(formatApiErrorMessage(err));
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return <Loader fullScreen />;
  }

  if (error || !plugin) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Purchase Error</h1>
          <p className="text-muted-foreground mb-6">
            {error || 'The requested plugin could not be found.'}
          </p>
          <Button onClick={() => router.push('/plugins')}>Back to Marketplace</Button>
        </div>
      </div>
    );
  }

  if (purchaseComplete) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center">
          <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-4">Purchase Complete!</h1>
          <p className="text-muted-foreground mb-6">
            Thank you for your purchase. Install {plugin.name} from its listing to add it to your
            workspace.
          </p>
          <div className="space-y-3">
            <Button onClick={() => router.push(`/plugins/${plugin.pluginId}`)} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Install plugin
            </Button>
            <Button variant="outline" onClick={() => router.push('/plugins')} className="w-full">
              Browse More Plugins
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="outline"
          onClick={() => router.push(`/plugins/${plugin.pluginId}`)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Plugin
        </Button>

        <h1 className="text-3xl font-bold mb-2">
          {plugin.isPaid ? 'Purchase' : 'Get'} {plugin.name}
        </h1>
        <p className="text-muted-foreground">
          {plugin.isPaid
            ? "You'll be redirected to Stripe to complete your purchase securely."
            : 'Complete your purchase to get access to this plugin'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Purchase Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{plugin.isPaid ? 'Checkout' : 'Confirm'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Plugin:</span>
                    <span>{plugin.name}</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Price:</span>
                    <span className="text-lg font-bold">
                      {plugin.isPaid ? (
                        <>
                          ${plugin.pricing?.price ?? '—'}
                          {plugin.pricing?.model === 'subscription' &&
                          plugin.pricing?.subscriptionInterval
                            ? `/${plugin.pricing.subscriptionInterval}`
                            : ''}
                        </>
                      ) : (
                        'Free'
                      )}
                    </span>
                  </div>
                  {plugin.isPaid && (
                    <p className="text-xs text-muted-foreground">
                      Paid to {plugin.authorId} via Stripe. A 10% platform fee applies.
                    </p>
                  )}
                </div>

                <Separator />

                <div className="pt-4">
                  <Button
                    onClick={handlePurchase}
                    disabled={purchasing}
                    className="w-full"
                    size="lg"
                  >
                    {plugin.isPaid ? (
                      <Lock className="h-4 w-4 mr-2" />
                    ) : (
                      <CreditCard className="h-4 w-4 mr-2" />
                    )}
                    {purchasing
                      ? 'Processing...'
                      : plugin.isPaid
                        ? 'Continue to Stripe'
                        : 'Confirm & Continue'}
                  </Button>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                    {error}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What You Get</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Purchase unlocks install</h4>
                    <p className="text-sm text-muted-foreground">
                      After checkout you can install the plugin and run it from Analysis.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Download className="h-5 w-5 text-purple-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Opt-in install</h4>
                    <p className="text-sm text-muted-foreground">
                      Owning a plugin does not force it into your workspace — install only what you
                      want active.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Summary */}
        <div className="space-y-6">
          {/* Plugin Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Plugin Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {plugin.thumbnailUrl && (
                    <img
                      src={plugin.thumbnailUrl}
                      alt={plugin.name}
                      className="w-16 h-16 object-cover rounded-md"
                    />
                  )}
                  <div>
                    <h3 className="font-medium">{plugin.name}</h3>
                    <p className="text-sm text-muted-foreground">{plugin.description}</p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Language:</span>
                    <span className="font-medium">{plugin.language}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Version:</span>
                    <span className="font-medium">{plugin.version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Creator:</span>
                    <span className="font-medium">{plugin.authorId}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
