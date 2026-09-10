'use client';

import type { ReactNode } from 'react';
import { LegacyIntakeDialog, type LegacyIntakeConfig } from './legacy-intake-dialog';

function wrap(config: LegacyIntakeConfig) {
  return function LegacyDialog({ children }: { children: ReactNode }) {
    return <LegacyIntakeDialog config={config}>{children}</LegacyIntakeDialog>;
  };
}

export const WincrossJobImportDialog = wrap({
  title: 'WinCross Job Import',
  description:
    'Parse a WinCross .job into TableSpec review output. Converted tables and named refusals are returned; Quantum is not attempted.',
  endpoint: '/datasets/wincross/parse',
  bodyKey: 'job',
  primaryLabel: '.job contents',
  accept: '.job,text/plain',
  submitLabel: 'Parse job',
});

export const QualtricsDefinitionDialog = wrap({
  title: 'Qualtrics Definition',
  description:
    'Parse a Qualtrics survey-definition JSON (Questions / Blocks). Brand API access is not required for this path.',
  endpoint: '/datasets/qualtrics/definition',
  bodyKey: 'definition',
  primaryLabel: 'Survey definition JSON',
  accept: '.json,application/json,text/plain',
  mode: 'json',
  submitLabel: 'Parse definition',
});

export const QPackIngestDialog = wrap({
  title: 'QPack Ingest',
  description:
    'Ingest a QPack zip (sav/csv + labels). QScript / JS / R are listed as skipped and never evaluated.',
  endpoint: '/datasets/qpack/ingest',
  bodyKey: 'zip_b64',
  primaryLabel: 'QPack zip (base64)',
  accept: '.zip,application/zip',
  mode: 'base64',
  submitLabel: 'Ingest QPack',
});

export const TripleSImportDialog = wrap({
  title: 'Triple-S Import',
  description: 'Parse Triple-S (.sss) metadata XML with optional fixed/CSV data payload.',
  endpoint: '/datasets/intake/triple-s',
  bodyKey: 'sss',
  primaryLabel: '.sss XML',
  accept: '.sss,.xml,text/xml,text/plain',
  secondaryKey: 'data',
  secondaryLabel: 'Data (optional)',
  submitLabel: 'Import Triple-S',
});

export const MddImportDialog = wrap({
  title: 'MDD Import',
  description:
    'Forsta/IBM MDD subset reader — variable names from XML/zip only. Not a full project restore.',
  endpoint: '/datasets/intake/mdd',
  bodyKey: 'xml',
  primaryLabel: 'MDD / XML contents',
  accept: '.mdd,.xml,.zip,text/xml,text/plain',
  submitLabel: 'Parse MDD',
});

export const SpsTranslateDialog = wrap({
  title: 'SPS Translate',
  description:
    'Translate SPSS .sps syntax into Tensr ops where supported; unsupported commands are refused by name.',
  endpoint: '/datasets/sps/translate',
  bodyKey: 'syntax',
  primaryLabel: '.sps syntax',
  accept: '.sps,text/plain',
  submitLabel: 'Translate',
});

export const QuantumAxisDialog = wrap({
  title: 'Quantum Axis',
  description:
    'Map Quantum axis/tab lines into a TableSpec review queue. This is not a Quantum runtime — unmapped lines stay in the queue.',
  endpoint: '/datasets/quantum/axis',
  bodyKey: 'axis',
  primaryLabel: 'Axis / tab syntax',
  accept: '.axis,.txt,text/plain',
  submitLabel: 'Parse axis',
});
