'use client';

import { useRef, useState } from 'react';
import {
  ACCEPTED_UPLOAD_ACCEPT,
  ACCEPTED_UPLOAD_HELP,
  isAcceptedUploadExtension,
} from '@/lib/accepted-upload-types';
import type { AgentLoopAttachment } from '@/lib/run-agent-loop';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/atoms/popover';
import { Segmented } from '@/components/ui/segmented';
import { Textarea } from '@/components/ui/textarea';

export const CHAT_ATTACHMENT_LIMIT = 8 * 1024 * 1024;

function fileBytes(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/** The classic composer inserts a column after `/`. This shell uses `@`. */
export function insertColumnMention(text: string, column: string): string {
  const base = text.endsWith('@') ? text.slice(0, -1) : text;
  const needsSpace = Boolean(base) && !/\s$/.test(base);
  return `${base}${needsSpace ? ' ' : ''}${column}`;
}

export async function readChatAttachments(
  list: FileList | File[] | null
): Promise<{ accepted: AgentLoopAttachment[]; rejected: string[] }> {
  const accepted: AgentLoopAttachment[] = [];
  const rejected: string[] = [];
  if (!list?.length) return { accepted, rejected };
  for (const file of Array.from(list)) {
    if (!isAcceptedUploadExtension(file.name)) {
      rejected.push(`${file.name} must be ${ACCEPTED_UPLOAD_HELP.replace(/\.$/, '')}`);
      continue;
    }
    if (file.size > CHAT_ATTACHMENT_LIMIT) {
      rejected.push(`${file.name} is larger than 8 MB`);
      continue;
    }
    const bytes = new Uint8Array(await fileBytes(file));
    let binary = '';
    const chunk = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunk) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
    }
    accepted.push({ filename: file.name, content_base64: btoa(binary) });
  }
  return { accepted, rejected };
}

export function FlowComposer({
  value,
  onChange,
  onSend,
  placeholder,
  mode,
  onMode,
  busy,
  columns,
  attachments,
  onAttach,
  onRemoveAttachment,
  attachError,
  layout,
  showModes = true,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: (text?: string) => void;
  placeholder: string;
  mode: 'ask' | 'plan' | 'agent';
  onMode: (value: 'ask' | 'plan' | 'agent') => void;
  busy?: boolean;
  columns: string[] | null;
  attachments: AgentLoopAttachment[];
  onAttach: (list: FileList | null) => void;
  onRemoveAttachment: (filename: string) => void;
  attachError?: string | null;
  layout: 'hero' | 'thread';
  showModes?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const send = () => {
    if (busy || !value.trim()) return;
    const text = value;
    onChange('');
    onSend(text);
  };
  const pick = (column: string) => {
    onChange(insertColumnMention(value, column));
    setOpen(false);
  };
  const modes = (
    <Segmented
      className="mode-switch"
      aria-label="Chat mode"
      value={mode}
      onValueChange={onMode}
      options={[
        { value: 'ask', label: 'Ask' },
        { value: 'plan', label: 'Plan' },
        {
          value: 'agent',
          label: (
            <>
              <i className="mode-dot" aria-hidden="true" />
              Agent
            </>
          ),
        },
      ]}
    />
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={layout === 'hero' ? 'flow-composer chat-composer' : 'flow-composer'}>
          {attachments.length ? (
            <div className="chat-files">
              {attachments.map(file => (
                <Button
                  key={file.filename}
                  className="chat-file"
                  type="button"
                  onClick={() => onRemoveAttachment(file.filename)}
                >
                  {file.filename} ×
                </Button>
              ))}
            </div>
          ) : null}
          {attachError ? <p className="flow-error">{attachError}</p> : null}
          {layout === 'thread' ? (
            <Button
              className="chat-tool chat-tool-lead"
              type="button"
              aria-label="Attach a file"
              onClick={() => fileRef.current?.click()}
            >
              +
            </Button>
          ) : null}
          <Textarea
            className="flow-text border-0 shadow-none focus-visible:ring-0"
            value={value}
            onChange={event => {
              const next = event.target.value;
              onChange(next);
              if (next.endsWith('@')) setOpen(true);
            }}
            placeholder={placeholder}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey && !open) {
                event.preventDefault();
                send();
              }
            }}
          />
          <div className="chat-composer-row">
            {layout === 'hero' ? (
              <Button
                className="chat-tool"
                type="button"
                aria-label="Attach a file"
                onClick={() => fileRef.current?.click()}
              >
                +
              </Button>
            ) : null}
            <Input
              ref={fileRef}
              className="hidden"
              type="file"
              accept={`${ACCEPTED_UPLOAD_ACCEPT},text/csv`}
              multiple
              aria-label="Choose files to attach"
              onChange={event => {
                onAttach(event.target.files);
                event.target.value = '';
              }}
            />
            <Button
              className={layout === 'hero' ? 'chat-tool' : 'chat-tool hidden'}
              type="button"
              aria-label="Insert a column"
              onClick={() => {
                if (!value.endsWith('@')) onChange(`${value}@`);
                setOpen(true);
              }}
            >
              @
            </Button>
            {layout === 'hero' ? (
              <span className="chat-composer-hint">Attach a file or mention a column with @</span>
            ) : null}
            {showModes ? modes : null}
            <Button
              className="chat-send"
              type="button"
              aria-label="Send"
              disabled={busy || !value.trim()}
              onClick={send}
            >
              ↑
            </Button>
          </div>
        </div>
      </PopoverAnchor>
      <PopoverContent align="start" side="top" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Search columns…" />
          <CommandList>
            <CommandEmpty>
              {columns === null
                ? 'Loading columns'
                : columns.length
                  ? 'No matching columns'
                  : 'Open a file to pick columns'}
            </CommandEmpty>
            <CommandGroup heading="Columns">
              {(columns || []).map(name => (
                <CommandItem key={name} value={name} onSelect={() => pick(name)}>
                  {name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
