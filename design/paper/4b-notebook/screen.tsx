/** Paper get_jsx for 4b · Notebook. format tailwind, includeNodeIds false, node 5ER-0. */
export const paperNodeId = '5ER-0';

/** Sample crosstab letters, the ordinal coefficients, and 2,406 rows stay in Paper. */
export function PaperNotebook() {
  return (
    <div className="flex grow bg-canvas">
      <div className="w-56">
        <div>Find variable</div>
        <div>Q20 switch</div>
        <div>Saved analyses</div>
      </div>
      <div className="grow">
        <div>Sheet</div>
        <div className="font-[500]">Notebook</div>
        <div className="bg-ink text-canvas">Run all</div>
        <div>+ Code</div>
        <div>+ Text</div>
        <div>df uses region ≠ N. Ireland</div>
        <div>Python 3.12</div>
        <div className="text-[18px] font-[500]">Q20 drivers, ordinal model</div>
        <div>import tensr as ts</div>
        <div>t1 = ts.crosstab(...) North East 38% B</div>
        <div>OrderedModel Coef. -0.018</div>
        <div>Added to Tables as T15</div>
      </div>
    </div>
  );
}
