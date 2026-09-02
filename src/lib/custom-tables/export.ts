import { provenanceTraceKind, type TraceKind } from './click-through';

export const exportAuditCopy = {
  xlsx: 'Excel is the audit record. The provenance sheet carries bitsets, weight identity, and the convention tuple so the file stands alone.',
  pptx: 'PowerPoint is not an audit record. Convention is in the slide notes only.',
};

export type BannerExportBook = {
  weight_vector?: { identity?: string; method?: string; explicit_null?: boolean };
  provenance?: {
    row_uid_bitset?: string;
    row_uid_bitset_miss_count?: number;
    provenance_unavailable?: string;
    weight_vector?: { identity?: string; explicit_null?: boolean };
  };
};

export function exportTraceFromBook(book: BannerExportBook): {
  identity: string;
  kind: TraceKind;
  excelIsAuditRecord: true;
  pptIsAuditRecord: false;
} {
  const weight = book.weight_vector || book.provenance?.weight_vector || {};
  const identity =
    weight.explicit_null === true ? 'explicit_null' : String(weight.identity || 'explicit_null');
  return {
    identity,
    kind: provenanceTraceKind(book.provenance),
    excelIsAuditRecord: true,
    pptIsAuditRecord: false,
  };
}
