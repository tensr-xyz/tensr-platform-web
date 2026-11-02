/** Paper get_jsx for 1b · Projects · table. format tailwind, includeNodeIds false, node 6E7-0. */
export const paperNodeId = '6E7-0';

export function PaperProjectsTable() {
  return (
    <div className="[font-synthesis:none] wrap-anywhere text-[12px] leading-4 flex overflow-clip w-360 h-225 font-sans bg-canvas antialiased">
      <div className="w-58 shrink-0 flex flex-col py-3.5 px-2.5 gap-4.5 self-stretch h-225 bg-well border-r border-r-solid border-r-line">
        <div className="flex items-center justify-between py-1 px-2">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center shrink-0 rounded-sm bg-ink size-6" />
            <div className="text-[14px] tracking-[-0.01em] font-[600] leading-4.5 text-ink">
              Tensr
            </div>
            <div className="text-[13px] leading-4 text-muted">· Skopos</div>
          </div>
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center p-2 rounded-[8px] gap-2.5 bg-canvas border border-solid border-line">
            <div className="text-[14px] grow font-[500] leading-4.5 text-ink">New project</div>
            <div className="text-[11px] leading-3.5 text-muted">⌘N</div>
          </div>
          <div className="flex items-center p-2 rounded-[8px] gap-2.5 bg-[#ECECE7]">
            <div className="text-[14px] grow font-[500] leading-4.5 text-ink">Home</div>
          </div>
        </div>
      </div>
      <div className="grow basis-[0%] min-w-0 flex flex-col py-11 px-14 gap-5.5">
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-1">
            <div className="text-[13px] leading-4 text-muted">Skopos workspace</div>
            <div className="text-[30px] tracking-[-0.02em] font-[600] leading-9 text-ink">
              Projects
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex p-0.5 rounded-[8px] bg-well">
            <div className="py-1 px-2.5">
              <div className="text-[13px] leading-4 text-muted">Cards</div>
            </div>
            <div className="py-1 px-2.5 rounded-sm bg-canvas">
              <div className="text-[13px] font-[500] leading-4 text-ink">Table</div>
            </div>
          </div>
          <div className="py-1 px-2.5 rounded-sm bg-well">
            <div className="text-[13px] font-[500] leading-4 text-ink">Active</div>
          </div>
        </div>
        <div className="flex flex-col rounded-[12px] overflow-clip border border-solid border-line">
          <div className="flex items-center py-2.5 px-4.5 gap-4 bg-well border-b border-b-solid border-b-line">
            <div className="grow text-[12px] leading-4 text-muted">Project</div>
            <div className="w-37.5 shrink-0 text-[12px] leading-4 text-muted">Folder</div>
            <div className="w-30 shrink-0 text-[12px] leading-4 text-muted">Status</div>
            <div className="w-45 shrink-0 text-[12px] leading-4 text-muted">Responses</div>
            <div className="w-15 shrink-0 text-[12px] leading-4 text-muted">People</div>
            <div className="w-25 shrink-0 text-right text-[12px] leading-4 text-muted">
              Edited ↓
            </div>
          </div>
          <div className="flex items-center py-3 px-4.5 gap-4 border-b border-b-solid border-b-line">
            <div className="grow min-w-0 flex flex-col gap-px">
              <div className="text-[14px] font-[500] leading-4.5 text-ink">Brand tracker W4</div>
              <div className="text-[12px] leading-4 text-muted">Tracker · wave 4 of 6</div>
            </div>
            <div className="w-37.5 shrink-0 flex items-center gap-1.5">
              <div className="rounded-[2px] shrink-0 bg-accent size-2" />
              <div className="text-[13px] leading-4 text-ink">Octavia Energy</div>
            </div>
            <div className="w-30 shrink-0">
              <div className="py-0.5 px-2 rounded-[999px] bg-accent-soft">
                <div className="text-[12px] font-[500] leading-4 text-accent">Fielding</div>
              </div>
            </div>
            <div className="w-45 shrink-0 text-[12px] leading-4 text-ink">312 / 400</div>
            <div className="w-15 shrink-0 text-[12px] leading-4 text-muted">OD, MK</div>
            <div className="w-25 shrink-0 text-right text-[12px] leading-4 text-muted">
              12 min ago
            </div>
          </div>
          <div className="flex items-center py-3 px-4.5 gap-4">
            <div className="grow min-w-0">
              <div className="text-[14px] font-[500] leading-4.5 text-ink">App pricing study</div>
            </div>
            <div className="w-37.5 shrink-0 text-[13px] leading-4 text-ink">Halden Bank</div>
            <div className="w-30 shrink-0">
              <div className="py-0.5 px-2 rounded-[999px] border border-solid border-line">
                <div className="text-[12px] font-[500] leading-4 text-muted">Draft</div>
              </div>
            </div>
            <div className="w-45 shrink-0 text-[12px] leading-4 text-muted">
              Not fielded · target 500
            </div>
            <div className="w-15 shrink-0 text-[12px] leading-4 text-muted">OD</div>
            <div className="w-25 shrink-0 text-right text-[12px] leading-4 text-muted">
              3 days ago
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
