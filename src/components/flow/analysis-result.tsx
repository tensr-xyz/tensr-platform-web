'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table } from '@/components/ui/table';
import type { RunTable } from '@/components/flow/run-document';

/** The shared result: a lead, the tables, one footnote, and checks folded away. */
export function AnalysisResult({
  lead,
  tables,
  footnote,
  checks,
  script,
}: {
  lead?: string;
  tables: RunTable[];
  footnote?: string;
  checks?: string[];
  script?: string;
}) {
  const [checksOpen, setChecksOpen] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  if (!lead && !tables.length && !footnote) return null;
  return (
    <div className="analysis-result">
      {lead ? <p className="analysis-lead">{lead}</p> : null}
      {tables.map(table => (
        <section key={`${table.title}-${table.columns.join('-')}`} className="analysis-table">
          <h3>{table.title}</h3>
          <Table className="flow-table output-grid">
            <thead>
              <tr>
                {table.columns.map(column => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, index) => (
                <tr key={`${table.title}-${index}`}>
                  {row.map((value, cellIndex) => (
                    <td key={`${index}-${cellIndex}`}>{value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
      ))}
      {footnote ? <p className="flow-muted analysis-footnote">{footnote}</p> : null}
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
