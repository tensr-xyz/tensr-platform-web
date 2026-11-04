/** Paper get_jsx for 4f · Run ANOVA modal. format tailwind, includeNodeIds false, node CJO-0. */
export const paperNodeId = 'CJO-0';

/** Sample brands, Welch's F, and the Games-Howell pairs stay in Paper. */
export function PaperAnova() {
  return (
    <div className="flex flex-col bg-canvas">
      <div className="text-[18px] font-[600]">One-way ANOVA</div>
      <div>Q8 satisfaction (0 to 10)</div>
      <div>Q3 unaided brand</div>
      <div>Games-Howell</div>
      <div className="text-warn">
        Switched for you. Levene's test says variances differ (p = .03)
      </div>
      <div>Satisfaction differs by brand, Welch's F(3, 1,042) = 18.4, p &lt; .001, η² = .03.</div>
      <div>Octavia 412 7.6 1.8</div>
      <div>Between groups 498.2 18.4</div>
      <div>oneway.test(Q8 ~ Q3, data = w4, var.equal = FALSE)</div>
    </div>
  );
}
