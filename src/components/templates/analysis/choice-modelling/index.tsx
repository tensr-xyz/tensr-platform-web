'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription } from '@/components/atoms/alert';
import { Button } from '@/components/atoms/button';
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
import {
  AdvancedOptionsDisclosure,
  FormSectionLabel,
} from '@/components/molecules/analysis-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/molecules/dialog';
import { apiClient } from '@/lib/api-client';
import {
  maxdiffAnalyzeBody,
  rolesFromSavedChoiceBody,
  suggestChoiceRoles,
  type ChoiceRole,
} from '@/lib/choice-roles';
import { useAnalysisSetupStore } from '@/stores/analysis-setup-store';
import { openAnalysisResultTab } from '@/lib/open-analysis-result-tab';
import { getDatasetIdFromTab, WORKSPACE_DATASET_REQUIRED } from '@/lib/workspace-dataset';
import { LINEAGE_HIDDEN_COLUMNS } from '@/lib/adopt-derived-dataset';
import { useTabsStore } from '@/stores/tabs-store';

type Mode = 'cbc' | 'maxdiff';

type Attribute = { name: string; levels: string };

const ROLES: ChoiceRole[] = [
  'ignore',
  'respondent',
  'task',
  'alternative',
  'chosen',
  'best',
  'worst',
  'attribute',
  'price',
  'segment',
];

function downloadText(name: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function useColumns() {
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = useMemo(() => tabs.find(tab => tab.id === activeTabId), [tabs, activeTabId]);
  const datasetId = getDatasetIdFromTab(activeTab);
  const columns = useMemo(() => {
    const initial = activeTab?.data?.initialColumns;
    if (!initial) return [] as string[];
    return initial.map(column => column.id).filter(id => !LINEAGE_HIDDEN_COLUMNS.has(id));
  }, [activeTab?.data?.initialColumns]);
  return { datasetId, columns, tabName: activeTab?.name };
}

export function ChoiceModellingDialog({ children, mode }: { children: ReactNode; mode: Mode }) {
  const { datasetId, columns, tabName } = useColumns();
  const initialBody = useAnalysisSetupStore(state => state.setupInitialBody);
  const [open, setOpen] = useState(false);
  const [savedOp, setSavedOp] = useState<string | undefined>();
  const [savedSets, setSavedSets] = useState<string[]>([]);
  const [pane, setPane] = useState<'design' | 'analyse'>('analyse');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attributes, setAttributes] = useState<Attribute[]>([{ name: '', levels: '' }]);
  const [items, setItems] = useState('Price, Quality, Brand, Speed, Support');
  const [prohibited, setProhibited] = useState('');
  const [method, setMethod] = useState('balanced_overlap');
  const [tasks, setTasks] = useState('8');
  const [alts, setAlts] = useState(mode === 'maxdiff' ? '4' : '3');
  const [versions, setVersions] = useState('1');
  const [noneOption, setNoneOption] = useState(false);
  const [designNote, setDesignNote] = useState('');
  const [csv, setCsv] = useState('');
  const [qualtrics, setQualtrics] = useState('');
  const [roles, setRoles] = useState<Record<string, ChoiceRole>>({});
  const [price, setPrice] = useState('');
  const [segment, setSegment] = useState('');
  const [estimate, setEstimate] = useState<'cbc' | 'mnl' | 'utilities' | 'counting'>(
    mode === 'cbc' ? 'cbc' : 'counting'
  );
  const individual = estimate === 'utilities';
  const [summary, setSummary] = useState('');
  const [layout, setLayout] = useState<'long' | 'wide'>('long');
  const [wideLines, setWideLines] = useState('brand=b1, price=p1\nbrand=b2, price=p2');
  const [designRows, setDesignRows] = useState<Record<string, string>[]>([]);
  const [utilities, setUtilities] = useState<Record<string, number> | null>(null);
  const [products, setProducts] = useState('A: brand=West, price=2\nB: brand=North, price=4');
  const [sensitivity, setSensitivity] = useState('price=2, 3, 4');

  const roleMap = Object.keys(roles).length ? roles : suggestChoiceRoles(columns);

  useEffect(() => {
    if (!open || !initialBody) return;
    const saved = rolesFromSavedChoiceBody(initialBody);
    if (Object.keys(saved.roles).length) setRoles(saved.roles);
    if (saved.items) setItems(saved.items);
    if (saved.savedOp === 'conjoint_hb' || saved.savedOp === 'maxdiff_hb' || saved.individual) {
      setEstimate('utilities');
    } else if (saved.savedOp === 'conjoint_mnl' || saved.savedOp === 'maxdiff_mnl') {
      setEstimate('mnl');
    } else if (saved.savedOp === 'maxdiff_count') {
      setEstimate('counting');
    }
    setSavedOp(saved.savedOp);
    setSavedSets(saved.setColumns);
  }, [open, initialBody]);

  const runDesign = async () => {
    if (!datasetId) throw new Error(WORKSPACE_DATASET_REQUIRED);
    if (mode === 'cbc') {
      const payload = await apiClient.datasets.analyze.run(datasetId, 'cbc_design', {
        attributes: attributes
          .filter(item => item.name.trim())
          .map(item => ({
            name: item.name.trim(),
            levels: item.levels
              .split(',')
              .map(level => level.trim())
              .filter(Boolean),
          })),
        method,
        n_tasks: Number(tasks),
        n_alternatives: Number(alts),
        n_versions: Number(versions),
        none_option: noneOption,
        prohibited: prohibited
          .split('\n')
          .map(line => line.trim())
          .filter(Boolean)
          .map(line =>
            Object.fromEntries(
              line.split(',').map(pair => {
                const [key, value] = pair.split('=').map(part => part.trim());
                return [key, value];
              })
            )
          ),
      });
      const raw = (payload.result || {}) as {
        csv?: string;
        qualtrics_csv?: string;
        d_efficiency?: number;
        d_efficiency_note?: string;
      };
      setCsv(raw.csv || '');
      setQualtrics(raw.qualtrics_csv || '');
      setDesignNote(
        raw.d_efficiency == null
          ? raw.d_efficiency_note || 'D-efficiency was not computed.'
          : `D-efficiency ${raw.d_efficiency}. ${raw.d_efficiency_note || ''}`
      );
      openAnalysisResultTab({
        op: 'cbc_design',
        envelope: payload,
        parameters: { mode: 'cbc' },
        sourceDatasetId: datasetId,
        sourceTabName: tabName,
        activate: false,
      });
      return;
    }
    const payload = await apiClient.datasets.analyze.run(datasetId, 'maxdiff_design', {
      items: items
        .split(',')
        .map(item => item.trim())
        .filter(Boolean),
      n_sets: Number(tasks),
      set_size: Number(alts),
      n_versions: Number(versions),
    });
    const raw = (payload.result || {}) as {
      csv?: string;
      qualtrics_csv?: string;
      design?: string;
      pair_balance?: { exact?: boolean };
    };
    setCsv(raw.csv || '');
    setQualtrics(raw.qualtrics_csv || '');
    setDesignNote(
      raw.pair_balance?.exact
        ? 'Balanced incomplete block: every pair appears equally often.'
        : `Nearly balanced incomplete block (${raw.design || 'design'}).`
    );
    openAnalysisResultTab({
      op: 'maxdiff_design',
      envelope: payload,
      parameters: { mode: 'maxdiff' },
      sourceDatasetId: datasetId,
      sourceTabName: tabName,
      activate: false,
    });
  };

  const runAnalysis = async () => {
    if (!datasetId) throw new Error(WORKSPACE_DATASET_REQUIRED);
    const current = Object.keys(roles).length ? roles : suggestChoiceRoles(columns);
    const named = (role: ChoiceRole) =>
      Object.entries(current).find(([, value]) => value === role)?.[0];
    if (mode === 'maxdiff') {
      if (!named('best') || !named('worst')) throw new Error('Mark the best and worst columns');
      const built = maxdiffAnalyzeBody({
        roles: current,
        columns,
        items: '',
        segment,
        individual,
        savedOp:
          estimate === 'counting'
            ? 'maxdiff_count'
            : estimate === 'utilities'
              ? 'maxdiff_hb'
              : 'maxdiff_mnl',
        savedSetColumns: savedSets,
      });
      const op = built.op;
      const parameters = built.body;
      const payload = await apiClient.datasets.analyze.run(datasetId, op, parameters);
      const raw = (payload.result || {}) as {
        method_note?: string;
        hb_note?: string;
        rank?: string[];
      };
      setSummary(
        raw.hb_note || raw.method_note || `Ranked ${(raw.rank || []).slice(0, 5).join(', ')}`
      );
      openAnalysisResultTab({
        op,
        envelope: payload,
        parameters,
        sourceDatasetId: datasetId,
        sourceTabName: tabName,
        activate: false,
      });
      return;
    }
    const op = individual ? 'conjoint_hb' : 'conjoint_mnl';
    if (op === 'conjoint_hb' && layout === 'wide') {
      throw new Error('Individual utilities need long data, one row per alternative');
    }
    const wideAlternatives =
      layout === 'wide'
        ? wideLines
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .map(line =>
              Object.fromEntries(
                line.split(',').map(pair => {
                  const [key, value] = pair.split('=').map(part => part?.trim() || '');
                  return [key, value];
                })
              )
            )
        : [];
    const attributeColumns =
      layout === 'wide'
        ? Object.keys(wideAlternatives[0] || {})
        : Object.entries(current)
            .filter(([, role]) => role === 'attribute')
            .map(([column]) => column);
    if (!named('chosen') || !named('task') || !attributeColumns.length) {
      throw new Error('Mark chosen, task, and at least one attribute');
    }
    const parameters: Record<string, unknown> =
      op === 'conjoint_hb'
        ? {
            chosen_column: named('chosen'),
            task_column: named('task'),
            respondent_column: named('respondent') || 'respondent',
            attribute_columns: attributeColumns,
          }
        : {
            chosen_column: layout === 'wide' ? 'chosen' : named('chosen'),
            profile_id_column: layout === 'wide' ? 'task_key' : named('task'),
            attribute_columns: attributeColumns,
            price_attribute: price || undefined,
            segment_column: segment || undefined,
            respondent_column: named('respondent'),
            wide_map: wideAlternatives.length
              ? {
                  respondent: named('respondent'),
                  task: named('task'),
                  chosen: named('chosen'),
                  alternatives: wideAlternatives,
                }
              : undefined,
            design_rows: designRows.length ? designRows : undefined,
            join_on: designRows.length ? ['version', 'task', 'alternative'] : undefined,
          };
    const payload = await apiClient.datasets.analyze.run(datasetId, op, parameters);
    const raw = (payload.result || {}) as {
      method_note?: string;
      hb_note?: string;
      utilities?: Record<string, number>;
      attribute_importance?: { attribute: string; importance: number }[];
    };
    if (raw.utilities) setUtilities(raw.utilities);
    const importance = (raw.attribute_importance || [])
      .map(item => `${item.attribute} ${Number(item.importance).toFixed(1)}%`)
      .join(', ');
    setSummary(raw.hb_note || raw.method_note || importance);
    openAnalysisResultTab({
      op,
      envelope: payload,
      parameters,
      sourceDatasetId: datasetId,
      sourceTabName: tabName,
      activate: false,
    });
  };

  const runSimulator = async () => {
    if (!datasetId) throw new Error(WORKSPACE_DATASET_REQUIRED);
    if (!utilities) throw new Error('Run the conjoint first');
    const profiles = products
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const [name, rest] = line.split(':');
        const levels = Object.fromEntries(
          (rest || '')
            .split(',')
            .map(pair => pair.trim())
            .filter(Boolean)
            .map(pair => {
              const [key, value] = pair.split('=').map(part => part.trim());
              return [key, value];
            })
        );
        return { name: (name || 'Product').trim(), levels };
      });
    const [attribute, levelList] = sensitivity.split('=');
    const parameters = {
      utilities,
      profiles,
      sensitivity: {
        attribute: attribute.trim(),
        levels: (levelList || '')
          .split(',')
          .map(level => level.trim())
          .filter(Boolean),
        product_index: 0,
      },
    };
    const payload = await apiClient.datasets.analyze.run(datasetId, 'choice_simulator', parameters);
    const raw = (payload.result || {}) as { names?: string[]; shares?: number[] };
    const line = (raw.names || [])
      .map((name, index) => `${name} ${(((raw.shares || [])[index] || 0) * 100).toFixed(1)}%`)
      .join(', ');
    setSummary(line || 'Simulator returned no shares');
    openAnalysisResultTab({
      op: 'choice_simulator',
      envelope: payload,
      parameters,
      sourceDatasetId: datasetId,
      sourceTabName: tabName,
      activate: false,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{mode === 'cbc' ? 'Conjoint' : 'MaxDiff'}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={pane === 'design' ? 'default' : 'outline'}
            onClick={() => setPane('design')}
          >
            Design
          </Button>
          <Button
            type="button"
            variant={pane === 'analyse' ? 'default' : 'outline'}
            onClick={() => setPane('analyse')}
          >
            Analyse
          </Button>
        </div>
        {pane === 'design' ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Export a long CSV and a Qualtrics-wide CSV. Tensr does not host the survey.
            </p>
            {mode === 'cbc' ? (
              <>
                {attributes.map((attribute, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={attribute.name}
                      placeholder="Attribute"
                      onChange={event =>
                        setAttributes(current =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, name: event.target.value } : item
                          )
                        )
                      }
                    />
                    <Input
                      value={attribute.levels}
                      placeholder="Levels, comma separated"
                      onChange={event =>
                        setAttributes(current =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, levels: event.target.value } : item
                          )
                        )
                      }
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAttributes(current => [...current, { name: '', levels: '' }])}
                >
                  Add attribute
                </Button>
                <Label>Prohibited combinations, one per line as brand=West, price=4</Label>
                <textarea
                  className="border-input bg-background min-h-16 w-full rounded-md border px-3 py-2 text-sm"
                  value={prohibited}
                  onChange={event => setProhibited(event.target.value)}
                />
                <Label>Method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="balanced_overlap">Balanced overlap</SelectItem>
                    <SelectItem value="random">Random</SelectItem>
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={noneOption}
                    onCheckedChange={value => setNoneOption(value === true)}
                  />
                  None option
                </label>
              </>
            ) : (
              <>
                <Label>Items, comma separated</Label>
                <Input value={items} onChange={event => setItems(event.target.value)} />
              </>
            )}
            <div className="flex gap-2">
              <Label className="flex-1">
                Tasks
                <Input value={tasks} onChange={event => setTasks(event.target.value)} />
              </Label>
              <Label className="flex-1">
                Alternatives
                <Input value={alts} onChange={event => setAlts(event.target.value)} />
              </Label>
              <Label className="flex-1">
                Versions
                <Input value={versions} onChange={event => setVersions(event.target.value)} />
              </Label>
            </div>
            {designNote ? <p className="text-xs text-muted-foreground">{designNote}</p> : null}
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              {mode === 'cbc'
                ? 'Long choice data: mark respondent, task, and chosen. Attribute columns are the levels. Wide files list each alternative as brand=column, price=column. A design CSV joins on version, task, and alternative.'
                : 'Mark the best and worst columns. Set columns are the alternatives shown together. Item codes are read from those columns.'}
            </p>
            <FormSectionLabel>Required</FormSectionLabel>
            <Label>
              Method
              <Select
                value={estimate}
                onValueChange={value =>
                  setEstimate(value as 'cbc' | 'mnl' | 'utilities' | 'counting')
                }
              >
                <SelectTrigger className="mt-1 w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mode === 'cbc' ? (
                    <>
                      <SelectItem value="cbc">CBC</SelectItem>
                      <SelectItem value="mnl">MNL</SelectItem>
                      <SelectItem value="utilities">Individual utilities</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="counting">Counting</SelectItem>
                      <SelectItem value="mnl">MNL</SelectItem>
                      <SelectItem value="utilities">Individual utilities</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </Label>
            <ul className="max-h-48 space-y-1 overflow-auto">
              {columns.map(column => (
                <li key={column} className="flex items-center gap-2">
                  <span className="w-40 truncate">{column}</span>
                  <Select
                    value={roleMap[column] || 'attribute'}
                    onValueChange={value =>
                      setRoles(current => ({
                        ...(Object.keys(current).length ? current : roleMap),
                        [column]: value as ChoiceRole,
                      }))
                    }
                  >
                    <SelectTrigger className="h-7 w-36 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map(role => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </li>
              ))}
            </ul>
            <p className="rounded-md bg-muted/60 px-2.5 py-1.5 text-[11px] leading-snug text-muted-foreground">
              <span className="font-medium text-foreground">Defaults. </span>
              {mode === 'cbc' ? `method ${estimate}, layout ${layout}` : `method ${estimate}`}
            </p>
            <AdvancedOptionsDisclosure>
            {mode === 'cbc' ? (
              <Select value={layout} onValueChange={value => setLayout(value as 'long' | 'wide')}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="long">Long format</SelectItem>
                  <SelectItem value="wide">Wide format</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
            {mode === 'cbc' && layout === 'wide' ? (
              <Label>
                Alternatives, one per line
                <textarea
                  className="border-input bg-background min-h-16 w-full rounded-md border px-3 py-2 text-sm"
                  value={wideLines}
                  onChange={event => setWideLines(event.target.value)}
                />
              </Label>
            ) : null}
            {mode === 'cbc' ? (
              <Label>
                Design file to join
                <Input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    void file.text().then(text => {
                      const [header, ...lines] = text.trim().split(/\r?\n/);
                      const names = header.split(',').map(name => name.trim());
                      setDesignRows(
                        lines.filter(Boolean).map(line => {
                          const cells = line.split(',');
                          return Object.fromEntries(
                            names.map((name, index) => [name, (cells[index] || '').trim()])
                          );
                        })
                      );
                    });
                  }}
                />
              </Label>
            ) : null}
            {mode === 'cbc' ? (
              <Label>
                Price attribute for willingness to pay
                <Select
                  value={price || '__none__'}
                  onValueChange={value => setPrice(value === '__none__' ? '' : value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {columns.map(column => (
                      <SelectItem key={column} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>
            ) : null}
            <Label>
              Segment by
              <Select
                value={segment || '__none__'}
                onValueChange={value => setSegment(value === '__none__' ? '' : value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {columns.map(column => (
                    <SelectItem key={column} value={column}>
                      {column}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
            </AdvancedOptionsDisclosure>
            <FormSectionLabel>Report output</FormSectionLabel>
            <p className="text-xs text-muted-foreground">
              APA tables and charts follow the workspace report settings.
            </p>
            {mode === 'cbc' && utilities ? (
              <div className="space-y-2">
                <Label>
                  Products, one per line as Name: brand=West, price=2
                  <textarea
                    className="border-input bg-background min-h-16 w-full rounded-md border px-3 py-2 text-sm"
                    value={products}
                    onChange={event => setProducts(event.target.value)}
                  />
                </Label>
                <Label>
                  Sensitivity on the first product
                  <Input
                    value={sensitivity}
                    onChange={event => setSensitivity(event.target.value)}
                  />
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void runSimulator().catch(err =>
                      setError(err instanceof Error ? err.message : 'Simulator failed')
                    )
                  }
                >
                  Share of preference
                </Button>
              </div>
            ) : null}
            {summary ? <p className="text-xs text-muted-foreground">{summary}</p> : null}
          </div>
        )}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          {csv ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadText(`${mode}-design.csv`, csv)}
            >
              Download long CSV
            </Button>
          ) : null}
          {qualtrics ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadText(`${mode}-qualtrics.csv`, qualtrics)}
            >
              Download Qualtrics CSV
            </Button>
          ) : null}
          <Button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              void (pane === 'design' ? runDesign() : runAnalysis())
                .catch(err => setError(err instanceof Error ? err.message : 'Choice model failed'))
                .finally(() => setBusy(false));
            }}
          >
            {pane === 'design' ? 'Generate design' : 'Run'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
