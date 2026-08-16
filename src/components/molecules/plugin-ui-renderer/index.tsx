'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { PluginRecord } from '@/types/plugin';
import { getStytchBearerForTensrApi } from '@/utils/auth';
import { tensrApiUrl } from '@/lib/tensr-api-url';
import { Loader } from '@/components/molecules/loading';

interface PluginUIRendererProps {
  plugin: PluginRecord;
  result: any;
  onClose?: () => void;
}

function isTableResult(result: unknown): result is {
  type: 'table';
  data: { title?: string; columns: string[]; rows: unknown[][] };
} {
  if (!result || typeof result !== 'object') return false;
  const r = result as Record<string, unknown>;
  const data = r.data as Record<string, unknown> | undefined;
  return r.type === 'table' && !!data && Array.isArray(data.columns) && Array.isArray(data.rows);
}

function NativeTableResult({ result }: { result: any }) {
  if (!isTableResult(result)) {
    return (
      <pre className="max-h-full overflow-auto p-4 text-xs">{JSON.stringify(result, null, 2)}</pre>
    );
  }
  const { title, columns, rows } = result.data;
  return (
    <div className="flex h-full flex-col overflow-hidden p-4">
      {title ? <h2 className="mb-3 text-base font-semibold">{title}</h2> : null}
      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 bg-muted">
            <tr>
              {columns.map(col => (
                <th key={col} className="border-b border-border px-3 py-2 font-medium">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="odd:bg-background even:bg-muted/40">
                {columns.map((_, j) => (
                  <td key={j} className="border-b border-border/60 px-3 py-1.5 tabular-nums">
                    {row[j] == null ? '' : String(row[j])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Renders plugin ui.html in a sandboxed iframe when the zip is available.
 * Falls back to a native table/JSON view so a broken download never hides
 * a successful execute result.
 */
export default function PluginUIRenderer({ plugin, result, onClose }: PluginUIRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [uiHtml, setUiHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uiError, setUiError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPluginUI = async () => {
      try {
        setLoading(true);
        setUiError(null);

        const token = getStytchBearerForTensrApi();
        if (!token) {
          throw new Error('No authentication token found');
        }

        // Authenticated download — do not raw-fetch a relative /plugins/... URL
        // (that hits the Next origin and returns HTML, which JSZip rejects).
        const pluginResponse = await fetch(tensrApiUrl(`/plugins/${plugin.pluginId}/download`), {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!pluginResponse.ok) {
          throw new Error(`Failed to download plugin: ${pluginResponse.status}`);
        }

        const pluginZip = await pluginResponse.arrayBuffer();
        const header = new Uint8Array(pluginZip.slice(0, 4));
        const isZip = header.length >= 2 && header[0] === 0x50 && header[1] === 0x4b; /* PK */
        if (!isZip) {
          throw new Error('Plugin download was not a zip archive');
        }

        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(pluginZip);

        const uiFiles = ['ui.html', 'dist/ui.html', 'src/ui.html'];
        let html: string | null = null;
        for (const uiFile of uiFiles) {
          const file = zip.file(uiFile);
          if (file) {
            html = await file.async('string');
            break;
          }
        }

        if (cancelled) return;
        if (!html) {
          setUiError('Plugin UI not found');
          setUiHtml(null);
          setLoading(false);
          return;
        }

        setUiHtml(html);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setUiError(err instanceof Error ? err.message : 'Failed to load plugin UI');
        setUiHtml(null);
        setLoading(false);
      }
    };

    void loadPluginUI();
    return () => {
      cancelled = true;
    };
  }, [plugin.pluginId]);

  useEffect(() => {
    if (!uiHtml || !iframeRef.current?.contentWindow) return;
    const id = window.setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'plugin-result', result }, '*');
    }, 50);
    return () => window.clearTimeout(id);
  }, [uiHtml, result]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type === 'plugin-ready') {
        iframeRef.current?.contentWindow?.postMessage({ type: 'plugin-result', result }, '*');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [result]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader size="md" />
      </div>
    );
  }

  // Prefer native result view when zip/UI cannot load — execute already succeeded.
  if (!uiHtml) {
    return (
      <div className="flex h-full w-full flex-col">
        <div className="flex items-center justify-between border-b border-border p-2">
          <div className="font-medium">{plugin.name} - Results</div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {uiError ? (
          <div className="px-4 pt-2 text-xs text-muted-foreground">
            Plugin UI unavailable ({uiError}). Showing execute result.
          </div>
        ) : null}
        <div className="min-h-0 flex-1">
          <NativeTableResult result={result} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center justify-between border-b border-border p-2">
        <div className="font-medium">{plugin.name} - Results</div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="relative flex-1">
        <iframe
          ref={iframeRef}
          className="h-full w-full border-0"
          sandbox="allow-scripts"
          srcDoc={uiHtml || ''}
          title={`${plugin.name} UI`}
        />
      </div>
    </div>
  );
}
