import { getSessionToken, getSessionJwt } from '@/utils/auth';
import { getUsageTracker } from '@/utils/usage-tracker';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const FARGATE_API_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:8080'
    : process.env.NEXT_PUBLIC_FARGATE_API_URL;

// Generic API client with authentication
class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    useFargate: boolean = false
  ): Promise<T> {
    const token = getSessionJwt() || getSessionToken();

    if (!token) {
      throw new Error('No authentication token found');
    }

    const baseUrl = useFargate ? FARGATE_API_URL : API_BASE_URL;
    const url = `${baseUrl}${endpoint}`;

    const startTime = performance.now();
    let requestSize = 0;
    let responseSize = 0;

    // Calculate request size
    if (options.body) {
      if (options.body instanceof FormData) {
        // FormData size estimation
        requestSize = JSON.stringify(Array.from(options.body.entries())).length;
      } else if (typeof options.body === 'string') {
        requestSize = new Blob([options.body]).size;
      } else {
        requestSize = JSON.stringify(options.body).length;
      }
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      });

      // Calculate response size
      const responseClone = response.clone();
      const responseText = await responseClone.text();
      responseSize = new Blob([responseText]).size;

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const duration = performance.now() - startTime;
      const data = JSON.parse(responseText);

      // Track API usage
      try {
        const usageTracker = getUsageTracker(() => getSessionJwt() || getSessionToken());
        usageTracker.trackAPICall(endpoint, options.method || 'GET', {
          duration,
          requestSize,
          responseSize,
          dataProcessed: requestSize + responseSize,
          metadata: {
            statusCode: response.status,
            useFargate,
          },
        });
      } catch (trackingError) {
        // Don't fail the request if tracking fails
        console.warn('Failed to track API usage:', trackingError);
      }

      return data;
    } catch (error) {
      const duration = performance.now() - startTime;

      // Track failed API call
      try {
        const usageTracker = getUsageTracker(() => getSessionJwt() || getSessionToken());
        usageTracker.trackAPICall(endpoint, options.method || 'GET', {
          duration,
          requestSize,
          responseSize,
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error',
            useFargate,
          },
        });
      } catch (trackingError) {
        // Ignore tracking errors
      }

      throw error;
    }
  }

  // Files API
  files = {
    list: (params?: { context?: string; organizationId?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.context) searchParams.append('context', params.context);
      if (params?.organizationId) searchParams.append('organizationId', params.organizationId);

      return this.request<{ files: any[]; context: any; total: number }>(
        `/files?${searchParams.toString()}`
      );
    },

    get: (id: string) => this.request<any>(`/files/${id}`),

    create: (data: FormData) =>
      this.request<any>('/files', {
        method: 'POST',
        body: data,
        headers: {}, // Let browser set content-type for FormData
      }),

    update: (id: string, data: any) =>
      this.request<any>(`/files/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (id: string) => this.request<void>(`/files/${id}`, { method: 'DELETE' }),

    uploadUrl: (data: any) =>
      this.request<any>('/files/upload-url', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    completeUpload: (id: string, data: any) =>
      this.request<any>(`/files/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    versions: (id: string) => this.request<any[]>(`/files/${id}/versions`),

    getVersion: (fileId: string, versionId: string) =>
      this.request<any>(`/files/${fileId}/versions/${versionId}`),

    revert: (fileId: string, versionId: string) =>
      this.request<any>(`/files/${fileId}/revert/${versionId}`, { method: 'POST' }),
  };

  // Projects API
  projects = {
    list: async () => {
      const response = await this.request<{ projects: any[] }>('/projects');
      return response.projects; // Extract the projects array
    },

    get: (id: string) => this.request<any>(`/projects/${id}`),

    create: (data: any) =>
      this.request<any>('/projects/create', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: any) =>
      this.request<any>(`/projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (id: string) => this.request<void>(`/projects/${id}`, { method: 'DELETE' }),

    uploadUrl: (id: string, data: any) =>
      this.request<any>(`/projects/${id}/upload-url`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    completeUpload: (id: string, data: any) =>
      this.request<any>(`/projects/${id}/complete-upload`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // New project management methods
    getUploadUrl: (data: any) =>
      this.request<any>(`/projects/${data.projectId}/upload`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getUserProjects: (userId: string) => this.request<any[]>(`/users/${userId}/projects`),
  };

  // Auth API
  auth = {
    refreshTokens: (data: any) =>
      this.request<any>('/auth/refresh-tokens', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    initiateAuth: (data: any) =>
      this.request<any>('/auth/initiate-auth', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    verifyAuth: (data: any) =>
      this.request<any>('/auth/verify-auth', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    resendCode: (data: any) =>
      this.request<any>('/auth/resend-code', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };

  // Users API
  users = {
    get: (id: string) => this.request<any>(`/users/${id}`),

    update: (id: string, data: any) =>
      this.request<any>(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  };

  // Billing API
  billing = {
    subscription: () => this.request<any>('/billing/subscription'),

    invoices: () => this.request<any[]>('/billing/invoices'),

    usageStats: () => this.request<any>('/usage/stats'),

    paymentMethods: () => this.request<any[]>('/billing/payment-methods'),

    plans: () => this.request<any[]>('/billing/plans'),

    cancelSubscription: (data: any) =>
      this.request<any>('/billing/cancel-subscription', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    createPaymentIntent: (data: any) =>
      this.request<any>('/billing/create-payment-intent', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    addPaymentMethod: (data: any) =>
      this.request<any>('/billing/payment-methods', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    deletePaymentMethod: (id: string) =>
      this.request<void>(`/billing/payment-methods/${id}`, { method: 'DELETE' }),

    updateSubscription: (data: any) =>
      this.request<any>('/billing/update-subscription', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  };

  // Organizations API
  organizations = {
    list: () => this.request<any[]>('/organizations'),

    get: (id: string) => this.request<any>(`/organizations/${id}`),

    create: (data: any) =>
      this.request<any>('/organizations', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: any) =>
      this.request<any>(`/organizations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (id: string) => this.request<void>(`/organizations/${id}`, { method: 'DELETE' }),

    members: (id: string) => this.request<any[]>(`/organizations/${id}/members`),

    addMember: (id: string, data: any) =>
      this.request<any>(`/organizations/${id}/members`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    removeMember: (orgId: string, memberId: string) =>
      this.request<void>(`/organizations/${orgId}/members/${memberId}`, { method: 'DELETE' }),

    teams: (id: string) => this.request<any[]>(`/organizations/${id}/teams`),

    createTeam: (id: string, data: any) =>
      this.request<any>(`/organizations/${id}/teams`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateTeam: (orgId: string, teamId: string, data: any) =>
      this.request<any>(`/organizations/${orgId}/teams/${teamId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    deleteTeam: (orgId: string, teamId: string) =>
      this.request<void>(`/organizations/${orgId}/teams/${teamId}`, { method: 'DELETE' }),
  };

  // Plugins API
  plugins = {
    list: () => this.request<any[]>('/plugins'),

    get: (id: string) => this.request<any>(`/plugins/${id}`),

    install: (id: string) => this.request<any>(`/plugins/${id}/install`, { method: 'POST' }),

    uninstall: (id: string) => this.request<any>(`/plugins/${id}/uninstall`, { method: 'POST' }),

    downloadUrl: (id: string) => this.request<any>(`/plugins/${id}/download-url`),

    execute: (id: string, data: any, config?: any) =>
      this.request<any>(`/plugins/${id}/execute`, {
        method: 'POST',
        body: JSON.stringify({ data, config }),
      }),

    purchase: (id: string, data: any) =>
      this.request<any>(`/plugins/${id}/purchase`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    upload: (data: FormData) =>
      this.request<any>('/plugins/upload', {
        method: 'POST',
        body: data,
        headers: {}, // Let browser set content-type for FormData
      }),
  };

  // Statistics API
  statistics = {
    mean: (data: any) =>
      this.request<any>(
        '/api/statistics/calculate-means',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    ttest: (data: any) =>
      this.request<any>(
        '/api/statistics/calculate-one-sample-ttest',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    anova: (data: any) =>
      this.request<any>(
        '/api/statistics/calculate-anova',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    // New descriptive statistics endpoints
    comprehensiveDescriptives: (data: any) =>
      this.request<any>(
        '/api/statistics/calculate-comprehensive-descriptives',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    mode: (data: any) =>
      this.request<any>(
        '/api/statistics/calculate-mode',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    // Correlation and regression
    correlation: (data: any) =>
      this.request<any>(
        '/api/statistics/calculate-correlation',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    linearRegression: (data: any) =>
      this.request<any>(
        '/api/statistics/perform-linear-regression',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    // Non-parametric tests
    chiSquare: (data: any) =>
      this.request<any>(
        '/api/statistics/perform-chi-square-test',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    mannWhitneyU: (data: any) =>
      this.request<any>(
        '/api/statistics/perform-mann-whitney-u-test',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    wilcoxonSignedRank: (data: any) =>
      this.request<any>(
        '/api/statistics/perform-wilcoxon-signed-rank-test',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    kruskalWallis: (data: any) =>
      this.request<any>(
        '/api/statistics/perform-kruskal-wallis-test',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    // Clustering methods
    kmeans: (data: any) =>
      this.request<any>(
        '/api/analysis/clustering/kmeans',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    hierarchicalClustering: (data: any) =>
      this.request<any>(
        '/api/analysis/clustering/hierarchical',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    dbscan: (data: any) =>
      this.request<any>(
        '/api/analysis/clustering/dbscan',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    // Time series methods
    arima: (data: any) =>
      this.request<any>(
        '/api/analysis/time-series/arima',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    exponentialSmoothing: (data: any) =>
      this.request<any>(
        '/api/analysis/time-series/exponential-smoothing',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    seasonalDecomposition: (data: any) =>
      this.request<any>(
        '/api/analysis/time-series/seasonal-decomposition',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    // Factor analysis
    factorAnalysis: (data: any) =>
      this.request<any>(
        '/api/analysis/factor-analysis',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),
  };

  // Analysis API
  analysis = {
    // Factor analysis
    pca: (data: any) =>
      this.request<any>(
        '/api/analysis/perform-pca',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    efa: (data: any) =>
      this.request<any>(
        '/api/analysis/perform-efa',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    factorAnalysis: (data: any) =>
      this.request<any>(
        '/api/analysis/factor-analysis',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    // Clustering
    kmeans: (data: any) =>
      this.request<any>(
        '/api/analysis/clustering/kmeans',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    hierarchicalClustering: (data: any) =>
      this.request<any>(
        '/api/analysis/clustering/hierarchical',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    dbscan: (data: any) =>
      this.request<any>(
        '/api/analysis/clustering/dbscan',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    // Time series
    arima: (data: any) =>
      this.request<any>(
        '/api/analysis/time-series/arima',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    exponentialSmoothing: (data: any) =>
      this.request<any>(
        '/api/analysis/time-series/exponential-smoothing',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    seasonalDecomposition: (data: any) =>
      this.request<any>(
        '/api/analysis/time-series/seasonal-decomposition',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    // Machine learning
    decisionTree: (data: any) =>
      this.request<any>(
        '/api/analysis/ml/decision-tree',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    randomForest: (data: any) =>
      this.request<any>(
        '/api/analysis/ml/random-forest',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    neuralNetwork: (data: any) =>
      this.request<any>(
        '/api/analysis/ml/neural-network',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    svm: (data: any) =>
      this.request<any>(
        '/api/analysis/ml/svm',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    // Model selection
    automatedModelSelection: (data: any) =>
      this.request<any>(
        '/api/analysis/model-selection/automated',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    hyperparameterTuning: (data: any) =>
      this.request<any>(
        '/api/analysis/model-selection/hyperparameter-tuning',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    // GLM models
    logisticRegression: (data: any) =>
      this.request<any>(
        '/api/analysis/glm/logistic',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    poissonRegression: (data: any) =>
      this.request<any>(
        '/api/analysis/glm/poisson',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    mixedModel: (data: any) =>
      this.request<any>(
        '/api/analysis/glm/mixed-model',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    // Survival analysis
    kaplanMeier: (data: any) =>
      this.request<any>(
        '/api/analysis/survival/kaplan-meier',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    coxRegression: (data: any) =>
      this.request<any>(
        '/api/analysis/survival/cox-regression',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    logRankTest: (data: any) =>
      this.request<any>(
        '/api/analysis/survival/log-rank-test',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    // Structural Equation Modeling
    sem: (data: any) =>
      this.request<any>(
        '/api/analysis/sem',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    // Regression
    regression: (data: any) =>
      this.request<any>(
        '/analysis/regression',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    anova: (data: any) =>
      this.request<any>(
        '/analysis/anova',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    correlations: (data: any) =>
      this.request<any>(
        '/analysis/correlations',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    list: (datasetId: string) => this.request<any[]>(`/datasets/${datasetId}/analyses`),

    get: (analysisId: string) => this.request<any>(`/analysis/${analysisId}`),

    // Clustering (structured)
    clustering: {
      kmeans: (data: {
        datasetId: string;
        variables: string[];
        k: number;
        maxIterations?: number;
        tolerance?: number;
        projectId?: string;
      }) =>
        this.request<any>('/analysis/clustering/kmeans', {
          method: 'POST',
          body: JSON.stringify(data),
        }),

      hierarchical: (data: {
        datasetId: string;
        variables: string[];
        linkage?: string;
        distanceMetric?: string;
        nClusters?: number;
        projectId?: string;
      }) =>
        this.request<any>('/analysis/clustering/hierarchical', {
          method: 'POST',
          body: JSON.stringify(data),
        }),

      dbscan: (data: {
        datasetId: string;
        variables: string[];
        eps: number;
        minSamples: number;
        projectId?: string;
      }) =>
        this.request<any>('/analysis/clustering/dbscan', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
    },

    // Simulations
    simulation: {
      power: (data: {
        analysisType: string;
        effectSize?: number;
        sampleSizes?: number[];
        alpha?: number;
        power?: number;
        alternative?: string;
        testType?: string;
      }) =>
        this.request<any>('/analysis/simulation/power', {
          method: 'POST',
          body: JSON.stringify(data),
        }),

      whatIf: (data: {
        analysisId: string;
        scenario: string;
        variableChanges?: Record<string, any>;
        datasetId?: string;
      }) =>
        this.request<any>('/analysis/simulation/what-if', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
    },
  };

  // Transform API
  transform = {
    countValues: (data: any) =>
      this.request<any>(
        '/api/transform/count-values',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    shiftValues: (data: any) =>
      this.request<any>(
        '/api/transform/shift-values',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),

    computeVariable: (data: any) =>
      this.request<any>(
        '/api/transform/compute-variable',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        true
      ),
  };

  // Collaboration API
  collaboration = {
    sessions: () => this.request<any[]>('/sessions'),

    createSession: (data: any) =>
      this.request<any>('/sessions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    joinSession: (id: string) => this.request<any>(`/sessions/${id}/join`, { method: 'POST' }),

    leaveSession: (id: string) => this.request<any>(`/sessions/${id}/leave`, { method: 'POST' }),
  };

  // Feedback API
  feedback = {
    submit: (data: any) =>
      this.request<any>('/feedback', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };

  // Agent API
  agent = {
    chat: (data: any) =>
      this.request<any>(`/projects/${data.projectId}/agent/query`, {
        method: 'POST',
        body: JSON.stringify({
          query: data.message,
          cursor: data.cursor,
          options: data.options,
          authToken: data.authToken, // Add the auth token
        }),
      }),

    approve: (data: any) =>
      this.request<any>(`/projects/${data.projectId}/agent/approve`, {
        method: 'POST',
        body: JSON.stringify({
          command: data.command,
          approved: data.approved,
          authToken: data.authToken,
        }),
      }),
  };

  // Datasets API
  datasets = {
    create: (data: any) =>
      this.request<any>('/datasets', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    get: (id: string) => this.request<any>(`/datasets/${id}`),

    getColumns: (datasetId: string) => this.request<any>(`/datasets/${datasetId}/columns`),

    getColumnInspector: (datasetId: string, columnId: string) =>
      this.request<any>(`/datasets/${datasetId}/columns/${columnId}/inspector`),

    getRows: (datasetId: string, params?: { offset?: number; limit?: number; filters?: any[] }) => {
      const searchParams = new URLSearchParams();
      if (params?.offset !== undefined) searchParams.append('offset', String(params.offset));
      if (params?.limit !== undefined) searchParams.append('limit', String(params.limit));
      if (params?.filters) searchParams.append('filters', JSON.stringify(params.filters));
      return this.request<any>(`/datasets/${datasetId}/rows?${searchParams.toString()}`);
    },

    createColumn: (datasetId: string, data: { name: string; expression: string }) =>
      this.request<any>(`/datasets/${datasetId}/columns`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };

  // AI API
  ai = {
    columnInsight: (data: { datasetId: string; columnId: string; stats?: any }) =>
      this.request<any>('/ai/column-insight', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    rowInsight: (data: { datasetId: string; rowId: string; rowData: Record<string, any> }) =>
      this.request<any>('/ai/row-insight', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    fixRow: (data: {
      datasetId: string;
      rowId: string;
      rowData: Record<string, any>;
      columnStats?: any;
    }) =>
      this.request<any>('/ai/fix-row', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    suggestTransformations: (data: {
      datasetId: string;
      columnId: string;
      columnType?: string;
      stats?: any;
    }) =>
      this.request<any>('/ai/suggest-transformations', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    cleanCategories: (data: { datasetId: string; columnId: string; uniqueValues?: string[] }) =>
      this.request<any>('/ai/clean-categories', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    detectOutliers: (data: { datasetId: string; columnId: string; stats?: any }) =>
      this.request<any>('/ai/detect-outliers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    dataQualityScan: (data: { datasetId: string; datasetSchema?: any; columnStats?: any }) =>
      this.request<any>('/ai/data-quality-scan', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    explainResult: (data: {
      analysisType: string;
      results: any;
      context?: any;
      teachingMode?: boolean;
    }) =>
      this.request<any>('/ai/explain-result', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    relationships: (data: { datasetId: string; targetColumnId: string }) =>
      this.request<any>('/ai/relationships', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    newColumn: (data: { datasetSchema: any; instruction: string }) =>
      this.request<any>('/ai/new-column', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    filters: (data: { datasetSchema: any; instruction: string }) =>
      this.request<any>('/ai/filters', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    analysisPlanner: (data: { datasetSchema: any; question: string }) =>
      this.request<any>('/ai/analysis-planner', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    apaWriteup: (data: { analysisType: string; results: any; context: any }) =>
      this.request<any>('/ai/apa-writeup', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };

  // Worker API
  workers = {
    summarize: (data: any) =>
      this.request<any>('/workers/summarize', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };
}

export const apiClient = new ApiClient();
