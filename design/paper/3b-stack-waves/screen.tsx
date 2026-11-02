/** Paper get_jsx for 3b · Stack waves. format tailwind, includeNodeIds false, node 93J-0. */
export const paperNodeId = '93J-0';

/** Sample question names, code diffs, and the 182 / 4 / 2 counts stay in Paper. */
export function PaperStackWaves() {
  return (
    <div className="w-180 rounded-[16px] bg-canvas border border-line p-6 flex flex-col gap-4">
      <div className="text-[18px] font-[500]">Stack W4 + W5</div>
      <div className="text-[13px] text-muted">
        Matched on resp_id. The agent pre-filled this from both questionnaires in Context, so you
        only need to check the exceptions.
      </div>
      <div className="flex gap-2 text-[12px]">
        <div>182 matched</div>
        <div>4 to check</div>
        <div>2 new in W5</div>
      </div>
      <div className="grid grid-cols-4 text-[12px] text-muted">
        <div>W4</div>
        <div>W5</div>
        <div>Why it is flagged</div>
        <div>Do this</div>
      </div>
      <div>Q20 switch · Q21 switch · Renamed in W5, same wording and codes · Treat as same</div>
      <div>Q3 unaided · Q3 unaided · W5 adds code 9 "Octavia Green" · Keep, W4 = 0</div>
      <div>region · region · N. Ireland is code 12 in W4, 11 in W5 · Recode W5 11 to 12</div>
      <div>Q15 satisfaction · Scale changed: 1–10 in W4, 1–5 in W5 · Keep separate</div>
      <div>— · Q30, Q31 · New questions in W5 · Add, W4 rows missing</div>
      <div className="text-accent">Show all 186 mappings</div>
      <div className="text-muted">Creates a new dataset, originals untouched</div>
      <div>Cancel</div>
      <div className="bg-ink text-canvas font-[500]">Stack waves</div>
    </div>
  );
}
