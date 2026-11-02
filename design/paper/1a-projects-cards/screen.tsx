/** Paper get_jsx for 1a · Projects · cards. format tailwind, includeNodeIds false, node 68F-0. */
export const paperNodeId = '68F-0';

export function PaperProjectsCards() {
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
          <div className="flex items-center p-2 rounded-[8px] gap-2.5">
            <div className="text-[14px] grow leading-4.5 text-ink">Search</div>
            <div className="text-[11px] leading-3.5 text-muted">⌘K</div>
          </div>
          <div className="flex items-center p-2 rounded-[8px] gap-2.5 bg-[#ECECE7]">
            <div className="text-[14px] grow font-[500] leading-4.5 text-ink">Home</div>
          </div>
          <div className="flex items-center h-8.5 px-2 rounded-[7px] gap-2.5">
            <div className="grow text-[14px] leading-4.5 text-ink">Datasets</div>
            <div className="text-[12px] leading-4 text-muted">12</div>
          </div>
          <div className="flex items-center p-2 rounded-[8px] gap-2.5">
            <div className="text-[14px] grow leading-4.5 text-ink">Plugins</div>
          </div>
        </div>
        <div className="flex flex-col gap-0.5 grow">
          <div className="flex items-center justify-between pt-1 pb-1.5 px-2">
            <div className="text-[12px] font-[500] leading-4 text-muted">Folders</div>
          </div>
          <div className="flex items-center py-1.75 px-2 rounded-[8px] gap-2.5">
            <div className="shrink-0 rounded-[2px] bg-accent size-2" />
            <div className="text-[14px] grow leading-4.5 text-ink">Octavia Energy</div>
          </div>
        </div>
        <div className="flex items-center pt-3.5 pb-2 gap-2.5 px-2 border-t border-t-solid border-t-line">
          <div className="flex items-center justify-center rounded-[14px] shrink-0 bg-[#D9E6E0] size-7">
            <div className="text-[12px] font-[600] leading-4 text-accent">OD</div>
          </div>
          <div className="flex flex-col grow gap-px">
            <div className="text-[13px] font-[500] leading-4 text-ink">Ollie Darby</div>
            <div className="text-[12px] leading-4 text-muted">Pro · 30-day trial</div>
          </div>
        </div>
      </div>
      <div className="grow min-w-0 flex flex-col py-11 px-14 gap-5.5">
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-1">
            <div className="text-[13px] leading-4 text-muted">Skopos workspace</div>
            <div className="text-[30px] tracking-[-0.02em] font-[600] leading-9 text-ink">
              Projects
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center w-55 h-9 px-3 rounded-[8px] gap-2 border border-solid border-line">
              <div className="text-[13px] leading-4 text-muted">Search projects</div>
            </div>
            <div className="flex items-center h-9 px-3.5 rounded-[8px] bg-ink">
              <div className="text-[13px] font-[500] leading-4 text-canvas">+ New project</div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="w-[calc(33.33%-11px)] flex flex-col p-5 rounded-[14px] gap-4 bg-canvas border border-solid border-line">
            <div className="text-[18px] tracking-[-0.01em] font-[600] leading-5.5 text-black">
              Brand tracker W4
            </div>
          </div>
          <div className="w-[calc(33.33%-11px)] flex flex-col items-center justify-center p-5 rounded-[14px] gap-2 bg-well border border-dashed border-line">
            <div className="text-[15px] font-[500] leading-4.5 text-black">New project</div>
            <div className="text-[13px] text-center leading-4 text-muted">
              Recruit on Prolific, sync Qualtrics or drop in a .sav
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
