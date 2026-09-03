'use client';

import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/atoms/alert';
import { Button } from '@/components/atoms/button';
import { parseWincrossJob } from '@/lib/custom-tables/api';
import {
  canvasFromConvertedTable,
  refusalCopy,
  wincrossHeadline,
  type WincrossParseResult,
} from '@/lib/custom-tables/wincross-report';
import type { CustomTableCanvas } from '@/lib/custom-tables/spec';

export function WincrossImport({
  token,
  onLoadCanvas,
}: {
  token?: string | null;
  onLoadCanvas: (canvas: CustomTableCanvas, tableName: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WincrossParseResult | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const job = await file.text();
      const parsed = await parseWincrossJob(job, token);
      setResult(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that .job file.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border border-border p-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        WinCross .job
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Import converts what Tensr can represent. Anything else is listed with what to do by hand —
        not a crash.
      </p>
      <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs">
        <input
          type="file"
          accept=".job,text/plain"
          className="text-xs"
          disabled={busy}
          onChange={e => void onFile(e.target.files?.[0])}
        />
        {busy ? 'Reading…' : null}
      </label>
      {error ? (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {result?.report ? (
        <div className="mt-2 space-y-2 text-xs">
          <p className="font-medium">{wincrossHeadline(result)}</p>
          {result.report.tables_converted.length ? (
            <ul className="space-y-1">
              {result.report.tables_converted.map((table, i) => (
                <li key={`${table.name}-${i}`} className="flex items-start justify-between gap-2">
                  <span>
                    Converted: {table.name || 'table'}
                    {table.notes?.length ? (
                      <span className="block text-[11px] text-muted-foreground">
                        {table.notes[0]}
                      </span>
                    ) : null}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px]"
                    onClick={() => {
                      const match = result.tables?.find(t => t.ok && t.name === table.name);
                      const loaded = canvasFromConvertedTable(match || {});
                      if (loaded) onLoadCanvas(loaded, table.name || 'Imported table');
                    }}
                  >
                    Load
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          {result.report.tables_refused.map((table, i) => {
            const copy = refusalCopy(table);
            return (
              <div key={`${table.name}-${i}`} className="rounded border border-border/80 p-2">
                <p className="font-medium">Not converted: {table.name || 'table'}</p>
                <p className="mt-1 text-muted-foreground">{copy.reason}</p>
                <p className="mt-1">{copy.handWork}</p>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
