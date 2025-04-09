export type SupportedLanguages = 'typescript' | 'python' | 'r';

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

  // Plugin configuration
  config?: {
    timeout?: number;
    maxMemory?: number;
    concurrency?: number;
  };

  // Plugin capabilities
  capabilities?: {
    inputTypes: string[];
    outputTypes: string[];
  };
}

// API-specific metadata that includes AWS-related fields
export interface PluginMetadata extends BasePluginMetadata {
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  updatedAt?: string;
  validationErrors?: string[];
}

// Complete record including S3 and scanning information
export interface PluginRecord extends PluginMetadata {
  s3Key: string;
  scanResults?: {
    passed: boolean;
    findings?: string[];
    scannedAt?: string;
    scanType?: string;
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
