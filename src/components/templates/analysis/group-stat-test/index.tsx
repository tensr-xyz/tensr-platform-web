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
import { adaptGenericTestResults, runDatasetAnalysis } from '@/lib/workspace-analysis';
import { getDatasetIdFromTab, WORKSPACE_DATASET_REQUIRED } from '@/lib/workspace-dataset';

export type GroupStatTestConfig = {
  op: string;
  title: string;
  mode: 'two_group' | 'paired' | 'multi_group';
  statisticKey: string;
  statisticLabel: string;
};

type Variable = { name: string; type: string };

function useWorkspaceVariables() {
  const { tabs, activeTabId } = useTabsStore();
  const activeDataTab = useMemo(
    () => tabs.find(tab => tab.id === activeTabId),
    [tabs, activeTabId]
  );

  const variables = useMemo((): Variable[] => {
    if (!activeDataTab?.data?.initialData?.[0]) return [];
    const columnNames = Object.keys(activeDataTab.data.initialData[0]).filter(key => key !== 'id');
    return columnNames.map(colName => {
      const sampleValues = activeDataTab
        .data!.initialData!.slice(0, 5)
        .map((row: Record<string, unknown>) => row[colName])
        .filter(val => val != null && val !== '');
      const numericValues = sampleValues.map(val => parseFloat(String(val)));
      const isNumeric = numericValues.every(val => !isNaN(val));
      return { name: colName, type: isNumeric ? 'number' : 'string' };
    });
  }, [activeDataTab?.data?.initialData]);

  return { activeDataTab, variables };
}

export function createGroupStatTest(config: GroupStatTestConfig) {
  return function GroupStatTest({ children }: { children: ReactNode }) {
    const { activeDataTab, variables } = useWorkspaceVariables();
    const [groupColumn, setGroupColumn] = useState('');
    const [valueColumn, setValueColumn] = useState('');
    const [beforeColumn, setBeforeColumn] = useState('');
    const [afterColumn, setAfterColumn] = useState('');
    const [results, setResults] = useState<Record<string, unknown> | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('setup');

    const numericVariables = variables.filter(v => v.type === 'number');
    const categoricalVariables = variables.filter(v => v.type === 'string');

    const runTest = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const datasetId = getDatasetIdFromTab(activeDataTab);
        if (!datasetId) {
          throw new Error(WORKSPACE_DATASET_REQUIRED);
        }

        let body: Record<string, unknown>;
        if (config.mode === 'paired') {
          if (!beforeColumn || !afterColumn) {
            throw new Error('Select both before and after variables.');
          }
          body = { before_column: beforeColumn, after_column: afterColumn };
        } else {
          if (!groupColumn || !valueColumn) {
            throw new Error('Select both a grouping variable and a test variable.');
          }
          body = { group_column: groupColumn, value_column: valueColumn };
        }

        const envelope = await runDatasetAnalysis(datasetId, config.op, body);
        setResults(adaptGenericTestResults(envelope));
        setActiveTab('results');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Analysis failed');
      } finally {
        setIsLoading(false);
      }
    };

    const ready =
      config.mode === 'paired'
        ? Boolean(beforeColumn && afterColumn)
        : Boolean(groupColumn && valueColumn);

    return (
      <Dialog>
        {children}
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{config.title}</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="setup">Setup</TabsTrigger>
              <TabsTrigger value="results" disabled={!results}>
                Results
              </TabsTrigger>
            </TabsList>

            <TabsContent value="setup" className="space-y-4">
              {config.mode === 'paired' ? (
                <PairSelectors
                  numericVariables={numericVariables}
                  beforeColumn={beforeColumn}
                  afterColumn={afterColumn}
                  onBefore={setBeforeColumn}
                  onAfter={setAfterColumn}
                />
              ) : (
                <GroupSelectors
                  categoricalVariables={categoricalVariables}
                  numericVariables={numericVariables}
                  groupColumn={groupColumn}
                  valueColumn={valueColumn}
                  onGroup={setGroupColumn}
                  onValue={setValueColumn}
                  groupLabel={
                    config.mode === 'two_group'
                      ? 'Grouping variable (exactly 2 groups)'
                      : 'Grouping variable (2+ groups)'
                  }
                />
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="results">
              {results && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Test statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <ResultRow label={config.statisticLabel} value={results[config.statisticKey]} />
                    <ResultRow label="p-value" value={results.p_value} />
                    {'mean_difference' in results && (
                      <ResultRow label="Mean difference" value={results.mean_difference} />
                    )}
                    {'cohens_d' in results && (
                      <ResultRow label="Cohen's d" value={results.cohens_d} />
                    )}
                    {'cohens_dz' in results && (
                      <ResultRow label="Cohen's dz" value={results.cohens_dz} />
                    )}
                    {'group_names' in results && Array.isArray(results.group_names) && (
                      <ResultRow
                        label="Groups"
                        value={(results.group_names as string[]).join(', ')}
                      />
                    )}
                    {results.interpretation ? (
                      <p className="pt-2 text-muted-foreground">{String(results.interpretation)}</p>
                    ) : null}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button onClick={runTest} disabled={isLoading || !ready}>
              {isLoading ? <Loader className="h-4 w-4 animate-spin mr-2" /> : null}
              Run analysis
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };
}

function ResultRow({ label, value }: { label: string; value: unknown }) {
  if (value === undefined || value === null) return null;
  const formatted =
    typeof value === 'number' && Number.isFinite(value) ? value.toFixed(4) : String(value);
  return (
    <div className="flex justify-between gap-4 border-b border-border py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{formatted}</span>
    </div>
  );
}

function PairSelectors(props: {
  numericVariables: Variable[];
  beforeColumn: string;
  afterColumn: string;
  onBefore: (v: string) => void;
  onAfter: (v: string) => void;
}) {
  return (
    <GroupSelectors
      categoricalVariables={[]}
      numericVariables={props.numericVariables}
      groupColumn={props.beforeColumn}
      valueColumn={props.afterColumn}
      onGroup={props.onBefore}
      onValue={props.onAfter}
      groupLabel="Before variable"
      valueLabel="After variable"
    />
  );
}

function GroupSelectors({
  categoricalVariables,
  numericVariables,
  groupColumn,
  valueColumn,
  onGroup,
  onValue,
  groupLabel = 'Grouping variable',
  valueLabel = 'Test variable',
}: {
  categoricalVariables: Variable[];
  numericVariables: Variable[];
  groupColumn: string;
  valueColumn: string;
  onGroup: (v: string) => void;
  onValue: (v: string) => void;
  groupLabel?: string;
  valueLabel?: string;
}) {
  const groupOptions = categoricalVariables.length > 0 ? categoricalVariables : numericVariables;

  return (
    <div className="grid grid-cols-2 gap-4">
      <VariableList
        title={groupLabel}
        variables={groupOptions}
        selected={groupColumn}
        onSelect={onGroup}
      />
      <VariableList
        title={valueLabel}
        variables={numericVariables}
        selected={valueColumn}
        onSelect={onValue}
      />
    </div>
  );
}

function VariableList({
  title,
  variables,
  selected,
  onSelect,
}: {
  title: string;
  variables: Variable[];
  selected: string;
  onSelect: (name: string) => void;
}) {
  return (
    <div className="border border-border rounded-lg p-4">
      <h3 className="font-medium mb-2">{title}</h3>
      <div className="max-h-60 overflow-y-auto">
        {variables.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No variables available</p>
        ) : (
          variables.map(v => (
            <div
              key={v.name}
              onClick={() => onSelect(v.name)}
              className={`p-2 cursor-pointer rounded ${
                selected === v.name ? 'bg-primary/10' : 'hover:bg-muted'
              }`}
            >
              {v.name}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export const IndependentTTest = createGroupStatTest({
  op: 'ttest_independent',
  title: 'Independent Samples T-Test',
  mode: 'two_group',
  statisticKey: 't_statistic',
  statisticLabel: 't statistic',
});

export const PairedTTest = createGroupStatTest({
  op: 'ttest_paired',
  title: 'Paired Samples T-Test',
  mode: 'paired',
  statisticKey: 't_statistic',
  statisticLabel: 't statistic',
});

export const MannWhitneyU = createGroupStatTest({
  op: 'mann_whitney_u',
  title: 'Mann-Whitney U Test',
  mode: 'two_group',
  statisticKey: 'u_statistic',
  statisticLabel: 'U statistic',
});

export const KruskalWallis = createGroupStatTest({
  op: 'kruskal_wallis',
  title: 'Kruskal-Wallis H Test',
  mode: 'multi_group',
  statisticKey: 'h_statistic',
  statisticLabel: 'H statistic',
});
