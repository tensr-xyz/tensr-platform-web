import { ReactNode, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/molecules/dialog';
import { Button } from '@/components/atoms/button';
import { Loader } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/atoms/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/molecules/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/card';
import { useTabsStore } from '@/stores/tabs-store';
import { adaptLogisticRegressionResults, runDatasetAnalysis } from '@/lib/workspace-analysis';
import { getDatasetIdFromTab, WORKSPACE_DATASET_REQUIRED } from '@/lib/workspace-dataset';

/** Logistic regression dialog — same variable picker as OLS, different API op. */
export const LogisticRegression = ({ children }: { children: ReactNode }) => {
  const { tabs, activeTabId } = useTabsStore();
  const [dependentVariable, setDependentVariable] = useState('');
  const [independentVariables, setIndependentVariables] = useState<string[]>([]);
  const [results, setResults] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('setup');

  const activeDataTab = useMemo(
    () => tabs.find(tab => tab.id === activeTabId),
    [tabs, activeTabId]
  );

  const variables = useMemo(() => {
    if (!activeDataTab?.data?.initialData?.[0]) return [];
    return Object.keys(activeDataTab.data.initialData[0])
      .filter(key => key !== 'id')
      .map(colName => {
        const sampleValues = activeDataTab
          .data!.initialData!.slice(0, 5)
          .map((row: Record<string, unknown>) => row[colName])
          .filter(val => val != null && val !== '');
        const numericValues = sampleValues.map(val => parseFloat(String(val)));
        const isNumeric = numericValues.every(val => !isNaN(val));
        return { name: colName, type: isNumeric ? 'number' : 'string' };
      });
  }, [activeDataTab?.data?.initialData]);

  const allVariables = variables;
  const numericIndependents = variables.filter(
    v => v.type === 'number' && v.name !== dependentVariable
  );

  const runAnalysis = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const datasetId = getDatasetIdFromTab(activeDataTab);
      if (!datasetId) throw new Error(WORKSPACE_DATASET_REQUIRED);
      const envelope = await runDatasetAnalysis(datasetId, 'logistic_regression', {
        dependent: dependentVariable,
        independents: independentVariables,
      });
      setResults(adaptLogisticRegressionResults(envelope));
      setActiveTab('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog>
      {children}
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Logistic Regression</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Dependent variable must be binary (two categories or 0/1).
        </p>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="setup">Setup</TabsTrigger>
            <TabsTrigger value="results" disabled={!results}>
              Results
            </TabsTrigger>
          </TabsList>
          <TabsContent value="setup" className="grid grid-cols-2 gap-4">
            <VariablePicker
              title="Dependent (binary)"
              items={allVariables}
              selected={dependentVariable ? [dependentVariable] : []}
              multi={false}
              onSelect={name => setDependentVariable(name)}
            />
            <VariablePicker
              title="Predictors (numeric)"
              items={numericIndependents}
              selected={independentVariables}
              multi
              onSelect={name =>
                setIndependentVariables(prev =>
                  prev.includes(name) ? prev.filter(v => v !== name) : [...prev, name]
                )
              }
            />
            {error && (
              <Alert variant="destructive" className="col-span-2">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </TabsContent>
          <TabsContent value="results">
            {results && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Model fit</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p>Pseudo R²: {String(results.pseudo_r_squared ?? '—')}</p>
                  <p>N: {String(results.n_observations ?? '—')}</p>
                  {results.interpretation ? (
                    <p className="text-muted-foreground pt-2">{String(results.interpretation)}</p>
                  ) : null}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button
            onClick={runAnalysis}
            disabled={isLoading || !dependentVariable || independentVariables.length === 0}
          >
            {isLoading ? <Loader className="h-4 w-4 animate-spin mr-2" /> : null}
            Run analysis
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function VariablePicker({
  title,
  items,
  selected,
  multi,
  onSelect,
}: {
  title: string;
  items: { name: string }[];
  selected: string[];
  multi: boolean;
  onSelect: (name: string) => void;
}) {
  return (
    <div className="border border-border rounded-lg p-4">
      <h3 className="font-medium mb-2">{title}</h3>
      <div className="max-h-48 overflow-y-auto">
        {items.map(v => (
          <div
            key={v.name}
            onClick={() => onSelect(v.name)}
            className={`p-2 cursor-pointer rounded ${
              selected.includes(v.name) ? 'bg-primary/10' : 'hover:bg-muted'
            }`}
          >
            {v.name}
          </div>
        ))}
      </div>
    </div>
  );
}
