'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/card';
import { Button } from '@/components/atoms/button';
import { Badge } from '@/components/atoms/badge';
import { Separator } from '@/components/atoms/separator';
import { ArrowLeft, CreditCard, Shield, Download, CheckCircle } from 'lucide-react';
import { PluginRecord } from '@/types/plugin';
import usePlugins from '@/hooks/api/use-plugin';
import { Loader } from '@/components/molecules/loading';
import { devLog } from '@/lib/dev-log';
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

  const handlePurchase = async () => {
    if (!plugin) return;

    setPurchasing(true);
    setError(null);

    try {
      const response = await fetch(`/api/plugins/${plugin.pluginId}/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pricingModel: plugin.pricing?.model || 'one-time',
        }),
      });

      if (!response.ok) {
        throw new Error('Purchase failed');
      }

      const result = await response.json();

      if (result.clientSecret) {
        // Handle Stripe payment
        // This would integrate with Stripe Elements in a real implementation
        devLog('Payment intent created:', result);
        posthog.capture('plugin_purchased', {
          plugin_id: plugin.pluginId,
          plugin_name: plugin.name,
          pricing_model: plugin.pricing?.model,
          price: plugin.pricing?.price,
        });
        setPurchaseComplete(true);
      } else if (result.subscriptionId) {
        // Subscription created
        devLog('Subscription created:', result);
        posthog.capture('plugin_purchased', {
          plugin_id: plugin.pluginId,
          plugin_name: plugin.name,
          pricing_model: plugin.pricing?.model,
          price: plugin.pricing?.price,
        });
        setPurchaseComplete(true);
      } else {
        // Free plugin or direct purchase
        posthog.capture('plugin_purchased', {
          plugin_id: plugin.pluginId,
          plugin_name: plugin.name,
          pricing_model: plugin.pricing?.model,
          price: plugin.pricing?.price,
        });
        setPurchaseComplete(true);
      }
    } catch (err) {
      setError('Failed to process purchase');
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
            Thank you for your purchase. {plugin.name} is now available in your workspace.
          </p>
          <div className="space-y-3">
            <Button onClick={() => router.push('/workspace')} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Go to Workspace
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

        <h1 className="text-3xl font-bold mb-2">Purchase {plugin.name}</h1>
        <p className="text-muted-foreground">Complete your purchase to get access to this plugin</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Purchase Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Information</CardTitle>
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
                      ${plugin.pricing?.price}
                      {plugin.pricing?.model === 'subscription' && (
                        <span className="text-muted-foreground">
                          /{plugin.pricing.subscriptionInterval}
                        </span>
                      )}
                    </span>
                  </div>
                  {plugin.pricing?.trialDays && plugin.pricing.trialDays > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Trial:</span>
                      <span className="text-green-600">
                        {plugin.pricing.trialDays}-day free trial
                      </span>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span>Subtotal:</span>
                    <span>${plugin.pricing?.price}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Platform Fee (10%):</span>
                    <span>${((plugin.pricing?.price || 0) * 0.1).toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span>${((plugin.pricing?.price || 0) * 1.1).toFixed(2)}</span>
                  </div>
                </div>

                <div className="pt-4">
                  <Button
                    onClick={handlePurchase}
                    disabled={purchasing}
                    className="w-full"
                    size="lg"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    {purchasing ? 'Processing...' : 'Complete Purchase'}
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

          {/* Security & Trust */}
          <Card>
            <CardHeader>
              <CardTitle>Security & Trust</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Secure Payment</h4>
                    <p className="text-sm text-muted-foreground">
                      All payments are processed securely through Stripe with bank-level encryption.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Instant Access</h4>
                    <p className="text-sm text-muted-foreground">
                      Get immediate access to your plugin after successful payment.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Download className="h-5 w-5 text-purple-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Easy Installation</h4>
                    <p className="text-sm text-muted-foreground">
                      Plugin is automatically installed and available in your workspace.
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
                    <span className="font-medium">
                      {(plugin as any).authorName || (plugin as any).author || 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* What You Get */}
          <Card>
            <CardHeader>
              <CardTitle>What You Get</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Full plugin source code</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Documentation and examples</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Lifetime access (one-time purchase)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Automatic updates</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Technical support</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
