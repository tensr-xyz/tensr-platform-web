/** Paper get_jsx for 2c · Chat agent made an output. format tailwind, includeNodeIds false, node 1EO8-0. */
export const paperNodeId = '1EO8-0';

export function PaperChatOutput() {
  return (
    <div className="flex overflow-clip w-360 h-225 flex-col pb-3 px-3 bg-[#F1F1EE]">
      <div className="flex grow min-h-0 rounded-[14px] overflow-clip bg-canvas border border-line">
        <div className="flex flex-col shrink-0 w-55 py-3.5 px-2.5 border-r border-line">
          <div className="flex p-2 rounded-[8px] gap-2 border border-line">New chat</div>
          <div className="pt-3.5 px-2 text-[12px] text-muted">Today</div>
          <div className="py-1.75 px-2 rounded-[7px] bg-well text-[13px] font-[500]">
            Satisfaction by brand
          </div>
          <div className="pt-3.5 px-2 text-[12px] text-muted">Recipes</div>
        </div>
        <div className="flex flex-col items-center grow min-w-0">
          <div className="flex flex-col grow max-w-170 w-full min-h-0 pt-6 px-7 gap-4.5">
            <div className="flex justify-end">
              <div className="max-w-110 py-2.5 px-3.5 rounded-[14px] bg-well text-[14px]">
                Compare satisfaction across brands
              </div>
            </div>
            <div className="text-[13px] text-muted">Ran 6 steps · created 1 output</div>
            <div className="text-[15px] leading-6">
              Satisfaction differs by brand in W4. Octavia leads, and the gap held from W3.
            </div>
            <div className="flex flex-col py-3 px-3.5 rounded-[12px] gap-3 border border-accent">
              <div className="flex items-center gap-3">
                <div className="text-[14px] font-[500]">Q8 satisfaction by brand</div>
                <div className="text-[12px] font-[500] text-accent">Viewing</div>
              </div>
              <div className="flex gap-1.5">
                <div className="py-1.5 px-3 rounded-[8px] bg-ink text-canvas">Open</div>
                <div className="py-1.5 px-2.5 rounded-[8px] border border-line">Add to report</div>
                <div className="py-1.5 px-2.5 rounded-[8px] border border-line">Download</div>
              </div>
            </div>
          </div>
          <div className="flex gap-1.5 px-5">
            <div className="py-1.5 px-2.5 rounded-[999px] border border-line">Split by tenure</div>
          </div>
        </div>
        <div className="flex flex-col w-110 shrink-0 border-l border-line">
          <div className="flex flex-col pt-4 pb-3.5 gap-2 px-5 border-b border-line">
            <div className="py-0.5 px-1.5 rounded-[4px] bg-accent-soft text-accent">ANOVA</div>
            <div className="text-[18px] font-[600]">Q8 satisfaction by brand</div>
          </div>
          <div className="flex flex-col grow py-4 px-5 gap-3.5">
            <div className="py-3 px-3.5 rounded-md bg-accent-soft text-[14px]">
              Octavia customers are the most satisfied.
            </div>
            <div className="text-[12px] text-muted">Key stat</div>
            <div className="text-[12px] text-muted">Export</div>
          </div>
          <div className="flex items-center py-3 px-5 gap-2 border-t border-line">
            <div className="py-1.75 px-3 rounded-[7px] border border-line">Save</div>
            <div className="py-1.75 px-3 rounded-[7px] border border-line">Add to report</div>
            <div className="py-1.75 px-3.5 rounded-[7px] bg-ink text-canvas">Open</div>
          </div>
        </div>
      </div>
    </div>
  );
}
