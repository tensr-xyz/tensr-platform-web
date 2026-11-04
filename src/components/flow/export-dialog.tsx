'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem, Switch } from '@/components/ui/rest';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { downloadExport } from '@/components/flow/survey-screens';
import { flowJson } from '@/lib/flow-api';
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

/** The same deck Report builds: every saved table on the file, one slide each. */
export async function deckFromTables(datasetId: string, stem: string) {
  const page = await flowJson<{ specs?: { spec_id?: string; id?: string }[] }>(
    `/datasets/${datasetId}/tables`
  );
  const ids = (page.specs || []).map(spec => spec.spec_id || spec.id || '').filter(Boolean);
  if (!ids.length)
    throw new Error('Save a table in Tables first. The deck has one slide per saved table.');
  const created = await flowJson<{ export_id?: string; filename?: string }>(
    `/datasets/${datasetId}/export/deck`,
    { method: 'POST', body: JSON.stringify({ spec_ids: ids }) }
  );
  if (!created.export_id) throw new Error('The deck did not build. Try again.');
  await downloadExport(`/exports/${created.export_id}`, created.filename || `${stem}.pptx`);
}

export function ExportDialog({
  kind,
  title,
  document,
  svg,
  runIds,
  onClose,
  datasetId,
}: {
  kind: ExportKind;
  title: string;
  document: RunDocument;
  svg?: string;
  runIds: string[];
  onClose: () => void;
  datasetId?: string;
}) {
  const [error, setError] = useState('');
  const [note, setNote] = useState(document.summary);
  const [caption, setCaption] = useState(title);
  const [busy, setBusy] = useState('');
  const [saved, setSaved] = useState('');
  const [choice, setChoice] = useState(kind === 'chart' && svg ? 'copy-image' : 'copy-table');
  const [style, setStyle] = useState<'apa' | 'client' | 'plain'>('apa');
  const [number, setNumber] = useState('1');
  const [italics, setItalics] = useState(true);
  const [withNote, setWithNote] = useState(kind === 'chart' || Boolean(document.summary));
  const [reportFormat, setReportFormat] = useState('docx');
  const [included, setIncluded] = useState<Record<number, boolean>>({});
  const stem = caption.replace(/[^\w.-]+/g, '-').slice(0, 40) || 'analysis';
  const current = { ...document, title: caption, summary: note };

  const save = (name: string, action: () => Promise<void> | void) => {
    setBusy(name);
    setError('');
    void Promise.resolve(action())
      .then(() =>
        setSaved(
          name.startsWith('Copy') ? 'Copied. Paste it where you need it.' : `${name} downloaded.`
        )
      )
      .catch(err => setError(err instanceof Error ? err.message : 'Could not export'))
      .finally(() => setBusy(''));
  };

  const serverFor = (format: 'pdf' | 'docx' | 'html', filename: string, ids: string[]) => {
    if (!ids.length) throw new Error('Pin a saved analysis before exporting this format.');
    return downloadExport(`/datasets/reports/pipeline/export?format=${format}`, filename, {
      method: 'POST',
      body: JSON.stringify({ run_ids: ids }),
    });
  };

  const server = (format: 'pdf' | 'docx' | 'html', filename: string) => {
    if (!runIds.length) throw new Error('Save the analysis before exporting this format.');
    return downloadExport(`/datasets/reports/pipeline/export?format=${format}`, filename, {
      method: 'POST',
      body: JSON.stringify({ run_ids: runIds }),
    });
  };

  if (kind === 'report') {
    const chosen = current.tables.filter((_, index) => included[index] !== false);
    const reportDoc = { ...current, tables: chosen };
    const chosenRuns = runIds.filter((_, index) => included[index] !== false);
    const formats: {
      id: string;
      ext: string;
      label: string;
      note: string;
      soon?: boolean;
      run?: () => Promise<void> | void;
    }[] = [
      {
        id: 'docx',
        ext: '.DOCX',
        label: 'Word',
        note: 'Manuscript or topline, tables stay editable',
        run: () => serverFor('docx', `${stem}.docx`, chosenRuns),
      },
      {
        id: 'pptx',
        ext: '.PPTX',
        label: 'PowerPoint',
        note: datasetId ? 'One slide per saved table' : 'Open a file to build a deck',
        soon: !datasetId,
        run: () => deckFromTables(datasetId || '', stem),
      },
      {
        id: 'xlsx',
        ext: '.XLSX',
        label: 'Excel banner book',
        note: 'From Tables · Banner book',
        soon: true,
      },
      {
        id: 'pdf',
        ext: '.PDF',
        label: 'PDF',
        note: 'Fixed layout, ready to send',
        run: () => serverFor('pdf', `${stem}.pdf`, chosenRuns),
      },
      {
        id: 'md',
        ext: '.MD',
        label: 'Markdown',
        note: 'Plain text, tables as Markdown',
        run: () => downloadText(`${stem}.md`, documentMarkdown(reportDoc), 'text/markdown'),
      },
      { id: 'sav', ext: '.SAV + .SPS', label: 'Data for SPSS', note: 'Coming soon', soon: true },
    ];
    const format = formats.find(item => item.id === reportFormat) || formats[0];
    return (
      <Dialog open onOpenChange={open => !open && onClose()}>
        <DialogContent className="export-dialog xr">
          <DialogHeader className="xp-head">
            <p className="xp-eyebrow">
              {title} · {current.tables.length} finding{current.tables.length === 1 ? '' : 's'}
            </p>
            <DialogTitle>Export report</DialogTitle>
            <DialogDescription className="sr-only">
              Choose a format and what to include.
            </DialogDescription>
          </DialogHeader>
          <div className="xr-body">
            <div className="xr-left">
              <span className="xp-label">Format</span>
              <div className="xr-formats">
                {formats.map(item => (
                  <Button
                    key={item.id}
                    className="xr-format"
                    type="button"
                    data-active={item.id === format.id || undefined}
                    disabled={item.soon}
                    onClick={() => setReportFormat(item.id)}
                  >
                    <span className="xr-format-top">
                      <span className="xp-ext">{item.ext}</span>
                      <i />
                    </span>
                    <strong>{item.label}</strong>
                    <span>{item.note}</span>
                  </Button>
                ))}
              </div>
              <span className="xp-label">Template</span>
              <div className="xp-segment">
                {(['apa', 'client', 'plain'] as const).map(item => (
                  <Button
                    key={item}
                    type="button"
                    data-active={style === item}
                    disabled={item === 'client'}
                    onClick={() => setStyle(item)}
                  >
                    {item === 'apa'
                      ? 'APA 7 manuscript'
                      : item === 'client'
                        ? 'Client template · soon'
                        : 'Plain'}
                  </Button>
                ))}
              </div>
              <div className="xr-toggles">
                <label className="xp-toggle">
                  <span>
                    <strong>Results paragraphs in APA style</strong>
                  </span>
                  <Switch
                    checked={withNote}
                    onCheckedChange={setWithNote}
                    aria-label="Results paragraphs"
                  />
                </label>
                <label className="xp-toggle" data-soon>
                  <span>
                    <strong>Include methods appendix</strong>
                    <span>Coming soon</span>
                  </span>
                  <Switch checked={false} disabled aria-label="Methods appendix" />
                </label>
                <label className="xp-toggle" data-soon>
                  <span>
                    <strong>Keep live link back to Tensr in captions</strong>
                    <span>Coming soon</span>
                  </span>
                  <Switch checked={false} disabled aria-label="Live link" />
                </label>
              </div>
            </div>
            <div className="xr-right">
              <span className="xp-label">What to include</span>
              <div className="xr-include">
                {current.tables.length === 0 ? (
                  <p className="flow-muted">
                    Pin a finding with Add to report on an output to include it here.
                  </p>
                ) : null}
                {current.tables.map((table, index) => (
                  <label key={`${table.title}-${index}`} className="xr-item">
                    <Checkbox
                      checked={included[index] !== false}
                      onCheckedChange={value =>
                        setIncluded(currentMap => ({ ...currentMap, [index]: value === true }))
                      }
                    />
                    <span>
                      T{index + 1} · {table.title}
                    </span>
                  </label>
                ))}
              </div>
              <span className="xp-label">Preview</span>
              <div className="xr-previews">
                {['Title page', 'Results', 'Notes'].map((label, index) => (
                  <div key={label} className="xr-thumb" data-active={index === 1 || undefined}>
                    <div className="xr-page">
                      <i style={{ width: '60%' }} />
                      <i />
                      <i />
                      <i style={{ width: '70%' }} />
                    </div>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="xp-foot">
            <div className="xp-help">
              {error ? (
                <span className="flow-error">{error}</span>
              ) : saved ? (
                <span>{saved}</span>
              ) : (
                <span>Tables stay editable in Word.</span>
              )}
            </div>
            <Button className="flow-btn" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="flow-btn primary"
              type="button"
              disabled={busy !== '' || !format.run || (!chosen.length && format.id !== 'pptx')}
              onClick={() => format.run && save(format.label, format.run)}
            >
              {busy ? 'Working…' : `↓ Export ${format.ext.toLowerCase().split(' ')[0]}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  type Choice = {
    id: string;
    label: string;
    ext: string;
    note?: string;
    soon?: boolean;
    run?: () => Promise<void> | void;
  };
  const table = current.tables[0];
  const tableHtml = table
    ? `<table><caption>${caption}</caption><tr>${table.columns
        .map(column => `<th>${column}</th>`)
        .join('')}</tr>${table.rows
        .map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`)
        .join('')}</table>`
    : '';
  const copies: Choice[] = [
    ...(svg ? [{ id: 'copy-image', label: 'Copy as image', ext: '' }] : []),
    {
      id: 'copy-table',
      label: kind === 'chart' ? 'Copy data as table' : 'Copy as table (editable)',
      ext: '',
      note: 'Pastes into Word, PowerPoint, Excel, Google Docs or Slides',
      run: async () => {
        const plain = documentMarkdown(current);
        if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
          await navigator.clipboard.write([
            new ClipboardItem({
              'text/html': new Blob([tableHtml], { type: 'text/html' }),
              'text/plain': new Blob([plain], { type: 'text/plain' }),
            }),
          ]);
        } else {
          await copyText(plain);
        }
      },
    },
  ];
  const downloads: Choice[] = [
    { id: 'docx', label: 'Word', ext: '.docx', run: () => server('docx', `${stem}.docx`) },
    { id: 'pptx', label: 'PowerPoint', ext: '.pptx', note: 'Coming soon', soon: true },
    { id: 'xlsx', label: 'Excel', ext: '.xlsx', note: 'Coming soon', soon: true },
    { id: 'pdf', label: 'PDF', ext: '.pdf', run: () => server('pdf', `${stem}.pdf`) },
    { id: 'html', label: 'HTML', ext: '.html', run: () => server('html', `${stem}.html`) },
    ...(svg
      ? [
          {
            id: 'png',
            label: 'PNG',
            ext: '.png',
            note: '3x',
            run: () => downloadSvg(svg, `${stem}.png`, 3),
          },
          {
            id: 'svg',
            label: 'SVG',
            ext: '.svg',
            run: () => downloadText(`${stem}.svg`, svg, 'image/svg+xml'),
          },
        ]
      : []),
    {
      id: 'csv',
      label: 'CSV',
      ext: '.csv',
      run: () => downloadText(`${stem}.csv`, documentCsv(current), 'text/csv'),
    },
    {
      id: 'md',
      label: 'Markdown',
      ext: '.md',
      run: () => downloadText(`${stem}.md`, documentMarkdown(current), 'text/markdown'),
    },
    {
      id: 'apa',
      label: 'APA text',
      ext: '.txt',
      run: () => downloadText(`${stem}-apa.txt`, documentApa(current), 'text/plain'),
    },
  ];
  const all = [...copies, ...downloads];
  const picked = all.find(item => item.id === choice) || copies[copies.length - 1];
  if (picked.id === 'copy-image' && svg && !picked.run) {
    picked.run = async () => {
      if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
        throw new Error('This browser cannot copy images. Download the PNG instead.');
      }
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/svg+xml': new Blob([svg], { type: 'image/svg+xml' }) }),
      ]);
    };
  }
  const choiceRow = (item: Choice) => (
    <label
      key={item.id}
      className="xp-choice"
      data-active={item.id === picked.id || undefined}
      data-soon={item.soon || undefined}
    >
      <RadioGroupItem value={item.id} disabled={item.soon} />
      <span className="xp-choice-copy">
        <span>{item.label}</span>
        {item.note ? <span>{item.note}</span> : null}
      </span>
      {item.ext ? <span className="xp-ext">{item.ext}</span> : null}
    </label>
  );
  const heading =
    kind === 'chart' ? 'Export chart' : kind === 'table' ? 'Export table' : 'Export report';

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="export-dialog xp">
        <DialogHeader className="xp-head">
          <p className="xp-eyebrow">{title}</p>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription className="sr-only">Choose a format and style.</DialogDescription>
          <span className="xp-live">Live preview of what you will get</span>
        </DialogHeader>
        <div className="xp-body">
          <RadioGroup className="xp-col xp-formats" value={picked.id} onValueChange={setChoice}>
            <span className="xp-label">Copy</span>
            {copies.map(choiceRow)}
            <span className="xp-label">Download</span>
            {downloads.map(choiceRow)}
          </RadioGroup>
          <div className="xp-col xp-style">
            <span className="xp-label">Style</span>
            <div className="xp-segment">
              {(['apa', 'client', 'plain'] as const).map(item => (
                <Button
                  key={item}
                  type="button"
                  data-active={style === item}
                  disabled={item === 'client'}
                  title={item === 'client' ? 'Client templates are coming soon' : undefined}
                  onClick={() => setStyle(item)}
                >
                  {item === 'apa' ? 'APA 7' : item === 'client' ? 'Client template' : 'Plain'}
                </Button>
              ))}
            </div>
            <label className="xp-field">
              <span>{kind === 'chart' ? 'Figure' : 'Table'} number</span>
              <Input value={number} onChange={event => setNumber(event.target.value)} />
            </label>
            <label className="xp-field">
              <span>Title · italic, title case</span>
              <Textarea
                aria-label="Export title"
                rows={2}
                value={caption}
                onChange={event => setCaption(event.target.value)}
              />
            </label>
            {kind === 'chart' ? (
              <>
                <label className="xp-field">
                  <span>Note</span>
                  <Textarea
                    aria-label="Export note"
                    rows={3}
                    className="xp-note-field"
                    value={note}
                    onChange={event => setNote(event.target.value)}
                  />
                </label>
                <label className="xp-toggle">
                  <span>
                    <strong>Include caption as editable text</strong>
                    <span>
                      Figure number, title and note paste as text, not as part of the image
                    </span>
                  </span>
                  <Switch
                    checked={withNote}
                    onCheckedChange={setWithNote}
                    aria-label="Caption as text"
                  />
                </label>
              </>
            ) : null}
            <label className="xp-toggle" hidden={kind === 'chart'}>
              <span>
                <strong>Italicise statistics</strong>
                <span>n, M, SD, F, p</span>
              </span>
              <Switch
                checked={italics}
                onCheckedChange={setItalics}
                aria-label="Italicise statistics"
              />
            </label>
            <div className="xp-sentence" hidden={kind === 'chart'}>
              <label className="xp-toggle">
                <span>
                  <strong>Results sentence</strong>
                  <span>APA write-up for your results section</span>
                </span>
                <Switch
                  checked={withNote}
                  onCheckedChange={setWithNote}
                  aria-label="Results sentence"
                />
              </label>
              {withNote ? (
                <Textarea
                  aria-label="Export note"
                  rows={5}
                  value={note}
                  onChange={event => setNote(event.target.value)}
                />
              ) : null}
            </div>
          </div>
          <div className="xp-col xp-preview">
            <div className="xp-preview-head">
              <span>Preview · {style === 'plain' ? 'plain' : 'APA 7'}</span>
              <span>100%</span>
            </div>
            <div className="xp-page" data-style={style} data-italics={italics || undefined}>
              <p className="xp-number">
                {kind === 'chart' ? 'Figure' : 'Table'} {number}
              </p>
              <p className="xp-title">{caption}</p>
              {svg && kind === 'chart' ? (
                <div className="xp-figure" dangerouslySetInnerHTML={{ __html: svg }} />
              ) : null}
              {table && kind !== 'chart' ? (
                <table>
                  <thead>
                    <tr>
                      {table.columns.map(column => (
                        <th key={column}>{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.slice(0, 12).map(row => (
                      <tr key={row.join('|')}>
                        {row.map((cell, index) => (
                          <td key={`${cell}-${index}`}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
              {withNote && note ? (
                <p className="xp-note">
                  <em>Note.</em> {note}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="xp-foot">
          <div className="xp-help">
            {error ? (
              <span className="flow-error">{error}</span>
            ) : saved ? (
              <span>{saved}</span>
            ) : (
              <>
                <strong>Paste with ⌘V in Word, PowerPoint, Excel, Google Docs or Slides</strong>
                <span>Captions and notes stay editable text.</span>
              </>
            )}
          </div>
          <Button className="flow-btn" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flow-btn primary"
            type="button"
            disabled={busy !== '' || !picked.run}
            onClick={() => picked.run && save(picked.label, picked.run)}
          >
            {busy
              ? 'Working…'
              : picked.id.startsWith('copy')
                ? picked.id === 'copy-image'
                  ? 'Copy image'
                  : 'Copy table'
                : `Download ${picked.label}`}
          </Button>
        </div>
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
