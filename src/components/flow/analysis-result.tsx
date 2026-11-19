'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table } from '@/components/ui/table';
import type { RunTable } from '@/components/flow/run-document';
import { FlowMarkdown } from '@/components/flow/flow-markdown';
import { formatDecimalText } from '@/components/flow/result-tables';
import { guardUserText } from '@/components/flow/chat-output';
import { fetchAnalysisRun, R_CHECK_POLL_MS, rCheckPhase } from '@/lib/analysis-runs';
import { loadOutputPreferences, OUTPUT_PREFERENCES_EVENT } from '@/lib/output-preferences';
import { exportTableAsCSV, exportTableAsImage } from '@/utils/table-export';
import { appendResultToDeck, exportResultAsPptx } from '@/lib/output-pptx';
import type { AnalysisReportChart } from '@/lib/analysis-report-types';
import { AgentInlineChart } from '@/components/organisms/agent-inline-chart';
import { exportSvgElementAsPng } from '@/utils/chart-export';

/** Column role for a theme table so the count, share, and quote each keep their own space. */
export function quoteColumnFit(header: string): 'count' | 'share' | 'quote' | 'label' {
  const name = header.trim().toLowerCase();
  if (name === 'quote') return 'quote';
  if (name === 'count' || name === 'n') return 'count';
  if (name.includes('%')) return 'share';
  return 'label';
}

/** The shared result: a lead, charts, the tables, one footnote, and checks folded away. */
export function AnalysisResult({
  lead,
  tables,
  charts = [],
  footnote,
  checks,
  script,
  rCheck,
  rStatement,
  runId,
  datasetId,
  projectId,
  templateName,
  templateBase64,
}: {
  lead?: string;
  tables: RunTable[];
  charts?: AnalysisReportChart[];
  footnote?: string;
  checks?: string[];
  script?: string;
  rCheck?: string;
  rStatement?: string;
  runId?: string;
  datasetId?: string;
  projectId?: string;
  templateName?: string;
  templateBase64?: string;
}) {
  const [places, setPlaces] = useState(() =>
    typeof window === 'undefined' ? 1 : loadOutputPreferences().decimalPlaces
  );
  const [checksOpen, setChecksOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportNote, setExportNote] = useState('');
  const [exportBusy, setExportBusy] = useState('');
  const card = useRef<HTMLDivElement>(null);
  const download = (kind: 'xlsx' | 'png') => {
    if (kind === 'png' && charts.length) {
      const svg = card.current?.querySelector('.analysis-charts svg, svg');
      if (svg instanceof SVGSVGElement) {
        const title = 'title' in charts[0] ? String(charts[0].title || 'chart') : 'chart';
        void exportSvgElementAsPng(svg, title);
        return;
      }
    }
    const table = card.current?.querySelector('table');
    if (!(table instanceof HTMLElement)) return;
    if (kind === 'xlsx') {
      exportTableAsCSV(table, { filename: 'table' });
      return;
    }
    void exportTableAsImage(table, { filename: 'table' });
  };
  const runExport = (name: string, action: () => Promise<void>) => {
    setExportBusy(name);
    setExportNote('');
    void action()
      .then(() =>
        setExportNote(name === 'pptx' ? 'PowerPoint slide downloaded.' : 'Added to the deck.')
      )
      .catch(err =>
        setExportNote(err instanceof Error ? err.message : 'The export did not finish.')
      )
      .finally(() => setExportBusy(''));
  };
  const [scriptOpen, setScriptOpen] = useState(false);
  const [mark, setMark] = useState({ kind: rCheck || '', statement: rStatement || '' });
  useEffect(() => {
    setMark({ kind: rCheck || '', statement: rStatement || '' });
  }, [rCheck, rStatement]);
  useEffect(() => {
    const apply = () => setPlaces(loadOutputPreferences().decimalPlaces);
    window.addEventListener(OUTPUT_PREFERENCES_EVENT, apply);
    return () => window.removeEventListener(OUTPUT_PREFERENCES_EVENT, apply);
  }, []);
  useEffect(() => {
    if ((rCheck || '') !== 'pending') return;
    if (!runId) {
      setMark({ kind: 'unknown', statement: 'R check unavailable.' });
      return;
    }
    let cancelled = false;
    let polls = 0;
    const timer = window.setInterval(() => {
      polls += 1;
      if (rCheckPhase(polls) === 'unavailable') {
        window.clearInterval(timer);
        if (!cancelled) setMark({ kind: 'unknown', statement: 'R check unavailable.' });
        return;
      }
      void fetchAnalysisRun(runId).then(run => {
        const next = run?.report?.r_syntax_verification;
        if (cancelled || !next || next.kind === 'pending') return;
        setMark({ kind: next.kind, statement: next.statement || '' });
        window.clearInterval(timer);
      });
    }, R_CHECK_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [rCheck, runId]);
  const shownCheck = mark.kind || rCheck;
  const rawStatement = mark.statement || rStatement;
  const shownStatement =
    guardUserText(rawStatement || '') ||
    (shownCheck === 'mismatch' || shownCheck === 'not_verified' ? 'The check did not match.' : '');
  const checkLabel =
    shownCheck === 'pending'
      ? 'R check running'
      : shownCheck === 'mismatch' || shownCheck === 'not_verified'
        ? 'R mismatch'
        : shownCheck === 'unknown'
          ? 'Check not run for this table'
          : shownCheck
            ? 'Checked in R'
            : '';
  const checkDetail =
    shownCheck === 'unknown'
      ? ''
      : shownStatement && shownStatement !== 'R check unavailable.'
        ? ` · ${shownStatement}`
        : '';
  const checkNote = checkLabel ? `${checkLabel}${checkDetail}` : '';
  const leadText =
    lead && shownStatement && lead.includes(shownStatement)
      ? lead
          .split('\n')
          .map(line => line.replace(shownStatement, '').trim())
          .filter(Boolean)
          .join('\n')
      : lead;
  const foot = [footnote, checkNote].filter(Boolean).join(' · ');
  if (!leadText && !tables.length && !charts.length && !foot) return null;
  return (
    <div className="analysis-result" ref={card}>
      {tables.length || charts.length ? (
        <div className="analysis-export">
          <Button type="button" className="flow-btn" onClick={() => setExportOpen(open => !open)}>
            {exportOpen ? 'Close export' : 'Export'}
          </Button>
          {exportOpen ? (
            <div className="analysis-export-menu" role="menu">
              <Button
                type="button"
                className="flow-btn"
                role="menuitem"
                disabled={Boolean(exportBusy)}
                onClick={() =>
                  runExport('pptx', () =>
                    exportResultAsPptx({
                      runId,
                      lead: leadText,
                      tables,
                      footnote,
                      projectId,
                      templateBase64,
                      templateName,
                    })
                  )
                }
              >
                PowerPoint slide
              </Button>
              <p className="flow-muted">
                {templateName
                  ? `On ${templateName.replace(/\.(pptx|potx)$/i, '')} · editable chart`
                  : 'On the template chosen for this project · editable chart'}
              </p>
              <Button
                type="button"
                className="flow-btn"
                role="menuitem"
                disabled={Boolean(exportBusy) || !datasetId}
                onClick={() =>
                  runExport('deck', () =>
                    appendResultToDeck({
                      datasetId: datasetId || '',
                      lead: leadText,
                      tables,
                      footnote,
                      templateBase64,
                      templateName,
                    })
                  )
                }
              >
                Add to a deck…
              </Button>
              <p className="flow-muted">Append to a saved deck in Report</p>
              {tables.length ? (
                <Button
                  type="button"
                  className="flow-btn"
                  role="menuitem"
                  onClick={() => download('xlsx')}
                >
                  Excel table
                </Button>
              ) : null}
              <Button
                type="button"
                className="flow-btn"
                role="menuitem"
                onClick={() => download('png')}
              >
                Image (PNG)
              </Button>
              {exportNote ? <p className="flow-muted">{exportNote}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {leadText ? (
        <div className="analysis-lead">
          <FlowMarkdown>{leadText}</FlowMarkdown>
        </div>
      ) : null}
      {charts.length ? (
        <div className="analysis-charts">
          {charts.map((chart, index) => (
            <AgentInlineChart
              key={`${chart.kind}-${'title' in chart ? chart.title : index}-${index}`}
              chart={chart}
            />
          ))}
        </div>
      ) : null}
      {tables.map((table, index) => {
        const columns = Array.isArray(table.columns) ? table.columns : [];
        const rows = Array.isArray(table.rows) ? table.rows : [];
        if (!columns.length || !rows.length) return null;
        const quoteTable = columns.includes('Quote');
        return (
          <section
            key={`${table.title}-${index}-${columns.join('-')}`}
            className={quoteTable ? 'analysis-table analysis-table-quote' : 'analysis-table'}
          >
            {table.title ? <h3>{table.title}</h3> : null}
            <Table className="flow-table output-grid">
              {quoteTable ? (
                <colgroup>
                  {columns.map((column, index) => (
                    <col key={`${column}-${index}`} data-fit={quoteColumnFit(column)} />
                  ))}
                </colgroup>
              ) : null}
              <thead>
                <tr>
                  {columns.map((column, index) => (
                    <th
                      key={`${column}-${index}`}
                      data-fit={quoteTable ? quoteColumnFit(column) : undefined}
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${table.title}-${index}`}>
                    {row.map((value, cellIndex) => (
                      <td
                        key={`${index}-${cellIndex}`}
                        data-fit={quoteTable ? quoteColumnFit(columns[cellIndex] || '') : undefined}
                      >
                        {cellIndex === 0
                          ? value
                          : formatDecimalText(value, places, columns[cellIndex] || '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>
          </section>
        );
      })}
      {foot ? <p className="flow-muted analysis-footnote">{foot}</p> : null}
      {checks && checks.length ? (
        <div className="analysis-fold">
          <Button type="button" className="flow-btn" onClick={() => setChecksOpen(open => !open)}>
            {checksOpen ? 'Hide checks' : `Checks (${checks.length})`}
          </Button>
          {checksOpen ? (
            <ul>
              {checks.map(check => (
                <li key={check}>{check}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {script ? (
        <div className="analysis-fold">
          <Button type="button" className="flow-btn" onClick={() => setScriptOpen(open => !open)}>
            {scriptOpen ? 'Hide R script' : 'R script'}
          </Button>
          {scriptOpen ? <pre className="analysis-script">{script}</pre> : null}
        </div>
      ) : null}
    </div>
  );
}
