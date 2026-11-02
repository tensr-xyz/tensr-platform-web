/** Paper get_jsx for 2 · Project · Chat. format tailwind, includeNodeIds false, node 22B-0. */
export const paperNodeId = '22B-0';

export function PaperChat() {
  return (
    <div className="flex flex-col pb-3 px-3 bg-[#F1F1EE] w-360 h-225">
      <div className="flex items-center justify-between h-9">
        <div className="flex items-center gap-3">
          <div className="text-[15px] font-[500] text-ink">Brand tracker W4</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 px-2.5 rounded-[8px] bg-canvas border border-line text-[13px] text-muted">
            Search analyses ⌘K
          </div>
          <div className="h-8 px-3 rounded-[8px] bg-canvas border border-line text-[13px]">
            Fielding on Prolific
          </div>
          <div className="h-8 px-3 rounded-[8px] bg-canvas border border-line">Share</div>
          <div className="h-8 px-3.5 rounded-[8px] bg-ink text-canvas">Export</div>
        </div>
      </div>
      <div className="flex gap-0.5">
        <div className="py-1.75 px-3.5 rounded-[8px] bg-canvas border border-line">Chat</div>
        <div className="py-1.75 px-3.5 text-muted">Details</div>
      </div>
      <div className="grow flex rounded-[14px] overflow-clip bg-canvas border border-line">
        <div className="w-55 border-r border-line">
          <div className="p-2 rounded-[8px] border border-line">New chat</div>
        </div>
        <div className="grow flex flex-col items-center">
          <div className="max-w-160 flex pr-2 pl-3 rounded-[14px] border border-line">
            <div className="text-muted">Ask a follow-up…</div>
            <div className="flex p-0.5 rounded-[7px] bg-well">
              <div>Ask</div>
              <div>Plan</div>
              <div className="bg-canvas">Agent</div>
            </div>
          </div>
        </div>
        <div className="w-140 border-l border-line">
          <div className="text-[13px] font-[500]">T1 Awareness × region</div>
        </div>
      </div>
    </div>
  );
}
