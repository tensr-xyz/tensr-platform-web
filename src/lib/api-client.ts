import { getSessionToken, getSessionJwt, getTensrApiHeaders } from '@/utils/auth';
import { getUsageTracker } from '@/utils/usage-tracker';
import { getTensrApiBaseUrl, tensrApiUrl } from '@/lib/tensr-api-url';
import { ApiRequestError } from '@/lib/api-error';
import { handleUnauthorizedResponse } from '@/lib/session-expired';

// Generic API client with authentication
class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = getSessionJwt() || getSessionToken();

    if (!token) {
      throw new Error('No authentication token found');
    }

    const url = tensrApiUrl(endpoint);

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
        if (handleUnauthorizedResponse(response)) {
          throw new ApiRequestError(401, errorText);
        }
        throw new ApiRequestError(response.status, errorText);
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
      const token = getSessionJwt() || getSessionToken();
      if (!token) {
        throw new Error('No authentication token found');
      }
      const headers: HeadersInit = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const res = await fetch(tensrApiUrl('/datasets/?scope=all'), { headers });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API Error: ${res.status} - ${text}`);
      }
      const rows = await res.json();
      if (!Array.isArray(rows)) {
        return [];
      }
      return rows.map((d: Record<string, unknown>) => ({
        projectId: String(d.dataset_id ?? ''),
        projectName: String(d.original_filename || 'Dataset'),
        id: String(d.dataset_id ?? ''),
        name: String(d.original_filename || 'Dataset'),
        updatedAt: String(d.updated_at ?? ''),
        createdAt: String(d.updated_at ?? ''),
        sourceType: 'folder' as const,
        size: 0,
        status: 'ready' as const,
      }));
    },

    get: async (id: string) => {
      const token = getSessionJwt() || getSessionToken();
      if (!token) {
        throw new Error('No authentication token found');
      }
      const headers = getTensrApiHeaders({ 'Content-Type': 'application/json' });

      const dsRes = await fetch(tensrApiUrl(`/datasets/${id}/schema`), { headers });
      if (dsRes.ok) {
        const schema = await dsRes.json();
        const label = (schema.original_filename && String(schema.original_filename)) || 'Dataset';
        return {
          projectId: id,
          projectName: label,
          id,
          name: label,
          path: id,
          sourceType: 'file',
        };
      }

      if (dsRes.status === 403) {
        const errorText = await dsRes.text();
        throw new Error(`Dataset not accessible with current organization context: ${errorText}`);
      }
      if (dsRes.status !== 404) {
        const errorText = await dsRes.text();
        throw new Error(`Failed to load dataset: ${dsRes.status} - ${errorText}`);
      }

      return this.request<any>(`/projects/${id}`);
    },

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
    list: () => this.request<any[]>('/api/organizations'),

    get: (id: string) => this.request<any>(`/api/organizations/${id}`),

    create: (data: any) =>
      this.request<any>('/api/organizations', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: any) =>
      this.request<any>(`/api/organizations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (id: string) => this.request<void>(`/api/organizations/${id}`, { method: 'DELETE' }),

    members: (id: string) => this.request<any[]>(`/api/organizations/${id}/members`),

    addMember: (id: string, data: any) =>
      this.request<any>(`/api/organizations/${id}/members`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    removeMember: (orgId: string, memberId: string) =>
      this.request<void>(`/api/organizations/${orgId}/members/${memberId}`, { method: 'DELETE' }),

    teams: (id: string) => this.request<any[]>(`/api/organizations/${id}/teams`),

    createTeam: (id: string, data: any) =>
      this.request<any>(`/api/organizations/${id}/teams`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateTeam: (orgId: string, teamId: string, data: any) =>
      this.request<any>(`/api/organizations/${orgId}/teams/${teamId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    deleteTeam: (orgId: string, teamId: string) =>
      this.request<void>(`/api/organizations/${orgId}/teams/${teamId}`, { method: 'DELETE' }),
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
      this.request<any>('/api/statistics/calculate-means', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    ttest: (data: any) =>
      this.request<any>('/api/statistics/calculate-one-sample-ttest', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    anova: (data: any) =>
      this.request<any>('/api/statistics/calculate-anova', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // New descriptive statistics endpoints
    comprehensiveDescriptives: (data: any) =>
      this.request<any>('/api/statistics/calculate-comprehensive-descriptives', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    mode: (data: any) =>
      this.request<any>('/api/statistics/calculate-mode', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Correlation and regression
    correlation: (data: any) =>
      this.request<any>('/api/statistics/calculate-correlation', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    linearRegression: (data: any) =>
      this.request<any>('/api/statistics/perform-linear-regression', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Non-parametric tests
    chiSquare: (data: any) =>
      this.request<any>('/api/statistics/perform-chi-square-test', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    mannWhitneyU: (data: any) =>
      this.request<any>('/api/statistics/perform-mann-whitney-u-test', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    wilcoxonSignedRank: (data: any) =>
      this.request<any>('/api/statistics/perform-wilcoxon-signed-rank-test', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    kruskalWallis: (data: any) =>
      this.request<any>('/api/statistics/perform-kruskal-wallis-test', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Clustering methods
    kmeans: (data: any) =>
      this.request<any>('/api/analysis/clustering/kmeans', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    hierarchicalClustering: (data: any) =>
      this.request<any>('/api/analysis/clustering/hierarchical', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    dbscan: (data: any) =>
      this.request<any>('/api/analysis/clustering/dbscan', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Time series methods
    arima: (data: any) =>
      this.request<any>('/api/analysis/time-series/arima', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    exponentialSmoothing: (data: any) =>
      this.request<any>('/api/analysis/time-series/exponential-smoothing', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    seasonalDecomposition: (data: any) =>
      this.request<any>('/api/analysis/time-series/seasonal-decomposition', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Factor analysis
    factorAnalysis: (data: any) =>
      this.request<any>('/api/analysis/factor-analysis', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };

  // Analysis API
  analysis = {
    // Factor analysis
    pca: (data: any) =>
      this.request<any>('/api/analysis/perform-pca', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    efa: (data: any) =>
      this.request<any>('/api/analysis/perform-efa', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    factorAnalysis: (data: any) =>
      this.request<any>('/api/analysis/factor-analysis', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Clustering
    kmeans: (data: any) =>
      this.request<any>('/api/analysis/clustering/kmeans', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    hierarchicalClustering: (data: any) =>
      this.request<any>('/api/analysis/clustering/hierarchical', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    dbscan: (data: any) =>
      this.request<any>('/api/analysis/clustering/dbscan', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Time series
    arima: (data: any) =>
      this.request<any>('/api/analysis/time-series/arima', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    exponentialSmoothing: (data: any) =>
      this.request<any>('/api/analysis/time-series/exponential-smoothing', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    seasonalDecomposition: (data: any) =>
      this.request<any>('/api/analysis/time-series/seasonal-decomposition', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Machine learning
    decisionTree: (data: any) =>
      this.request<any>('/api/analysis/ml/decision-tree', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    randomForest: (data: any) =>
      this.request<any>('/api/analysis/ml/random-forest', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    neuralNetwork: (data: any) =>
      this.request<any>('/api/analysis/ml/neural-network', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    svm: (data: any) =>
      this.request<any>('/api/analysis/ml/svm', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Model selection
    automatedModelSelection: (data: any) =>
      this.request<any>('/api/analysis/model-selection/automated', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    hyperparameterTuning: (data: any) =>
      this.request<any>('/api/analysis/model-selection/hyperparameter-tuning', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // GLM models
    logisticRegression: (data: any) =>
      this.request<any>('/api/analysis/glm/logistic', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    poissonRegression: (data: any) =>
      this.request<any>('/api/analysis/glm/poisson', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    mixedModel: (data: any) =>
      this.request<any>('/api/analysis/glm/mixed-model', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Survival analysis
    kaplanMeier: (data: any) =>
      this.request<any>('/api/analysis/survival/kaplan-meier', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    coxRegression: (data: any) =>
      this.request<any>('/api/analysis/survival/cox-regression', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    logRankTest: (data: any) =>
      this.request<any>('/api/analysis/survival/log-rank-test', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Structural Equation Modeling
    sem: (data: any) =>
      this.request<any>('/api/analysis/sem', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Regression / ANOVA / correlations (tensr-api datasets analyze)
    regression: (data: {
      datasetId: string;
      dependent: string;
      predictors: string[];
      controls?: string[];
    }) =>
      this.datasets.analyze.run(data.datasetId, 'linear_regression', {
        dependent: data.dependent,
        independents: [...data.predictors, ...(data.controls ?? [])],
      }),

    anova: (data: {
      datasetId: string;
      dependent: string;
      independent?: string;
      groups?: string[];
    }) =>
      this.datasets.analyze.run(data.datasetId, 'anova_oneway', {
        group_column: data.independent || data.groups?.[0],
        value_column: data.dependent,
        post_hoc: 'none',
      }),

    correlations: (data: { datasetId: string; variables: string[] }) =>
      this.datasets.analyze.run(data.datasetId, 'correlation', {
        columns: data.variables,
        method: 'pearson',
      }),

    list: (datasetId: string) => this.datasets.analyze.listRuns(datasetId),

    get: (runId: string) => this.request<any>(`/datasets/analysis-runs/${runId}`),

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
      this.request<any>('/api/transform/count-values', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    shiftValues: (data: any) =>
      this.request<any>('/api/transform/shift-values', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    computeVariable: (data: any) =>
      this.request<any>('/api/transform/compute-variable', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };

  // Collaboration sessions (tensr-api)
  collaboration = {
    sessions: () => this.request<any[]>('/sessions'),

    getSession: (id: string) => this.request<any>(`/sessions/${id}`),

    createSession: (data: {
      datasetId?: string;
      filePath?: string;
      fileName: string;
      userName: string;
    }) =>
      this.request<any>('/sessions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    joinSession: (id: string, data?: { userName?: string }) =>
      this.request<any>(`/sessions/${id}/join`, {
        method: 'POST',
        body: JSON.stringify(data ?? {}),
      }),

    leaveSession: (id: string) =>
      this.request<any>(`/sessions/${id}/leave`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
  };

  // Feedback API
  feedback = {
    submit: (data: any) =>
      this.request<any>('/feedback', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };

  /** tensr-api `/assistant/*` — dataset-scoped tutor / intent. */
  assistant = {
    parseIntent: (data: {
      datasetId: string;
      message: string;
      conversationHistory?: Array<{ role: string; content: string }>;
      glossary?: string | null;
    }) =>
      this.request<{
        status: string;
        interpretation: string;
        analysis_type?: string | null;
        request_body?: Record<string, unknown> | null;
        plan_summary?: string | null;
        clarification_questions?: string[];
        validation_errors?: string[];
        reason_if_unsupported?: string | null;
        intent_kind?: 'analysis' | 'action' | null;
        action_type?: string | null;
        action_spec?: Record<string, unknown> | null;
        auto_execute?: boolean;
      }>('/assistant/parse-intent', {
        method: 'POST',
        body: JSON.stringify({
          dataset_id: data.datasetId,
          message: data.message,
          conversation_history: data.conversationHistory ?? null,
          glossary: data.glossary ?? null,
        }),
      }),
    executeAction: (data: {
      datasetId: string;
      actionType: string;
      actionSpec?: Record<string, unknown> | null;
    }) =>
      this.request<{
        ok: boolean;
        action_type: string;
        answer_markdown: string;
        answer_summary?: string;
        filters?: Array<{ columnId: string; operator: string; value: unknown }>;
        matched_rows?: number;
        total_rows?: number;
        requires_confirm?: boolean;
        apply_to_ui?: boolean;
        chart?: Record<string, unknown>;
        error?: string;
        repair?: {
          reason?: string;
          suggested_columns?: string[];
          suggested_spec?: Record<string, unknown> | null;
        };
      }>('/assistant/execute-action', {
        method: 'POST',
        body: JSON.stringify({
          dataset_id: data.datasetId,
          action_type: data.actionType,
          action_spec: data.actionSpec ?? null,
        }),
      }),
    synthesizeReport: (data: {
      report: Record<string, unknown>;
      datasetId?: string | null;
      userQuestion?: string | null;
      prepLog?: string | null;
      chartAssets?: Array<{ title?: string; kind?: string; note?: string }>;
      useLlm?: boolean;
    }) =>
      this.request<{
        markdown: string;
        source: 'llm' | 'template';
      }>('/assistant/synthesize-report', {
        method: 'POST',
        body: JSON.stringify({
          report: data.report,
          dataset_id: data.datasetId ?? null,
          user_question: data.userQuestion ?? null,
          prep_log: data.prepLog ?? null,
          chart_assets: data.chartAssets ?? null,
          use_llm: data.useLlm ?? true,
        }),
      }),
    followup: (data: {
      datasetId: string;
      message: string;
      context?: Record<string, unknown> | null;
      conversationHistory?: Array<{ role: string; content: string }>;
    }) =>
      this.request<{ answer_markdown: string; source: string }>('/assistant/followup', {
        method: 'POST',
        body: JSON.stringify({
          dataset_id: data.datasetId,
          message: data.message,
          context: data.context ?? null,
          conversation_history: data.conversationHistory ?? null,
        }),
      }),
    suggestAnalyses: (data: {
      datasetId: string;
      conversationHistory?: Array<{ role: string; content: string }>;
    }) =>
      this.request<{
        suggestions: Array<{
          analysis_type: string;
          rationale: string;
          request_body: Record<string, unknown>;
        }>;
        source: string;
      }>('/assistant/suggest-analyses', {
        method: 'POST',
        body: JSON.stringify({
          dataset_id: data.datasetId,
          conversation_history: data.conversationHistory ?? null,
        }),
      }),
  };
  datasets = {
    create: (data: any) =>
      this.request<any>('/datasets', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      this.request<{ deleted: boolean; dataset_id: string }>(`/datasets/${id}`, {
        method: 'DELETE',
      }),

    get: (id: string) => this.request<any>(`/datasets/${id}`),

    getSchema: (datasetId: string) =>
      this.request<{
        dataset_id: string;
        schema: { name: string; type: string; missing_count: number }[];
        n_rows: number;
        n_cols: number;
      }>(`/datasets/${datasetId}/schema`),

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

    analyze: {
      run: (datasetId: string, op: string, body: Record<string, unknown>) =>
        this.request<import('@/lib/analysis-report-types').AnalyzeResponse>(
          `/datasets/${datasetId}/analyze/${op}`,
          {
            method: 'POST',
            body: JSON.stringify(body),
          }
        ),

      listRuns: (datasetId: string) =>
        this.request<{ dataset_id: string; runs: unknown[] }>(`/datasets/${datasetId}/runs`),

      get: (runId: string) => this.request<any>(`/datasets/analysis-runs/${runId}`),
    },
  };

  execute = {
    python: (data: { code: string; dataset_id?: string | null }) =>
      this.request<{ stdout: string | null; output: any; error: string | null }>(
        '/api/execute/python',
        {
          method: 'POST',
          body: JSON.stringify({
            code: data.code,
            dataset_id: data.dataset_id ?? null,
          }),
        }
      ),

    r: (data: { code: string }) =>
      this.request<any>('/api/execute/r', {
        method: 'POST',
        body: JSON.stringify({ code: data.code }),
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
