/** Paper get_jsx for 1e · Publish a plugin. format tailwind, includeNodeIds false, node 1E37-0. */
export const paperNodeId = '1E37-0';

export function PaperPublishPlugin() {
  return (
    <div className="[font-synthesis:none] text-[12px] leading-4 flex w-360 h-225 font-sans bg-canvas">
      <div className="grow flex flex-col py-10 px-12 gap-5">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[12px] tracking-[0.04em] leading-4 text-muted">
              PLUGINS / AUTHOR
            </div>
            <div className="text-[30px] font-[500] leading-9 text-ink">Publish a plugin</div>
            <div className="text-[14px] leading-4.5 text-muted">
              Write it in Python, R, JavaScript or TypeScript. Once approved it shows up in ⌘K and
              the agent can call it.
            </div>
          </div>
          <div className="py-2 px-3.5 rounded-[8px] bg-ink">
            <div className="text-[13px] font-[500] leading-4 text-canvas">Submit for review</div>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="w-48">
            <div className="text-[13px] leading-4 text-muted">Your plugins</div>
            <div className="text-[14px] font-[500] text-ink">Survey nets toolkit</div>
            <div className="text-[12px] text-muted">v1.2 · Python · Published</div>
          </div>
          <div className="grow flex flex-col gap-3">
            <div className="text-[14px] font-[500] text-ink">Manifest</div>
            <div className="text-[13px] text-ink">Bayesian A/B</div>
            <div className="text-[13px] text-muted">0.3.0</div>
            <div className="flex gap-2">
              <div className="py-1 px-2.5 rounded-[999px] border border-solid border-line">
                Python
              </div>
              <div className="py-1 px-2.5 rounded-[999px] border border-solid border-line">
                TypeScript
              </div>
            </div>
          </div>
          <div className="w-56 flex flex-col gap-3">
            <div className="text-[13px] text-ink">Review · v0.3.0</div>
            <div className="text-[12px] text-muted">Static scan passed</div>
            <div className="text-[12px] text-muted">312 installs · £186 this month</div>
          </div>
        </div>
      </div>
    </div>
  );
}
