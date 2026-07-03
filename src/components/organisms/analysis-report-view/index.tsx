'use client';

import React from 'react';
import { Sparkles, Copy, Printer, ChevronDown, ChevronUp } from 'lucide-react';
import type {
  AnalysisReport,
  AnalysisReportTable,
  AnalysisReportBlock,
} from '@/lib/analysis-report-types';
import { resolveReportBlocks } from '@/lib/report-blocks';
import { copyTableRich } from '@/utils/apa-clipboard';
import { ReportChartCard } from '@/components/molecules/report-chart-card';
import { Button } from '@/components/atoms/button';
import { cn } from '@/utils';

function tableToTsv(t: AnalysisReportTable): string {
  const esc = (cell: string) => {
    const s = String(cell);
    if (/[\t\n"]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [t.columns.map(esc).join('\t'), ...t.rows.map(row => row.map(esc).join('\t'))];
  return lines.join('\n');
}

function buildSummaryText(report: AnalysisReport): string {
  const { meta, summary, metrics, trust } = report;
  const lines = [
    meta.title,
    meta.subtitle ? `Variables: ${meta.subtitle}` : '',
    `Generated: ${new Date(meta.generated_at).toLocaleString()}`,
    `Rows in dataset: ${meta.rows_dataset}`,
    '',
    summary,
    '',
    ...metrics.map(m => (m.hint ? `${m.label}: ${m.value} (${m.hint})` : `${m.label}: ${m.value}`)),
  ];
  if (trust.notes.length) {
    lines.push('', 'Notes:', ...trust.notes.map(n => `• ${n}`));
  }
  if (trust.warnings.length) {
    lines.push('', 'Warnings:', ...trust.warnings.map(w => `• ${w}`));
  }
  if (report.exclusion_summary) {
    lines.push(
      '',
      'Data exclusions:',
      `• Rows total: ${report.exclusion_summary.rows_total}`,
      `• Rows used: ${report.exclusion_summary.rows_used}`,
      `• Rows excluded: ${report.exclusion_summary.rows_excluded}`
    );
  }
  if (report.reproducibility?.r_script) {
    lines.push('', 'R reproduction script:', report.reproducibility.r_script);
  }
  return lines.filter(Boolean).join('\n');
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function parsePValue(cell: string): number | null {
  const s = String(cell).trim().toLowerCase();
  if (!s || s === '—' || s === '-') return null;
  if (s.startsWith('<')) {
    const n = parseFloat(s.replace(/[<>\s]/g, ''));
    return Number.isFinite(n) ? n * 0.5 : null;
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function formatP(p: number | null): string {
  if (p === null) return '—';
  if (p < 0.001) return '< 0.001';
  return p.toFixed(3);
}

function MetaChip({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 text-[11.5px] text-muted-foreground">
      <span className="font-medium text-muted-foreground/90">{label}</span>
      <span className={cn('font-medium text-foreground', mono && 'font-mono tabular-nums')}>
        {value}
      </span>
    </span>
  );
}

function PValueCell({ value, alpha = 0.05 }: { value: string; alpha?: number }) {
  const p = parsePValue(value);
  const sig = p !== null && p < alpha;
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      <span
        className={cn(
          'font-mono tabular-nums',
          sig ? 'font-semibold text-foreground' : 'font-normal text-muted-foreground'
        )}
      >
        {p !== null ? formatP(p) : value}
      </span>
      {sig ? (
        <span className="rounded-sm bg-primary/10 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-primary">
          sig
        </span>
      ) : null}
    </span>
  );
}

function isPValueColumn(header: string): boolean {
  const h = header.toLowerCase();
  return h.includes('p-value') || h.includes('p value') || h === 'p' || h.includes('p (');
}

function BlockHeader({
  kind,
  title,
  subtitle,
}: {
  kind: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-[18px] py-3.5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-primary">
            {kind}
          </span>
          <span className="text-[15px] font-medium text-foreground">{title}</span>
        </div>
        {subtitle ? (
          <p className="mt-1 text-xs leading-snug text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

function InterpretationBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-[22px] mt-4 rounded-r-md border border-border border-l-[3px] border-l-primary bg-gradient-to-b from-primary/[0.05] to-transparent px-4 py-3.5">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid size-[18px] place-items-center rounded bg-primary text-primary-foreground">
          <Sparkles className="size-2.5" aria-hidden />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">
          Interpretation · AI generated
        </p>
      </div>
      <div className="text-[13.5px] leading-[1.55] text-foreground">{children}</div>
    </div>
  );
}

function ReportTable({
  table,
  onCopy,
  emphasized = false,
}: {
  table: AnalysisReportTable;
  onCopy: () => void;
  emphasized?: boolean;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border bg-card',
        emphasized ? 'border-border' : 'border-border'
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
        <h4 className="text-[12.5px] font-medium text-foreground">{table.title}</h4>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px] print:hidden"
          onClick={onCopy}
        >
          <Copy className="mr-1 size-3" aria-hidden />
          Copy
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] border-collapse text-left text-[12.5px]">
          <thead>
            <tr
              className={cn(
                'border-b border-border text-[11px] font-semibold',
                emphasized
                  ? 'bg-foreground uppercase tracking-[0.06em] text-background'
                  : 'bg-muted/50 text-muted-foreground'
              )}
            >
              {table.columns.map((c, i) => (
                <th
                  key={c}
                  className={cn(
                    'whitespace-nowrap px-3 py-2.5',
                    i === 0 ? 'text-left' : 'text-right'
                  )}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr
                key={ri}
                className={cn(
                  'border-b border-border/50 last:border-0',
                  emphasized && ri === 0 && 'bg-primary/[0.04]',
                  !emphasized && 'hover:bg-muted/15'
                )}
              >
                {row.map((cell, ci) => {
                  const header = table.columns[ci] ?? '';
                  const alignRight = ci > 0;
                  return (
                    <td
                      key={ci}
                      className={cn(
                        'whitespace-nowrap px-3 py-2.5',
                        alignRight ? 'text-right' : 'text-left',
                        emphasized && ri === 0 && ci === 0 && 'font-medium'
                      )}
                    >
                      {isPValueColumn(header) ? (
                        <PValueCell value={cell} />
                      ) : (
                        <span
                          className={cn(
                            alignRight && 'font-mono tabular-nums text-foreground',
                            !alignRight && 'font-medium text-foreground'
                          )}
                        >
                          {cell}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportSection({
  sectionId,
  label,
  hint,
  children,
  dense,
}: {
  sectionId: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
  dense?: boolean;
}) {
  return (
    <section
      id={`report-section-${sectionId}`}
      className={cn('scroll-mt-24 border-t border-border/50 px-[22px]', dense ? 'py-4' : 'py-5')}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function BlockRenderer({
  block,
  blockIndex,
  onCopyTable,
  onAnnotateChart,
  onChartExportError,
  emphasized,
}: {
  block: AnalysisReportBlock;
  blockIndex: number;
  onCopyTable: (t: AnalysisReportTable) => void;
  onAnnotateChart?: (sectionId: string, chartTitle: string) => void;
  onChartExportError?: (message: string) => void;
  emphasized?: boolean;
}) {
  if (block.type === 'interpretation') {
    return (
      <ReportSection sectionId={`interpretation-${blockIndex}`} label="Interpretation">
        <p className="text-[13px] leading-relaxed text-foreground">{block.content}</p>
      </ReportSection>
    );
  }
  if (block.type === 'metrics') {
    return (
      <ReportSection sectionId="metrics" label="Key results">
        <div className="flex flex-wrap gap-2">
          {block.metrics.map((m, i) => (
            <div
              key={i}
              className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px]"
            >
              <span className="text-muted-foreground">{m.label}: </span>
              <span className="font-mono tabular-nums text-foreground">{m.value}</span>
            </div>
          ))}
        </div>
      </ReportSection>
    );
  }
  if (block.type === 'table') {
    const t = block.table;
    return (
      <ReportSection sectionId={`table-${t.id}`} label={t.title}>
        <ReportTable table={t} emphasized={emphasized} onCopy={() => onCopyTable(t)} />
        {t.interpretation ? (
          <p className="mt-3 text-[13px] leading-relaxed text-foreground">{t.interpretation}</p>
        ) : null}
        {t.notes?.length ? (
          <p className="mt-2 text-[11px] italic text-muted-foreground">{t.notes.join(' ')}</p>
        ) : null}
      </ReportSection>
    );
  }
  if (block.type === 'chart' && block.chart) {
    const sectionId = 'chart';
    return (
      <ReportSection sectionId={sectionId} label={block.chart.title || 'Chart'}>
        <ReportChartCard
          chart={block.chart}
          onAnnotate={
            onAnnotateChart
              ? () => onAnnotateChart(sectionId, block.chart!.title || 'Chart')
              : undefined
          }
          onExportError={onChartExportError}
        />
      </ReportSection>
    );
  }
  return null;
}

type Props = {
  report: AnalysisReport;
  rawResult?: Record<string, unknown> | null;
  onAnnotateChart?: (sectionId: string, chartTitle: string) => void;
};

export function AnalysisReportView({ report, rawResult, onAnnotateChart }: Props) {
  const [copyState, setCopyState] = React.useState<string | null>(null);
  const [rawOpen, setRawOpen] = React.useState(false);
  const primaryTable = report.tables[0];
  const blocks = resolveReportBlocks(report);
  const useBlockLayout = blocks.length > 0;
  const analysisKind =
    report.meta.analysis_key?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ??
    'Analysis';

  const flash = (msg: string) => {
    setCopyState(msg);
    window.setTimeout(() => setCopyState(null), 2000);
  };

  const onCopySummary = async () => {
    const ok = await copyText(buildSummaryText(report));
    flash(ok ? 'Summary copied' : 'Copy failed');
  };

  const onCopyTable = async (t: AnalysisReportTable) => {
    const tsv = tableToTsv(t);
    const ok = t.apa_style ? await copyTableRich(t, tsv) : await copyText(tsv);
    flash(ok ? (t.apa_style ? 'Table copied (APA HTML)' : 'Table copied (TSV)') : 'Copy failed');
  };

  const onPrint = () => window.print();

  const generatedLabel = new Date(report.meta.generated_at).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const blockSubtitle = [
    report.meta.subtitle,
    report.exclusion_summary
      ? `n = ${report.exclusion_summary.rows_used} · ${report.exclusion_summary.rows_excluded} excluded`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div id="tensr-report-print-root" className="w-full text-left">
      {/* Page title — outside the result card */}
      <div className="mb-7">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
          <span>Analysis report</span>
          <span className="font-normal text-muted-foreground/50">·</span>
          <span className="font-normal normal-case tracking-normal text-muted-foreground">
            {generatedLabel}
          </span>
        </div>
        <h1 className="text-2xl font-medium tracking-[-0.018em] text-foreground md:text-[26px]">
          {report.meta.title}
        </h1>
        {report.meta.subtitle ? (
          <p className="mt-2 max-w-[40rem] text-sm leading-relaxed text-muted-foreground">
            {report.meta.subtitle}
          </p>
        ) : null}
      </div>

      {/* Single analysis block card */}
      <article className="overflow-hidden rounded-lg border border-border bg-card">
        <BlockHeader
          kind={analysisKind}
          title={report.meta.title}
          subtitle={blockSubtitle || undefined}
        />

        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-muted/20 px-[22px] py-3">
          <MetaChip label="Rows" value={String(report.meta.rows_dataset)} mono />
          <MetaChip label="Run" value={generatedLabel} />
          {report.meta.title ? <MetaChip label="Test" value={report.meta.title} /> : null}
          <span className="flex-1" />
        </div>

        {report.assumption_checks?.interpretations?.length ? (
          <ReportSection sectionId="assumptions" label="Tests of assumptions">
            <ul className="space-y-2 text-[13px] leading-relaxed text-foreground">
              {report.assumption_checks.interpretations.map((line, i) => (
                <li key={i} className="rounded-md border border-border bg-muted/20 px-3 py-2">
                  {line}
                </li>
              ))}
            </ul>
            {report.assumption_checks.summary ? (
              <p className="mt-3 rounded-md border border-border bg-muted/30 px-3 py-2.5 text-[13px] leading-relaxed text-foreground">
                {report.assumption_checks.summary}
              </p>
            ) : null}
          </ReportSection>
        ) : null}

        {(report.trust.warnings.length > 0 || report.trust.notes.length > 0) && (
          <div
            id="report-section-warnings"
            className="scroll-mt-24 space-y-2 border-b border-border/60 px-[22px] py-3"
          >
            {report.trust.warnings.map((w, i) => (
              <div
                key={`w-${i}`}
                role="status"
                className="rounded-md border border-amber-500/20 bg-amber-500/[0.07] px-3.5 py-2.5 text-[13px] text-foreground"
              >
                <p className="text-xs font-medium text-amber-800 dark:text-amber-200">Heads up</p>
                <p className="mt-1 leading-relaxed text-muted-foreground">{w}</p>
              </div>
            ))}
            {report.trust.notes.map((n, i) => (
              <div
                key={`n-${i}`}
                className="rounded-md border border-border bg-muted/30 px-3.5 py-2.5 text-[13px] text-muted-foreground"
              >
                {n}
              </div>
            ))}
          </div>
        )}

        {useBlockLayout ? (
          blocks.map((block, i) => (
            <BlockRenderer
              key={`block-${i}-${block.type}`}
              block={block}
              blockIndex={i}
              onCopyTable={onCopyTable}
              onAnnotateChart={onAnnotateChart}
              onChartExportError={msg => flash(msg)}
              emphasized={i === 0}
            />
          ))
        ) : (
          <>
            {report.summary ? (
              <div id="report-section-interpretation" className="scroll-mt-24">
                <InterpretationBlock>
                  <p>{report.summary}</p>
                </InterpretationBlock>
              </div>
            ) : null}

            {report.metrics.length > 0 ? (
              <ReportSection sectionId="metrics" label="Key metrics" dense>
                <div className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
                  {report.metrics.map((m, i) => (
                    <div
                      key={i}
                      className={cn(
                        'bg-card px-4 py-3',
                        m.emphasis && 'ring-1 ring-inset ring-primary/15'
                      )}
                    >
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {m.label}
                      </p>
                      <p
                        className={cn(
                          'mt-1 font-mono text-base tabular-nums text-foreground',
                          m.emphasis && 'font-semibold',
                          !m.value && 'text-muted-foreground'
                        )}
                      >
                        {m.value || '—'}
                      </p>
                      {m.hint ? (
                        <p className="mt-1 text-[10px] text-muted-foreground">{m.hint}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </ReportSection>
            ) : null}

            {(report.charts?.length ? report.charts : report.chart ? [report.chart] : []).map(
              (ch, i) =>
                ch ? (
                  <ReportSection
                    key={`chart-${i}`}
                    sectionId={`chart-${i}`}
                    label={ch.title || 'Chart'}
                  >
                    <ReportChartCard
                      chart={ch}
                      onAnnotate={
                        onAnnotateChart
                          ? () => onAnnotateChart(`chart-${i}`, ch.title || 'Chart')
                          : undefined
                      }
                      onExportError={msg => flash(msg)}
                    />
                  </ReportSection>
                ) : null
            )}

            {(report.spss_blocks ?? []).map((t, i) => (
              <ReportSection key={t.id} sectionId={`spss-${t.id}`} label={t.title}>
                <ReportTable
                  table={{ ...t, apa_style: true }}
                  emphasized={i === 0}
                  onCopy={() => onCopyTable(t)}
                />
                {t.notes?.length ? (
                  <p className="mt-2 text-[11px] italic text-muted-foreground">
                    {t.notes.join(' ')}
                  </p>
                ) : null}
              </ReportSection>
            ))}

            {report.tables.map((t, i) => (
              <ReportSection
                key={t.id}
                sectionId={`table-${t.id}`}
                label={i === 0 && !report.spss_blocks?.length ? 'Primary result' : t.title}
              >
                <ReportTable
                  table={t}
                  emphasized={i === 0 && !report.spss_blocks?.length}
                  onCopy={() => onCopyTable(t)}
                />
                {t.interpretation ? (
                  <p className="mt-3 text-[13px] leading-relaxed text-foreground">
                    {t.interpretation}
                  </p>
                ) : null}
              </ReportSection>
            ))}
          </>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 bg-muted/20 px-[22px] py-3 print:hidden">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            data-report-copy-summary
            onClick={onCopySummary}
          >
            <Copy className="mr-1.5 size-3.5" aria-hidden />
            Copy summary
          </Button>
          {primaryTable ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => onCopyTable(primaryTable)}
            >
              Copy main table
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onPrint}>
            <Printer className="mr-1.5 size-3.5" aria-hidden />
            Print
          </Button>
          {copyState ? (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">{copyState}</span>
          ) : null}
        </div>
      </article>

      {rawResult && Object.keys(rawResult).length > 0 ? (
        <div className="mt-6 print:hidden">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setRawOpen(o => !o)}
          >
            {rawOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {rawOpen ? 'Hide' : 'Show'} technical details
          </button>
          {rawOpen ? (
            <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-border bg-muted/30 p-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
              {JSON.stringify(rawResult, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}

      {report.analysis_log ? (
        <details className="mt-4 print:hidden" open>
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
            Analysis log
          </summary>
          <pre className="mt-2 whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
            {report.analysis_log}
          </pre>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 h-7 text-xs"
            onClick={() =>
              void copyText(report.analysis_log!).then(ok =>
                flash(ok ? 'Log copied' : 'Copy failed')
              )
            }
          >
            <Copy className="mr-1 size-3" aria-hidden />
            Copy log
          </Button>
        </details>
      ) : null}

      {report.spss_syntax ? (
        <details className="mt-4 print:hidden">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
            SPSS syntax (reference)
          </summary>
          <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-border bg-muted/30 p-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
            {report.spss_syntax}
          </pre>
        </details>
      ) : null}

      {report.reproducibility?.r_script ? (
        <div className="mt-4 print:hidden">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Reproducibility (R)
          </p>
          <pre className="max-h-48 overflow-auto rounded-md border border-border bg-muted/30 p-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
            {report.reproducibility.r_script}
          </pre>
        </div>
      ) : null}

      {report.analysis_spec ? (
        <details className="mt-4 print:hidden">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
            Analysis specification
          </summary>
          <pre className="mt-2 overflow-auto rounded-md border border-border bg-muted/30 p-3 font-mono text-[10px] text-muted-foreground">
            {JSON.stringify(report.analysis_spec, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
