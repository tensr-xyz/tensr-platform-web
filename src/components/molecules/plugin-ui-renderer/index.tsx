'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { PluginRecord } from '@/types/plugin';
import { apiClient } from '@/lib/api-client';
import { Loader } from '@/components/molecules/loading';

interface PluginUIRendererProps {
  plugin: PluginRecord;
  result: any;
  onClose?: () => void;
}

/**
 * Renders plugin ui.html in a sandboxed iframe.
 *
 * Uses srcDoc + sandbox="allow-scripts" only — no allow-same-origin.
 * That keeps the iframe origin opaque (null), so plugin UI cannot reach
 * parent DOM/storage while still receiving results via postMessage.
 */
export default function PluginUIRenderer({ plugin, result, onClose }: PluginUIRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [uiHtml, setUiHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPluginUI = async () => {
      try {
        setLoading(true);
        setError(null);

        const { downloadUrl } = await apiClient.plugins.downloadUrl(plugin.pluginId);
        const pluginResponse = await fetch(downloadUrl);
        if (!pluginResponse.ok) {
          throw new Error(`Failed to download plugin: ${pluginResponse.status}`);
        }

        const pluginZip = await pluginResponse.arrayBuffer();
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

        if (!html) {
          setError('Plugin UI not found. The plugin may not have a UI file.');
          setLoading(false);
          return;
        }

        setUiHtml(html);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load plugin UI');
        setLoading(false);
      }
    };

    loadPluginUI();
  }, [plugin.pluginId]);

  useEffect(() => {
    if (!uiHtml || !iframeRef.current?.contentWindow) return;
    // srcDoc load is async — post after a tick and on plugin-ready.
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
      <div className="flex items-center justify-center h-full">
        <Loader size="md" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="text-red-500 mb-4">{error}</div>
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center justify-between p-2 border-b border-border">
        <div className="font-medium">{plugin.name} - Results</div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="flex-1 relative">
        <iframe
          ref={iframeRef}
          className="w-full h-full border-0"
          sandbox="allow-scripts"
          srcDoc={uiHtml || ''}
          title={`${plugin.name} UI`}
        />
      </div>
    </div>
  );
}
