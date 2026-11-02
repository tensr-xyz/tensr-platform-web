'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { downloadExport } from '@/components/flow/survey-screens';
import {
  documentApa,
  documentCsv,
  documentMarkdown,
  type RunDocument,
  type RunTable,
} from '@/components/flow/run-document';

export type ExportKind = 'chart' | 'table' | 'report';

function downloadText(filename: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadSvg(svg: string, filename: string, scale: number) {
  const image = new Image();
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = image.width * scale || 640 * scale;
    canvas.height = image.height * scale || 360 * scale;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(file => {
      if (!file) return;
      const png = URL.createObjectURL(file);
      const anchor = document.createElement('a');
      anchor.href = png;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(png);
    });
    URL.revokeObjectURL(url);
  };
  image.src = url;
}

export function ExportDialog({
  kind,
  title,
  document,
  svg,
  runIds,
  onClose,
}: {
  kind: ExportKind;
  title: string;
  document: RunDocument;
  svg?: string;
  runIds: string[];
  onClose: () => void;
}) {
  const [error, setError] = useState('');
  const [note, setNote] = useState(document.summary);
  const [caption, setCaption] = useState(title);
  const [busy, setBusy] = useState('');
  const [saved, setSaved] = useState('');
  const stem = caption.replace(/[^\w.-]+/g, '-').slice(0, 40) || 'analysis';
  const current = { ...document, title: caption, summary: note };

  const save = (name: string, action: () => Promise<void> | void) => {
    setBusy(name);
    setError('');
    void Promise.resolve(action())
      .then(() => setSaved(`${name} downloaded.`))
      .catch(err => setError(err instanceof Error ? err.message : 'Could not export'))
      .finally(() => setBusy(''));
  };

  const server = (format: 'pdf' | 'docx' | 'html', filename: string) => {
    if (!runIds.length) throw new Error('Save the analysis before exporting this format.');
    return downloadExport(`/reports/pipeline/export?format=${format}`, filename, {
      method: 'POST',
      body: JSON.stringify({ run_ids: runIds }),
    });
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="export-dialog">
        <DialogHeader>
          <DialogTitle>
            {kind === 'chart'
              ? 'Export chart'
              : kind === 'table'
                ? 'Export table'
                : 'Export report'}
          </DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <div className="export-options">
          {svg ? (
            <>
              <Button
                className="flow-btn"
                type="button"
                disabled={busy !== ''}
                onClick={() => save('PNG', () => downloadSvg(svg, `${stem}.png`, 3))}
              >
                PNG
              </Button>
              <Button
                className="flow-btn"
                type="button"
                disabled={busy !== ''}
                onClick={() => save('SVG', () => downloadText(`${stem}.svg`, svg, 'image/svg+xml'))}
              >
                SVG
              </Button>
            </>
          ) : null}
          <Button
            className="flow-btn"
            type="button"
            disabled={busy !== ''}
            onClick={() =>
              save('CSV', () => downloadText(`${stem}.csv`, documentCsv(current), 'text/csv'))
            }
          >
            CSV
          </Button>
          <Button
            className="flow-btn"
            type="button"
            disabled={busy !== ''}
            onClick={() =>
              save('Markdown', () =>
                downloadText(`${stem}.md`, documentMarkdown(current), 'text/markdown')
              )
            }
          >
            Markdown
          </Button>
          <Button
            className="flow-btn"
            type="button"
            disabled={busy !== ''}
            onClick={() =>
              save('APA', () => downloadText(`${stem}-apa.txt`, documentApa(current), 'text/plain'))
            }
          >
            APA
          </Button>
          <Button
            className="flow-btn"
            type="button"
            disabled={busy !== ''}
            onClick={() => save('PDF', () => server('pdf', `${stem}.pdf`))}
          >
            PDF
          </Button>
          <Button
            className="flow-btn"
            type="button"
            disabled={busy !== ''}
            onClick={() => save('Word', () => server('docx', `${stem}.docx`))}
          >
            Word
          </Button>
          <Button
            className="flow-btn"
            type="button"
            disabled={busy !== ''}
            onClick={() => save('HTML', () => server('html', `${stem}.html`))}
          >
            HTML
          </Button>
        </div>
        <CaptionFields title={caption} note={note} onTitle={setCaption} onNote={setNote} />
        {document.tables[0] ? <ExportPreview table={document.tables[0]} /> : null}
        {error ? <p className="flow-error">{error}</p> : null}
        {saved ? <p className="flow-muted">{saved}</p> : null}
        <DialogFooter>
          <Button className="flow-btn" type="button" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExportPreview({ table }: { table: RunTable }) {
  return (
    <div className="export-preview">
      <p className="flow-muted">{table.title}</p>
      <div className="outputs-row">
        {table.columns.map(column => (
          <span key={column}>{column}</span>
        ))}
      </div>
      {table.rows.slice(0, 6).map(row => (
        <div key={row.join('|')} className="outputs-row">
          {row.map((cell, index) => (
            <span key={`${cell}-${index}`}>{cell}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function copyText(value: string): Promise<void> {
  return navigator.clipboard.writeText(value);
}

export function figureSvg(table: RunTable | undefined): string {
  if (!table) return '';
  const valueIndex = table.columns.findIndex(column => /mean|percent|%/i.test(column));
  const labelIndex = 0;
  if (valueIndex < 0) return '';
  const points = table.rows
    .map(row => ({ label: row[labelIndex] || '', value: Number(row[valueIndex]) }))
    .filter(point => point.label && Number.isFinite(point.value));
  if (!points.length) return '';
  const min = Math.min(...points.map(point => point.value));
  const max = Math.max(...points.map(point => point.value));
  const span = max === min ? 1 : max - min;
  const rows = points
    .map((point, index) => {
      const y = 28 + index * 28;
      const x = 120 + ((point.value - min) / span) * 280;
      return `<text x="8" y="${y + 4}" font-size="12" fill="#1B1C1A">${point.label}</text><circle cx="${x}" cy="${y}" r="4" fill="#1E6B58" />`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="${Math.max(points.length * 28 + 24, 80)}" viewBox="0 0 440 ${Math.max(points.length * 28 + 24, 80)}">${rows}</svg>`;
}

export function CaptionFields({
  title,
  note,
  onTitle,
  onNote,
}: {
  title: string;
  note: string;
  onTitle: (value: string) => void;
  onNote: (value: string) => void;
}) {
  return (
    <>
      <Input
        aria-label="Export title"
        value={title}
        onChange={event => onTitle(event.target.value)}
      />
      <Textarea
        aria-label="Export note"
        value={note}
        onChange={event => onNote(event.target.value)}
      />
    </>
  );
}
