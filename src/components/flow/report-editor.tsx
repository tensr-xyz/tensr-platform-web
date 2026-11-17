'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/rest';
import { flowJson } from '@/lib/flow-api';
import {
  addPage,
  applyDefaultLabels,
  copyStyles,
  documentFromPins,
  insertTextBox,
  normalizeReportDocument,
  pageHref,
  reportDocumentForApi,
  resolveTextHref,
  setDefaultLabels,
  setObjectText,
  setObjectTextStyle,
  type DefaultLabels,
  type ListStyle,
  type PinLike,
  type ReportDocument,
  type ReportObject,
  type TextAlign,
  type TextBoxStyle,
  type VerticalAlign,
} from '@/lib/report-document';

const STYLE_PRESETS: { id: string; label: string; style: Partial<TextBoxStyle> }[] = [
  { id: 'headline', label: 'Headline', style: { fontFamily: 'Inter', fontSizePt: 22, bold: true } },
  { id: 'body', label: 'Body', style: { fontFamily: 'Inter', fontSizePt: 14, bold: false } },
  {
    id: 'caption',
    label: 'Caption',
    style: { fontFamily: 'Inter', fontSizePt: 11, bold: false, color: '#6A6B66' },
  },
  { id: 'title', label: 'Title', style: { fontFamily: 'Inter', fontSizePt: 28, bold: true } },
];

const COLOURS = [
  { label: 'Ink', value: '#1B1C1A' },
  { label: 'Muted', value: '#6A6B66' },
  { label: 'Accent', value: '#1E6B58' },
  { label: 'Warn', value: '#A15C12' },
];

const FONT_FAMILIES = ['Inter', 'System Sans-Serif', 'Times New Roman'];

function emptyDocument(): ReportDocument {
  return addPage(normalizeReportDocument({}), { title: 'Page 1', layoutId: 'title_and_content' });
}

function ensurePages(document: ReportDocument): ReportDocument {
  return document.pages.length ? document : emptyDocument();
}

function objectPlainText(obj: ReportObject): string {
  if (obj.runs.length) return obj.runs.map(run => run.text).join('');
  return obj.text;
}

function withObjectHref(
  document: ReportDocument,
  pageId: string,
  objectId: string,
  href: string | null
): ReportDocument {
  const page = document.pages.find(item => item.id === pageId);
  const obj = page?.objects.find(item => item.id === objectId);
  if (!obj) return document;
  const text = objectPlainText(obj) || 'Link';
  const style = obj.textStyle;
  return setObjectText(document, pageId, objectId, {
    text,
    runs: [
      {
        text,
        bold: style.bold,
        italic: style.italic,
        underline: style.underline,
        strikethrough: style.strikethrough,
        color: style.color,
        fontFamily: style.fontFamily,
        fontSizePt: style.fontSizePt,
        href: href || null,
        binding: null,
      },
    ],
  });
}

function objectHref(obj: ReportObject): string {
  const fromRun = obj.runs.find(run => run.href)?.href;
  return fromRun || '';
}

function kindLabel(kind: ReportObject['kind']): string {
  if (kind === 'text') return 'Text';
  if (kind === 'table') return 'Table';
  if (kind === 'chart') return 'Chart';
  if (kind === 'image') return 'Image';
  return 'Shape';
}

function TextObjectView({
  obj,
  selected,
  paintArmed,
  onSelect,
}: {
  obj: ReportObject;
  selected: boolean;
  paintArmed: boolean;
  onSelect: () => void;
}) {
  const style = obj.textStyle;
  const text = objectPlainText(obj) || 'Text';
  const listPrefix =
    style.listStyle === 'bullet' ? '• ' : style.listStyle === 'number' ? '1. ' : '';
  const indent = Math.max(0, style.listIndent) * 16;
  const deco = [style.underline ? 'underline' : '', style.strikethrough ? 'line-through' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className="report-editor-object"
      data-kind={obj.kind}
      data-selected={selected}
      data-paint={paintArmed}
      style={{
        left: `${obj.frame.x * 100}%`,
        top: `${obj.frame.y * 100}%`,
        width: `${obj.frame.w * 100}%`,
        height: `${obj.frame.h * 100}%`,
        zIndex: obj.zIndex,
        fontFamily: style.fontFamily,
        fontSize: `${style.fontSizePt}pt`,
        color: style.color,
        fontWeight: style.bold ? 700 : 400,
        fontStyle: style.italic ? 'italic' : 'normal',
        textDecoration: deco || 'none',
        textAlign: style.align,
        lineHeight: String(style.lineSpacing),
        justifyContent:
          style.verticalAlign === 'middle'
            ? 'center'
            : style.verticalAlign === 'bottom'
              ? 'flex-end'
              : 'flex-start',
        paddingLeft: indent,
      }}
      onClick={event => {
        event.stopPropagation();
        onSelect();
      }}
    >
      {obj.kind === 'text' ? (
        <span>
          {listPrefix}
          {text}
        </span>
      ) : (
        <span className="report-editor-object-label">{kindLabel(obj.kind)}</span>
      )}
    </button>
  );
}

export function ReportEditor({
  datasetId,
  pins = [],
}: {
  datasetId: string | null;
  pins?: PinLike[];
}) {
  const [document, setDocument] = useState<ReportDocument>(() => emptyDocument());
  const [pageId, setPageId] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paintSourceId, setPaintSourceId] = useState<string | null>(null);
  const [linkDraft, setLinkDraft] = useState('');
  const [linkPageId, setLinkPageId] = useState('');
  const [phase, setPhase] = useState<'loading' | 'ready'>('loading');
  const [saveNote, setSaveNote] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSave = useRef(true);

  const page = useMemo(
    () => document.pages.find(item => item.id === pageId) || document.pages[0] || null,
    [document, pageId]
  );
  const selected = useMemo(
    () => page?.objects.find(obj => obj.id === selectedId) || null,
    [page, selectedId]
  );

  const persist = useCallback(
    (next: ReportDocument) => {
      if (!datasetId) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void flowJson(`/datasets/${datasetId}/report/document`, {
          method: 'PUT',
          body: JSON.stringify({ document: reportDocumentForApi(next) }),
        })
          .then(() => setSaveNote('Saved'))
          .catch(() => setSaveNote('Could not save'));
      }, 400);
    },
    [datasetId]
  );

  const commit = useCallback(
    (next: ReportDocument) => {
      const ensured = ensurePages(normalizeReportDocument(next));
      setDocument(ensured);
      if (!ensured.pages.some(item => item.id === pageId)) {
        setPageId(ensured.pages[0]?.id || '');
        setSelectedId(null);
      }
      if (!skipSave.current) persist(ensured);
    },
    [pageId, persist]
  );

  useEffect(() => {
    let live = true;
    skipSave.current = true;
    setPhase('loading');
    const fromPins = pins.length ? documentFromPins(pins) : emptyDocument();
    const boot = async () => {
      let next = ensurePages(fromPins);
      if (datasetId) {
        try {
          const stored = await flowJson<{
            document?: Record<string, unknown> | null;
            has_document?: boolean;
          }>(`/datasets/${datasetId}/report/document`);
          if (stored.has_document && stored.document) {
            next = ensurePages(normalizeReportDocument(stored.document));
          }
        } catch {
          /* Keep pin-derived document when storage is empty. */
        }
      }
      if (!live) return;
      setDocument(next);
      setPageId(next.pages[0]?.id || '');
      setSelectedId(null);
      setPaintSourceId(null);
      setPhase('ready');
      skipSave.current = false;
    };
    void boot();
    return () => {
      live = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [datasetId, pins]);

  useEffect(() => {
    if (!selected) {
      setLinkDraft('');
      setLinkPageId('');
      return;
    }
    const href = objectHref(selected);
    const resolved = resolveTextHref(href);
    if (resolved?.kind === 'page') {
      setLinkPageId(resolved.pageId);
      setLinkDraft('');
    } else {
      setLinkPageId('');
      setLinkDraft(resolved?.kind === 'url' ? resolved.url : '');
    }
  }, [selected]);

  const patchStyle = (patch: Partial<TextBoxStyle>) => {
    if (!page || !selected) return;
    commit(setObjectTextStyle(document, page.id, selected.id, patch));
  };

  const activePreset =
    STYLE_PRESETS.find(preset => {
      if (!selected) return false;
      const style = selected.textStyle;
      return (
        style.fontSizePt === preset.style.fontSizePt &&
        Boolean(style.bold) === Boolean(preset.style.bold ?? style.bold) &&
        (preset.style.color ? style.color === preset.style.color : true)
      );
    })?.label || 'Headline';

  const selectObject = (objectId: string) => {
    if (paintSourceId && page && paintSourceId !== objectId) {
      commit(copyStyles(document, page.id, paintSourceId, [objectId]));
      setPaintSourceId(null);
      setSelectedId(objectId);
      return;
    }
    setSelectedId(objectId);
  };

  const addText = () => {
    if (!page) return;
    const before = new Set(page.objects.map(obj => obj.id));
    const next = insertTextBox(document, page.id, {
      text: 'New text',
      frame: { x: 0.18, y: 0.18, w: 0.55, h: 0.16 },
      textStyle: STYLE_PRESETS[0]?.style,
    });
    const created = next.pages
      .find(item => item.id === page.id)
      ?.objects.find(obj => !before.has(obj.id));
    commit(next);
    if (created) setSelectedId(created.id);
  };

  const applyLink = (href: string | null) => {
    if (!page || !selected || selected.kind !== 'text') return;
    commit(withObjectHref(document, page.id, selected.id, href));
  };

  if (phase === 'loading') {
    return (
      <div className="report-editor report-editor-loading" aria-busy="true">
        <p className="flow-muted">Loading pages…</p>
      </div>
    );
  }

  return (
    <div className="report-editor">
      <div className="report-editor-toolbar" role="toolbar" aria-label="Text formatting">
        <button type="button" className="report-editor-tool-label" onClick={addText}>
          Text
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" className="report-editor-chip" disabled={!selected}>
              {activePreset} ▾
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {STYLE_PRESETS.map(preset => (
              <DropdownMenuItem key={preset.id} onSelect={() => patchStyle(preset.style)}>
                {preset.label}
              </DropdownMenuItem>
            ))}
            {FONT_FAMILIES.map(font => (
              <DropdownMenuItem key={font} onSelect={() => patchStyle({ fontFamily: font })}>
                {font}
              </DropdownMenuItem>
            ))}
            {[11, 14, 18, 22, 28].map(size => (
              <DropdownMenuItem key={size} onSelect={() => patchStyle({ fontSizePt: size })}>
                {size} pt
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          type="button"
          className="report-editor-toggle"
          data-active={Boolean(selected?.textStyle.bold)}
          disabled={!selected}
          aria-pressed={Boolean(selected?.textStyle.bold)}
          onClick={() => patchStyle({ bold: !selected?.textStyle.bold })}
        >
          B
        </Button>
        <Button
          type="button"
          className="report-editor-toggle italic"
          data-active={Boolean(selected?.textStyle.italic)}
          disabled={!selected}
          aria-pressed={Boolean(selected?.textStyle.italic)}
          onClick={() => patchStyle({ italic: !selected?.textStyle.italic })}
        >
          I
        </Button>
        <Button
          type="button"
          className="report-editor-toggle underline"
          data-active={Boolean(selected?.textStyle.underline)}
          disabled={!selected}
          aria-pressed={Boolean(selected?.textStyle.underline)}
          onClick={() => patchStyle({ underline: !selected?.textStyle.underline })}
        >
          U
        </Button>
        <Button
          type="button"
          className="report-editor-toggle strike"
          data-active={Boolean(selected?.textStyle.strikethrough)}
          disabled={!selected}
          aria-pressed={Boolean(selected?.textStyle.strikethrough)}
          onClick={() => patchStyle({ strikethrough: !selected?.textStyle.strikethrough })}
        >
          S
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" className="report-editor-chip quiet" disabled={!selected}>
              • List
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {(
              [
                { value: 'none', label: 'None' },
                { value: 'bullet', label: 'Bullets' },
                { value: 'number', label: 'Numbering' },
              ] as { value: ListStyle; label: string }[]
            ).map(option => (
              <DropdownMenuItem
                key={option.value}
                onSelect={() => patchStyle({ listStyle: option.value })}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              onSelect={() =>
                patchStyle({ listIndent: Math.min(8, (selected?.textStyle.listIndent || 0) + 1) })
              }
            >
              Increase indent
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                patchStyle({ listIndent: Math.max(0, (selected?.textStyle.listIndent || 0) - 1) })
              }
            >
              Decrease indent
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" className="report-editor-chip quiet" disabled={!selected}>
              Colour ▾
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {COLOURS.map(colour => (
              <DropdownMenuItem
                key={colour.value}
                onSelect={() => patchStyle({ color: colour.value })}
              >
                {colour.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          type="button"
          className="report-editor-chip quiet"
          data-active={Boolean(paintSourceId)}
          disabled={!selected && !paintSourceId}
          onClick={() => {
            if (paintSourceId) {
              setPaintSourceId(null);
              return;
            }
            if (selected) setPaintSourceId(selected.id);
          }}
        >
          Format painter
        </Button>
        {saveNote ? <span className="report-editor-save">{saveNote}</span> : null}
      </div>

      <div className="report-editor-body">
        <aside className="report-editor-pages" aria-label="Pages">
          {document.pages.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className="report-editor-thumb"
              data-active={item.id === page?.id}
              data-hidden={item.hideFromExport}
              onClick={() => {
                setPageId(item.id);
                setSelectedId(null);
                setPaintSourceId(null);
              }}
              aria-label={`Page ${index + 1}${item.hideFromExport ? ', hidden from export' : ''}`}
            />
          ))}
          {document.pages.some(item => item.hideFromExport) ? (
            <p className="report-editor-pages-note">
              Page {document.pages.findIndex(item => item.hideFromExport) + 1 || ''} hidden from
              export
            </p>
          ) : null}
          <Button
            type="button"
            className="flow-btn report-editor-add-page"
            onClick={() => {
              const next = addPage(document, {
                title: `Page ${document.pages.length + 1}`,
                afterPageId: page?.id,
              });
              const created = next.pages.find(
                item => !document.pages.some(existing => existing.id === item.id)
              );
              commit(next);
              if (created) setPageId(created.id);
              setSelectedId(null);
            }}
          >
            Add page
          </Button>
        </aside>

        <div
          className="report-editor-stage"
          onClick={() => {
            setSelectedId(null);
            if (paintSourceId) setPaintSourceId(null);
          }}
        >
          <div className="report-editor-page" aria-label={page?.title || 'Page'}>
            {(page?.objects || [])
              .filter(obj => !obj.hidden)
              .slice()
              .sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id))
              .map(obj => (
                <TextObjectView
                  key={obj.id}
                  obj={obj}
                  selected={obj.id === selectedId}
                  paintArmed={Boolean(paintSourceId)}
                  onSelect={() => selectObject(obj.id)}
                />
              ))}
          </div>
        </div>

        <aside className="report-editor-inspector" aria-label="Text and labels">
          {selected?.kind === 'text' ? (
            <>
              <h3>Text</h3>
              <label className="report-editor-field">
                <span>Content</span>
                <Input
                  value={objectPlainText(selected)}
                  onChange={event => {
                    if (!page) return;
                    commit(
                      setObjectText(document, page.id, selected.id, { text: event.target.value })
                    );
                  }}
                />
              </label>
              <div className="report-editor-row">
                {(
                  [
                    { value: 'left', label: 'Left' },
                    { value: 'center', label: 'Centre' },
                    { value: 'right', label: 'Right' },
                  ] as { value: TextAlign; label: string }[]
                ).map(option => (
                  <Button
                    key={option.value}
                    type="button"
                    className="report-editor-pill"
                    data-active={selected.textStyle.align === option.value}
                    onClick={() => patchStyle({ align: option.value })}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <div className="report-editor-row">
                {(
                  [
                    { value: 'top', label: 'Top' },
                    { value: 'middle', label: 'Middle' },
                    { value: 'bottom', label: 'Bottom' },
                  ] as { value: VerticalAlign; label: string }[]
                ).map(option => (
                  <Button
                    key={option.value}
                    type="button"
                    className="report-editor-pill"
                    data-active={selected.textStyle.verticalAlign === option.value}
                    onClick={() => patchStyle({ verticalAlign: option.value })}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <label className="report-editor-field">
                <span>Line spacing</span>
                <Input
                  type="number"
                  min={1}
                  step={0.05}
                  value={selected.textStyle.lineSpacing}
                  onChange={event => {
                    const value = Number(event.target.value);
                    if (!Number.isFinite(value) || value <= 0) return;
                    patchStyle({ lineSpacing: value });
                  }}
                />
              </label>
              <h3>Hyperlink</h3>
              <label className="report-editor-field">
                <span>Web address</span>
                <Input
                  value={linkDraft}
                  placeholder="https://"
                  onChange={event => setLinkDraft(event.target.value)}
                  onBlur={() => {
                    const value = linkDraft.trim();
                    applyLink(value || null);
                    setLinkPageId('');
                  }}
                />
              </label>
              <label className="report-editor-field">
                <span>Page in this report</span>
                <select
                  className="report-editor-select"
                  value={linkPageId}
                  onChange={event => {
                    const nextId = event.target.value;
                    setLinkPageId(nextId);
                    setLinkDraft('');
                    applyLink(nextId ? pageHref(nextId) : null);
                  }}
                >
                  <option value="">None</option>
                  {document.pages.map((item, index) => (
                    <option key={item.id} value={item.id}>
                      Page {index + 1}
                      {item.title ? ` · ${item.title}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              {objectHref(selected) ? (
                <Button
                  type="button"
                  className="flow-btn"
                  onClick={() => {
                    setLinkDraft('');
                    setLinkPageId('');
                    applyLink(null);
                  }}
                >
                  Remove link
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <h3>Page</h3>
              <p className="flow-muted">
                Select a text box to format it, or add one from the toolbar.
              </p>
              <Button type="button" className="flow-btn" onClick={addText}>
                Add text box
              </Button>
            </>
          )}

          <div className="report-editor-divider" />
          <h3>Default labels</h3>
          <p className="flow-muted">Rename NET and Total everywhere in this report.</p>
          <DefaultLabelsEditor
            labels={document.defaultLabels}
            onChange={labels => commit(setDefaultLabels(document, labels))}
          />
          <p className="report-editor-preview flow-muted">
            Preview: {applyDefaultLabels('NET', document.defaultLabels)} ·{' '}
            {applyDefaultLabels('Total', document.defaultLabels)}
          </p>
        </aside>
      </div>
    </div>
  );
}

function DefaultLabelsEditor({
  labels,
  onChange,
}: {
  labels: DefaultLabels;
  onChange: (labels: DefaultLabels) => void;
}) {
  return (
    <div className="report-editor-labels">
      <label className="report-editor-field">
        <span>NET</span>
        <Input
          value={labels.net}
          onChange={event => onChange({ ...labels, net: event.target.value })}
        />
      </label>
      <label className="report-editor-field">
        <span>Total</span>
        <Input
          value={labels.total}
          onChange={event => onChange({ ...labels, total: event.target.value })}
        />
      </label>
    </div>
  );
}
