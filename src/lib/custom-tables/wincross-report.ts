import { canvasFromStoredSpec, defaultCanvas, type CustomTableCanvas } from './spec';

export type WincrossRefusal = {
  code?: string;
  reason?: string;
  hand_work?: string;
  raw?: string;
  gap?: string;
};

export type WincrossReportSurface = {
  tables_converted: Array<{ name?: string; stub?: string; notes?: string[] }>;
  tables_refused: Array<{
    name?: string;
    code?: string;
    reason?: string;
    hand_work?: string;
  }>;
  tables_converted_count: number;
  tables_refused_count: number;
  tables_total: number;
  construct_refusals?: WincrossRefusal[];
  glossary?: {
    aliases?: Record<string, string>;
    recodes?: Array<{ source_column?: string; mappings?: Record<string, string> }>;
    computes?: Array<{ target?: string; expr?: string }>;
    refused?: WincrossRefusal[];
  };
};

export type WincrossParseResult = {
  conversion?: {
    tables_converted?: number;
    tables_refused?: number;
    tables_total?: number;
    table_rate_percent?: number;
    rate_percent?: number;
  };
  report?: WincrossReportSurface;
  tables?: Array<{
    name?: string;
    ok?: boolean;
    spec?: Record<string, unknown>;
    refusals?: WincrossRefusal[];
    warnings?: WincrossRefusal[];
  }>;
};

export function wincrossHeadline(result: WincrossParseResult): string {
  const converted =
    result.report?.tables_converted_count ?? result.conversion?.tables_converted ?? 0;
  const total = result.report?.tables_total ?? result.conversion?.tables_total ?? 0;
  const pct = result.conversion?.table_rate_percent;
  const rate = pct == null ? '' : ` (${pct}%)`;
  return `${converted} of ${total} tables converted${rate}`;
}

export function canvasFromConvertedTable(
  table: NonNullable<WincrossParseResult['tables']>[number],
  current?: CustomTableCanvas
): CustomTableCanvas | null {
  if (!table?.ok || !table.spec) return null;
  return canvasFromStoredSpec(table.spec, current || defaultCanvas());
}

export function refusalCopy(item: WincrossRefusal | { reason?: string; hand_work?: string }): {
  reason: string;
  handWork: string;
} {
  return {
    reason: item.reason || 'This table did not convert.',
    handWork: item.hand_work || 'Rebuild this table in Custom Tables.',
  };
}
