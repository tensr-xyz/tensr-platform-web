'use client';

import { ReactNode, useRef, useState } from 'react';
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
import { Textarea } from '@/components/atoms/text-area';
import { getStytchBearerForTensrApi } from '@/utils/auth';
import { tensrApiUrl } from '@/lib/tensr-api-url';
import { formatApiErrorMessage } from '@/lib/api-error';
import { Loader2 as Loader } from 'lucide-react';

export type LegacyIntakeMode = 'text' | 'json' | 'base64';

export type LegacyIntakeConfig = {
  title: string;
  description: string;
  endpoint: string;
  /** Primary body key (e.g. job, axis, xml, syntax). */
  bodyKey: string;
  primaryLabel: string;
  accept?: string;
  mode?: LegacyIntakeMode;
  /** Optional second paste field (Triple-S data). */
  secondaryKey?: string;
  secondaryLabel?: string;
  submitLabel?: string;
};

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function LegacyIntakeDialog({
  children,
  config,
}: {
  children: ReactNode;
  config: LegacyIntakeConfig;
}) {
  const mode = config.mode ?? 'text';
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [secondary, setSecondary] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resetFeedback = () => {
    setError(null);
    setSuccess(null);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    resetFeedback();
    setFileName(file.name);
    if (mode === 'base64') {
      const b64 = await fileToBase64(file);
      setText(b64);
      return;
    }
    setText(await file.text());
  };

  const buildBody = (): Record<string, unknown> => {
    if (mode === 'json') {
      const trimmed = text.trim();
      if (!trimmed) throw new Error('Paste a Qualtrics survey definition JSON object.');
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        throw new Error('Definition must be valid JSON.');
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Definition must be a JSON object.');
      }
      return { [config.bodyKey]: parsed };
    }
    const body: Record<string, unknown> = { [config.bodyKey]: text };
    if (config.secondaryKey) {
      body[config.secondaryKey] = secondary;
    }
    return body;
  };

  const handleSubmit = async () => {
    resetFeedback();
    if (!text.trim() && mode !== 'json') {
      setError('Paste text or upload a file first.');
      return;
    }
    setIsLoading(true);
    try {
      const token = getStytchBearerForTensrApi();
      const body = buildBody();
      const res = await fetch(tensrApiUrl(config.endpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const raw = await res.text();
      let payload: unknown = null;
      if (raw) {
        try {
          payload = JSON.parse(raw);
        } catch {
          payload = raw;
        }
      }
      if (!res.ok) {
        const detail =
          payload && typeof payload === 'object' && payload !== null && 'detail' in payload
            ? String((payload as { detail: unknown }).detail)
            : raw || `Request failed (${res.status})`;
        throw new Error(detail);
      }
      const preview =
        typeof payload === 'string'
          ? payload.slice(0, 800)
          : JSON.stringify(payload, null, 2).slice(0, 1200);
      setSuccess(preview || 'OK');
    } catch (err) {
      setError(formatApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{config.description}</p>

          <div className="space-y-2">
            <Label>{config.primaryLabel}</Label>
            {mode === 'base64' && fileName && text ? (
              <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Loaded <span className="font-medium text-foreground">{fileName}</span> (
                {text.length.toLocaleString()} base64 chars). Upload again or clear to paste.
              </p>
            ) : (
              <Textarea
                value={text}
                onChange={e => {
                  setFileName(null);
                  setText(e.target.value);
                  resetFeedback();
                }}
                className="min-h-[140px] font-mono text-xs"
                placeholder={
                  mode === 'json'
                    ? '{ "result": { "Questions": { … } } }'
                    : mode === 'base64'
                      ? 'Paste base64 zip bytes or upload a .zip'
                      : 'Paste content here…'
                }
              />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept={
                  config.accept || '.txt,.json,.xml,.sps,.job,.axis,.zip,.sss,.mdd,text/plain'
                }
                className="hidden"
                onChange={e => void onFile(e.target.files?.[0])}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                Upload file
              </Button>
              {fileName ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFileName(null);
                    setText('');
                    resetFeedback();
                  }}
                >
                  Clear
                </Button>
              ) : null}
            </div>
          </div>

          {config.secondaryKey ? (
            <div className="space-y-2">
              <Label>{config.secondaryLabel || config.secondaryKey}</Label>
              <Textarea
                value={secondary}
                onChange={e => {
                  setSecondary(e.target.value);
                  resetFeedback();
                }}
                className="min-h-[80px] font-mono text-xs"
                placeholder="Optional data file contents"
              />
            </div>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
            </Alert>
          ) : null}
          {success ? (
            <Alert>
              <AlertDescription>
                <p className="mb-1 font-medium">Success</p>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px]">
                  {success}
                </pre>
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button onClick={() => void handleSubmit()} disabled={isLoading}>
            {isLoading ? <Loader className="h-4 w-4 animate-spin" /> : config.submitLabel || 'Run'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
