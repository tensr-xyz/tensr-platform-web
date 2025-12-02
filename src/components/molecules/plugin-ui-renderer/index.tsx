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

        // Get download URL from API
        const { downloadUrl } = await apiClient.plugins.downloadUrl(plugin.pluginId);

        // Download plugin zip
        const pluginResponse = await fetch(downloadUrl);
        if (!pluginResponse.ok) {
          throw new Error(`Failed to download plugin: ${pluginResponse.status}`);
        }

        const pluginZip = await pluginResponse.arrayBuffer();

        // Extract UI HTML from zip
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(pluginZip);

        // Try to find UI file (ui.html, dist/ui.html, etc.)
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
    if (uiHtml && iframeRef.current && iframeRef.current.contentWindow) {
      // Write HTML to iframe
      const iframe = iframeRef.current;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(uiHtml);
        iframeDoc.close();

        // Wait for iframe to load, then send result data
        iframe.onload = () => {
          if (iframe.contentWindow) {
            // Send execution result to plugin UI
            iframe.contentWindow.postMessage(
              {
                type: 'plugin-result',
                result: result,
              },
              '*'
            );
          }
        };
      }
    }
  }, [uiHtml, result]);

  // Listen for messages from plugin UI
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Handle messages from plugin UI if needed
      if (event.data.type === 'plugin-ready') {
        // Plugin UI is ready, send result
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            {
              type: 'plugin-result',
              result: result,
            },
            '*'
          );
        }
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
          sandbox="allow-scripts allow-same-origin"
          title={`${plugin.name} UI`}
        />
      </div>
    </div>
  );
}

