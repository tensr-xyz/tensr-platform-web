/** Paper get_jsx for 1c · Plugins. format tailwind, includeNodeIds false, node 3IQ-0. */
export const paperNodeId = '3IQ-0';

export function PaperPlugins() {
  return (
    <div className="[font-synthesis:none] wrap-anywhere text-[12px] leading-4 flex overflow-clip w-360 h-225 font-sans bg-canvas antialiased">
      <div className="grow flex flex-col py-10 px-12 gap-6">
        <div className="flex items-end gap-4">
          <div className="grow flex flex-col gap-1.5">
            <div className="text-[12px] tracking-[0.04em] leading-4 text-muted">
              PLUGIN MARKETPLACE
            </div>
            <div className="text-[30px] tracking-[-0.02em] font-[500] leading-9 text-ink">
              Plugins
            </div>
            <div className="text-[14px] leading-4.5 text-muted">
              Add methods and checks your team uses. They show up in ⌘K, the agent can call them,
              and every run stays traceable.
            </div>
          </div>
          <div className="py-2 px-3.5 rounded-[8px] border border-solid border-line">
            <div className="text-[13px] leading-4 text-ink">My plugins · 3</div>
          </div>
          <div className="py-2 px-3.5 rounded-[8px] bg-ink">
            <div className="text-[13px] font-[500] leading-4 text-canvas">+ Publish</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center w-80 h-8.5 px-3 rounded-[8px] border border-solid border-line">
            <div className="text-[13px] leading-4 text-muted">Search plugins</div>
          </div>
          <div className="py-1.5 px-3 rounded-[999px] bg-ink">
            <div className="text-[13px] leading-4 text-canvas">All</div>
          </div>
          <div className="py-1.5 px-3 rounded-[999px] border border-solid border-line">
            <div className="text-[13px] leading-4 text-ink">Cleaning</div>
          </div>
          <div className="py-1.5 px-3 rounded-[999px] border border-solid border-line">
            <div className="text-[13px] leading-4 text-ink">Your team</div>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="grow flex flex-col p-5 rounded-[14px] gap-3.5 bg-accent-soft">
            <div className="text-[11px] font-[500] leading-3.5 text-accent">Editor&apos;s pick</div>
            <div className="text-[20px] font-[500] leading-6 text-ink">Column Summary</div>
            <div className="text-[12px] leading-4 text-muted">★ 4.8 · 1.2k installs</div>
            <div className="text-[12px] font-[500] leading-4 text-canvas">Installed</div>
          </div>
          <div className="grow flex flex-col p-5 rounded-[14px] gap-3.5 bg-[#F3ECE0]">
            <div className="text-[11px] font-[500] leading-3.5 text-warn">Your team</div>
            <div className="text-[20px] font-[500] leading-6 text-ink">
              MaxDiff anchored scaling
            </div>
            <div className="text-[12px] leading-4 text-muted">v1.3 · Used in 4 projects</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="w-[calc(33.33%-11px)] flex flex-col p-4 rounded-[12px] gap-2 border border-solid border-line">
            <div className="text-[15px] font-[500] leading-4.5 text-ink">
              Speeder &amp; straightliner flag
            </div>
            <div className="text-[12px] leading-4 text-muted">Cleaning · ★ 4.7 · 860</div>
            <div className="text-[12px] font-[500] leading-4 text-accent">Install</div>
          </div>
        </div>
      </div>
    </div>
  );
}
