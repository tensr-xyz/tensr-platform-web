export type SupportedLanguages = 'typescript' | 'javascript';

// Base metadata interface that will be shared between SDK and API
export interface BasePluginMetadata {
  pluginId: string;
  version: string;
  name: string;
  description: string;
  authorId: string;

  // Technical details
  language: SupportedLanguages;
  entryPoint: string;
  dependencies?: Record<string, string>;
  compatibleVersions?: string[];
  license?: string;

  // Monetization fields
  isPaid: boolean;
  pricing?: {
    model: 'free' | 'one-time' | 'subscription';
    price?: number;
    currency?: string;
    subscriptionInterval?: 'monthly' | 'yearly';
    trialDays?: number;
  };
  tags: string[];
  thumbnailUrl: string;

  // Plugin configuration (deprecated — prefer capabilities limits)
  config?: {
    timeout?: number;
    maxMemory?: number;
    concurrency?: number;
  };

  // Plugin capabilities (aligned with tensr-sdk TensrPluginManifest)
  capabilities?: {
    inputTypes: string[];
    outputTypes: string[];
    network: boolean;
    filesystem: 'none' | 'scratch';
    maxMemoryMb: number;
    maxExecutionSeconds: number;
    dataAccess: Array<'schema' | 'columns' | 'rows' | 'metadata'>;
  };

  /** Admin-only: network egress gate for plugins that declare network:true */
  networkAllowlisted?: boolean;
  /** Admin-approved destination hostnames (and optional *.suffix wildcards) */
  networkAllowedDomains?: string[];
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

// API-specific metadata that includes AWS-related fields
export interface PluginMetadata extends BasePluginMetadata {
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  updatedAt?: string;
  validationErrors?: string[];

  // Revenue tracking
  revenue?: {
    totalSales: number;
    totalDownloads: number;
    platformFee: number; // Default 10%
    creatorPayout: number;
  };
}

// Complete record including S3 and scanning information
export interface PluginRecord extends PluginMetadata {
  s3Key: string;
  scanResults?: {
    passed: boolean;
    findings?: string[];
    scannedAt?: string;
    scanType?: string;
    severity?: string;
    autoReject?: boolean;
  };
}

// Upload response types
export interface PluginUploadResponse {
  executionArn: string;
  pluginId: string;
  version: string;
  status: 'PENDING';
}

// Validation result type
export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
}

// Plugin status types
export type PluginStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// Error types
export class PluginError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'PluginError';
  }
}

interface PaginationParams {
  limit?: number;
  nextToken?: string;
}

export interface GetPluginsOptions extends PaginationParams {
  authorId?: string;
}

// Plugin purchase and licensing types
export interface PluginPurchase {
  purchaseId: string;
  pluginId: string;
  userId: string;
  pricingModel: 'free' | 'one-time' | 'subscription';
  amount: number;
  currency: string;
  stripePaymentIntentId?: string;
  stripeSubscriptionId?: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  purchasedAt: string;
  expiresAt?: string; // For subscriptions
  licenseKey?: string;
}

export interface PluginLicense {
  licenseId: string;
  pluginId: string;
  userId: string;
  purchaseId: string;
  status: 'active' | 'expired' | 'revoked';
  issuedAt: string;
  expiresAt?: string;
  restrictions?: {
    maxUsers?: number;
    maxUsage?: number;
    allowedDomains?: string[];
  };
}

export interface PluginPurchaseOptions {
  pluginId: string;
  pricingModel: 'free' | 'one-time' | 'subscription';
  price?: number;
  currency?: string;
  subscriptionInterval?: 'monthly' | 'yearly';
  trialDays?: number;
}

/** Response from `POST /plugins/{id}/purchase`. Free plugins and already-owned paid
 * plugins complete immediately; unpurchased paid plugins return a Stripe Checkout
 * `checkout_url` to redirect to. */
export interface PluginPurchaseResponse {
  status: 'completed' | 'requires_checkout';
  pluginId: string;
  message?: string;
  purchase?: PluginPurchase;
  downloadUrl?: string;
  checkout_url?: string;
  session_id?: string;
  amount?: number;
  platformFee?: number;
  creatorAmount?: number;
}

export interface PluginInstall {
  installId: string;
  pluginId: string;
  userId: string;
  version?: string | null;
  status: 'installed' | string;
  installedAt?: string;
}

export interface PluginInstallResponse {
  message: string;
  install: PluginInstall;
  plugin: PluginRecord;
}

export interface PluginInstalledListResponse {
  items: Array<PluginInstall & { plugin: PluginRecord }>;
}

export interface PluginAccessResponse {
  pluginId: string;
  isPaid: boolean;
  hasAccess: boolean;
  isInstalled: boolean;
  purchase: PluginPurchase | null;
  install: PluginInstall | null;
}

/** `GET /creator/stats` (tensr-api app/routers/plugins.py). */
export interface CreatorStats {
  totalPlugins: number;
  totalDownloads: number;
  totalRevenue: number;
  totalCustomers: number;
  monthlyRevenue: number;
  monthlyGrowth: number;
  stripeConfigured: boolean;
  stripeConnected: boolean;
  stripeConnectStatus: 'not_connected' | 'pending' | 'onboarded' | string;
}

/** One row from `GET /creator/plugins`. */
export interface CreatorPluginSummary {
  pluginId: string;
  name: string;
  status: PluginStatus;
  isPaid: boolean;
  pricing?: BasePluginMetadata['pricing'];
  downloads: number;
  revenue: number;
  createdAt: string;
  lastUpdated: string;
}

export interface ConnectOnboardingResponse {
  message: string;
  url: string;
  accountId: string;
  status: string;
}

export interface ConnectStatusResponse {
  configured: boolean;
  connected: boolean;
  status: 'not_configured' | 'not_connected' | 'pending' | 'onboarded' | string;
  accountId: string | null;
}
