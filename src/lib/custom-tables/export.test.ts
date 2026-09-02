import { exportAuditCopy, exportTraceFromBook } from './export';

describe('banner office export trace', () => {
  it('carries weight identity and three-state trace from the book', () => {
    const trace = exportTraceFromBook({
      weight_vector: { identity: 'abc123', method: 'rake', explicit_null: false },
      provenance: { row_uid_bitset: 'BQ==', row_uid_bitset_miss_count: 0 },
    });
    expect(trace.identity).toBe('abc123');
    expect(trace.kind).toBe('complete');
    expect(trace.excelIsAuditRecord).toBe(true);
    expect(trace.pptIsAuditRecord).toBe(false);
  });

  it('marks explicit null weight as unweighted identity', () => {
    const trace = exportTraceFromBook({
      weight_vector: { explicit_null: true },
      provenance: {},
    });
    expect(trace.identity).toBe('explicit_null');
    expect(trace.kind).toBe('unknown');
  });

  it('says Excel stands alone and PPT does not', () => {
    expect(exportAuditCopy.xlsx.toLowerCase()).toMatch(/audit/);
    expect(exportAuditCopy.pptx.toLowerCase()).toMatch(/not an audit/);
    expect(exportAuditCopy.pptx.toLowerCase()).toMatch(/notes/);
  });
});
