import { ReactNode, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/molecules/dialog';
import { Alert, AlertDescription } from '@/components/atoms/alert';
import { Button } from '@/components/atoms/button';
import { Label } from '@/components/atoms/label';
import { getAccessToken } from '@/utils/auth';
import { datasetRequest } from '@/lib/dataset-data-ops';
import { tensrApiUrl } from '@/lib/tensr-api-url';
import { formatApiErrorMessage } from '@/lib/api-error';
import { getDatasetIdFromTab, WORKSPACE_DATASET_REQUIRED } from '@/lib/workspace-dataset';
import { useTabsStore } from '@/stores/tabs-store';

type BookRow = { id: string; name: string; n_specs: number };
type MatchRow = { from?: string; to?: string; reason?: string };
type RunResult = {
  tables_run?: number;
  tables_skipped?: number;
  tables?: Array<{ ok?: boolean; label?: string; missing?: string[]; error?: string }>;
  match?: { matched?: MatchRow[]; renamed?: MatchRow[]; missing?: MatchRow[] };
};

export function BannerBookDialog({ children }: { children: ReactNode }) {
  const token = getAccessToken();
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = useMemo(() => tabs.find(tab => tab.id === activeTabId), [tabs, activeTabId]);
  const datasetId = getDatasetIdFromTab(activeTab);
  const otherDatasets = useMemo(
    () =>
      tabs
        .map(tab => ({ id: getDatasetIdFromTab(tab), name: tab.name }))
        .filter((item): item is { id: string; name: string } =>
          Boolean(item.id && item.id !== datasetId)
        ),
    [tabs, datasetId]
  );
  const [books, setBooks] = useState<BookRow[]>([]);
  const [bookId, setBookId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [pastedId, setPastedId] = useState('');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!datasetId) return;
    try {
      const payload = await datasetRequest<{ books: BookRow[] }>(
        `/datasets/${datasetId}/banner-books`,
        token
      );
      setBooks(payload.books || []);
      setBookId(current => current || payload.books?.[0]?.id || '');
    } catch (err) {
      setError(formatApiErrorMessage(err));
    }
  };

  const run = async () => {
    if (!datasetId) {
      setError(WORKSPACE_DATASET_REQUIRED);
      return;
    }
    const resolvedTarget = pastedId.trim() || targetId;
    if (!bookId || !resolvedTarget) {
      setError('Choose a book and the dataset to run it on.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = await datasetRequest<RunResult>(
        `/datasets/${datasetId}/banner-books/${bookId}/run`,
        token,
        { method: 'POST', body: { target_dataset_id: resolvedTarget, mapping } }
      );
      setResult(payload);
    } catch (err) {
      setError(formatApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    const resolvedTarget = pastedId.trim() || targetId;
    if (!datasetId || !bookId || !resolvedTarget) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        tensrApiUrl(`/datasets/${datasetId}/banner-books/${bookId}/export.xlsx`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ target_dataset_id: resolvedTarget, mapping }),
        }
      );
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'banner-book.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(formatApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const missing = result?.match?.missing || [];

  return (
    <Dialog onOpenChange={open => open && void load()}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Banner book</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Run a saved table set on another wave. Names match automatically. Map a rename when a
          variable moved, then export the whole book.
        </p>
        <div className="space-y-2 text-sm">
          <Label htmlFor="banner-book-id">Book</Label>
          <select
            id="banner-book-id"
            className="h-8 w-full rounded-md border bg-background px-2"
            value={bookId}
            onChange={e => setBookId(e.target.value)}
          >
            <option value="">Select a book</option>
            {books.map(book => (
              <option key={book.id} value={book.id}>
                {book.name} ({book.n_specs})
              </option>
            ))}
          </select>
          <Label htmlFor="banner-book-target">Target dataset</Label>
          <select
            id="banner-book-target"
            className="h-8 w-full rounded-md border bg-background px-2"
            value={pastedId.trim() ? '' : targetId}
            onChange={e => {
              setTargetId(e.target.value);
              setPastedId('');
            }}
          >
            <option value="">Select a dataset</option>
            {otherDatasets.map(item => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <label htmlFor="banner-book-pasted" className="sr-only">
            Dataset id
          </label>
          <input
            id="banner-book-pasted"
            className="h-8 w-full rounded-md border px-2"
            placeholder="Or paste a dataset id"
            value={pastedId}
            onChange={e => setPastedId(e.target.value)}
          />
        </div>
        {missing.length ? (
          <div className="space-y-2 text-xs">
            <p className="font-medium">
              These names did not match. Map them or leave them unmatched.
            </p>
            {missing.map(row => (
              <label key={row.from} className="flex items-center gap-2">
                <span className="w-28 truncate">{row.from}</span>
                <input
                  className="h-7 flex-1 rounded-md border px-2"
                  placeholder="Name on the new file"
                  value={mapping[row.from || ''] || ''}
                  onChange={e =>
                    setMapping(current => ({ ...current, [row.from || '']: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>
        ) : null}
        {result ? (
          <p className="text-xs text-muted-foreground">
            Ran {result.tables_run ?? 0}. Skipped {result.tables_skipped ?? 0}. Matched{' '}
            {result.match?.matched?.length ?? 0} by name, renamed{' '}
            {result.match?.renamed?.length ?? 0}, missing {result.match?.missing?.length ?? 0}.
            Weights, filters, and nets stay on each spec.
          </p>
        ) : null}
        {result?.tables?.length ? (
          <ul className="max-h-40 space-y-1 overflow-y-auto text-xs" aria-label="Book tables">
            {result.tables.map((table, index) => (
              <li key={`${table.label}-${index}`} className="flex justify-between gap-2">
                <span className="truncate">{table.label || `Table ${index + 1}`}</span>
                <span className={table.ok ? 'text-muted-foreground' : 'text-destructive'}>
                  {table.ok
                    ? 'Ran'
                    : table.missing?.length
                      ? `Skipped: ${table.missing.join(', ')} not on the new file`
                      : `Skipped: ${table.error || 'could not run'}`}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => void download()}>
            Excel
          </Button>
          <Button type="button" disabled={busy} onClick={() => void run()}>
            Run book
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
