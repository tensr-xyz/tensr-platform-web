import { Button } from '@/components/atoms/button';
import { Alert, AlertDescription } from '@/components/atoms/alert';
import { Checkbox } from '@/components/atoms/checkbox';
import { Input } from '@/components/atoms/input';
import { Label } from '@/components/atoms/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/molecules/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/molecules/dialog';
import { useState } from 'react';
import { useTabsStore } from '@/stores/tabs-store';
import { useToast } from '@/hooks/ui/use-toast';
import { getNumericColumns } from '@/utils/data-utils';
import { apiClient } from '@/lib/api-client';

interface ClusteringProps {
  children: React.ReactNode;
}

interface ClusteringRequest {
  data: number[][];
  variables: string[];
  method: 'kmeans' | 'hierarchical' | 'dbscan';
  parameters: {
    k?: number;
    max_iterations?: number;
    tolerance?: number;
    linkage?: string;
    distance_metric?: string;
    n_clusters?: number;
    eps?: number;
    min_samples?: number;
  };
  options: {
    standardize: boolean;
    random_seed?: number;
    elbow_method?: boolean;
    dendrogram?: boolean;
    cluster_profiles?: boolean;
    auto_eps?: boolean;
    outlier_detection?: boolean;
  };
}

export const Clustering = ({ children }: ClusteringProps): React.JSX.Element => {
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = tabs.find(tab => tab.id === activeTabId);
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [activeMethod, setActiveMethod] = useState<'kmeans' | 'hierarchical' | 'dbscan'>('kmeans');

  const [formData, setFormData] = useState<ClusteringRequest>({
    data: [],
    variables: [],
    method: 'kmeans',
    parameters: {
      k: 3,
      max_iterations: 300,
      tolerance: 0.0001,
      linkage: 'ward',
      distance_metric: 'euclidean',
      n_clusters: 3,
      eps: 0.5,
      min_samples: 5,
    },
    options: {
      standardize: true,
      random_seed: undefined,
      elbow_method: false,
      dendrogram: false,
      cluster_profiles: false,
      auto_eps: false,
      outlier_detection: false,
    },
  });

  const handleRunAnalysis = async () => {
    if (!activeTab?.data?.initialData || !activeTab?.data?.initialColumns) {
      toast({
        title: 'Error',
        description: 'No data available for analysis',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      // Ensure data is defined after the guard
      const data = activeTab.data;
      if (!data.initialData || !data.initialColumns) {
        toast({
          title: 'Error',
          description: 'Data structure is invalid',
          variant: 'destructive',
        });
        return;
      }

      // Prepare data for analysis
      const numericColumns = getNumericColumns(data.initialColumns, data.initialData);

      if (numericColumns.length === 0) {
        toast({
          title: 'Error',
          description: 'No numeric columns found for clustering',
          variant: 'destructive',
        });
        return;
      }

      // Extract numeric data
      const numericData = numericColumns.map((col: any) =>
        (data.initialData as any[])
          .map((row: any) => {
            const value = parseFloat(row[col.id]);
            return isNaN(value) ? null : value;
          })
          .filter((val: any) => val !== null)
      );

      const requestData = {
        ...formData,
        data: numericData,
        variables: numericColumns.map((col: any) => col.header),
        method: activeMethod,
      };

      let result;
      switch (activeMethod) {
        case 'kmeans':
          result = await apiClient.analysis.kmeans({
            data: numericData,
            k: formData.parameters.k || 3,
            max_iterations: formData.parameters.max_iterations || 300,
            tolerance: formData.parameters.tolerance || 0.0001,
          });
          break;
        case 'hierarchical':
          result = await apiClient.analysis.hierarchicalClustering({
            data: numericData,
            linkage: formData.parameters.linkage || 'ward',
            distance_metric: formData.parameters.distance_metric || 'euclidean',
            n_clusters: formData.parameters.n_clusters || 3,
          });
          break;
        case 'dbscan':
          result = await apiClient.analysis.dbscan({
            data: numericData,
            eps: formData.parameters.eps || 0.5,
            min_samples: formData.parameters.min_samples || 5,
          });
          break;
        default:
          throw new Error('Invalid clustering method');
      }

      setResults(result);
      toast({
        title: 'Success',
        description: `${activeMethod.toUpperCase()} clustering completed successfully!`,
      });
    } catch (error) {
      console.error('Clustering error:', error);
      toast({
        title: 'Error',
        description: 'Clustering failed. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleParameterChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [field]: value,
      },
    }));
  };

  const handleOptionChange = (field: string, value: boolean) => {
    setFormData(prev => ({
      ...prev,
      options: {
        ...prev.options,
        [field]: value,
      },
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {children}
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Cluster Analysis</DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeMethod}
          onValueChange={value => setActiveMethod(value as any)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="kmeans">K-Means</TabsTrigger>
            <TabsTrigger value="hierarchical">Hierarchical</TabsTrigger>
            <TabsTrigger value="dbscan">DBSCAN</TabsTrigger>
          </TabsList>

          <TabsContent value="kmeans" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="variables">Variables</Label>
                <div className="text-sm text-muted-foreground mb-2">
                  {
                    getNumericColumns(
                      activeTab?.data?.initialColumns || [],
                      activeTab?.data?.initialData || []
                    ).length
                  }{' '}
                  numeric variables available
                </div>
                <Select disabled>
                  <SelectTrigger>
                    <SelectValue placeholder="All numeric variables will be used" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Numeric Variables</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="k">Number of Clusters (K)</Label>
                <Input
                  id="k"
                  type="number"
                  min="2"
                  max="20"
                  value={formData.parameters.k}
                  onChange={e => handleParameterChange('k', parseInt(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="max_iterations">Maximum Iterations</Label>
                <Input
                  id="max_iterations"
                  type="number"
                  min="100"
                  max="1000"
                  value={formData.parameters.max_iterations}
                  onChange={e => handleParameterChange('max_iterations', parseInt(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="tolerance">Convergence Tolerance</Label>
                <Input
                  id="tolerance"
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={formData.parameters.tolerance}
                  onChange={e => handleParameterChange('tolerance', parseFloat(e.target.value))}
                />
              </div>
            </div>

            <div>
              <Label>Options</Label>
              <div className="space-y-2 mt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="standardize"
                    checked={formData.options.standardize}
                    onCheckedChange={checked =>
                      handleOptionChange('standardize', checked as boolean)
                    }
                  />
                  <Label htmlFor="standardize">Standardize Variables</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="random_seed"
                    checked={!!formData.options.random_seed}
                    onCheckedChange={checked =>
                      handleOptionChange('random_seed', checked as boolean)
                    }
                  />
                  <Label htmlFor="random_seed">Set Random Seed</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="elbow_method"
                    checked={formData.options.elbow_method}
                    onCheckedChange={checked =>
                      handleOptionChange('elbow_method', checked as boolean)
                    }
                  />
                  <Label htmlFor="elbow_method">Elbow Method for K Selection</Label>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="hierarchical" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="linkage">Linkage Method</Label>
                <Select
                  value={formData.parameters.linkage}
                  onValueChange={value => handleParameterChange('linkage', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ward">Ward</SelectItem>
                    <SelectItem value="complete">Complete</SelectItem>
                    <SelectItem value="average">Average</SelectItem>
                    <SelectItem value="single">Single</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="distance">Distance Metric</Label>
                <Select
                  value={formData.parameters.distance_metric}
                  onValueChange={value => handleParameterChange('distance_metric', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="euclidean">Euclidean</SelectItem>
                    <SelectItem value="manhattan">Manhattan</SelectItem>
                    <SelectItem value="cosine">Cosine</SelectItem>
                    <SelectItem value="correlation">Correlation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="n_clusters">Number of Clusters</Label>
              <Input
                id="n_clusters"
                type="number"
                min="2"
                max="20"
                value={formData.parameters.n_clusters}
                onChange={e => handleParameterChange('n_clusters', parseInt(e.target.value))}
              />
            </div>

            <div>
              <Label>Output Options</Label>
              <div className="space-y-2 mt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="dendrogram"
                    checked={formData.options.dendrogram}
                    onCheckedChange={checked =>
                      handleOptionChange('dendrogram', checked as boolean)
                    }
                  />
                  <Label htmlFor="dendrogram">Dendrogram</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="cluster_profiles"
                    checked={formData.options.cluster_profiles}
                    onCheckedChange={checked =>
                      handleOptionChange('cluster_profiles', checked as boolean)
                    }
                  />
                  <Label htmlFor="cluster_profiles">Cluster Profiles</Label>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="dbscan" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="eps">Epsilon (ε)</Label>
                <Input
                  id="eps"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={formData.parameters.eps}
                  onChange={e => handleParameterChange('eps', parseFloat(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="min_samples">Minimum Samples</Label>
                <Input
                  id="min_samples"
                  type="number"
                  min="2"
                  value={formData.parameters.min_samples}
                  onChange={e => handleParameterChange('min_samples', parseInt(e.target.value))}
                />
              </div>
            </div>

            <div>
              <Label>DBSCAN Options</Label>
              <div className="space-y-2 mt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="auto_eps"
                    checked={formData.options.auto_eps}
                    onCheckedChange={checked => handleOptionChange('auto_eps', checked as boolean)}
                  />
                  <Label htmlFor="auto_eps">Auto-estimate Epsilon</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="outlier_detection"
                    checked={formData.options.outlier_detection}
                    onCheckedChange={checked =>
                      handleOptionChange('outlier_detection', checked as boolean)
                    }
                  />
                  <Label htmlFor="outlier_detection">Outlier Detection</Label>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {results && (
          <div className="border rounded-lg p-4 bg-muted/50">
            <h3 className="font-semibold mb-2">Clustering Results</h3>
            <pre className="text-sm overflow-auto max-h-40">{JSON.stringify(results, null, 2)}</pre>
          </div>
        )}

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleRunAnalysis} disabled={isLoading}>
            {isLoading ? 'Running Clustering...' : 'Run Clustering Analysis'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
