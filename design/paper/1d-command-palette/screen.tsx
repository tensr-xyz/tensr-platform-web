/** Paper get_jsx for 1d · ⌘K palette. format tailwind, includeNodeIds false, node 3IP-0. */
export const paperNodeId = '3IP-0';

export function PaperCommandPalette() {
  return (
    <div className="bg-[#1B1C1A]/40 flex items-start justify-center pt-16 w-360 h-225">
      <div className="w-[760px] rounded-[16px] bg-canvas border border-solid border-line overflow-clip">
        <div className="px-4 py-3 text-[14px] text-ink">maxdiff</div>
        <div className="flex gap-2 px-3 py-2 border-b border-solid border-line">
          <div className="text-[13px] text-muted">Data</div>
          <div className="py-1 px-2.5 rounded-sm bg-well text-[13px] font-[500] text-ink">
            Analyze
          </div>
          <div className="text-[13px] text-muted">Plugins 3</div>
        </div>
        <div className="flex min-h-[280px]">
          <div className="w-44 border-r border-solid border-line p-2">
            <div className="py-1.5 px-2 rounded-sm bg-accent-soft text-[13px] text-ink">
              Survey techniques
            </div>
            <div className="py-1.5 px-2 text-[13px] text-ink">Tables</div>
          </div>
          <div className="grow p-3 flex flex-col gap-2">
            <div className="text-[12px] text-muted">Best match</div>
            <div className="text-[14px] font-[500] text-ink">MaxDiff · Hierarchical Bayes</div>
            <div className="text-[12px] text-muted">From plugins · MaxDiff anchored scaling</div>
          </div>
        </div>
        <div className="flex justify-between px-4 py-2 border-t border-solid border-line text-[12px] text-muted">
          <div>↑↓ navigate · Enter open dialog · ⌘Enter ask the agent</div>
          <div>Runs on Brand tracker W4 · 2,400 rows</div>
        </div>
      </div>
    </div>
  );
}
