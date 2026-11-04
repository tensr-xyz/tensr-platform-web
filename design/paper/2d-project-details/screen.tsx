/** Paper get_jsx for 2d · Project details. format tailwind, includeNodeIds false, node 1F4C-0. */
export const paperNodeId = '1F4C-0';

export function PaperProjectDetails() {
  return (
    <div className="flex flex-col pb-3 px-3 bg-[#F1F1EE] w-360 h-225">
      <div className="flex items-center justify-between h-9">
        <div className="text-[15px] font-[500] text-ink">Brand tracker W4</div>
        <div className="h-8 px-3 rounded-[8px] border border-line text-[13px]">
          Fielding on Prolific · 312 / 400
        </div>
      </div>
      <div className="flex gap-0.5">
        <div className="py-1.75 px-3.5 text-muted">Chat</div>
        <div className="py-1.75 px-3.5 rounded-[8px] bg-canvas border border-line font-[500]">
          Details
        </div>
      </div>
      <div className="grow flex flex-col rounded-[14px] overflow-clip bg-canvas border border-line">
        <div className="flex items-center justify-between px-7 py-3 border-b border-line">
          <div className="text-[18px] font-[600]">Project brief</div>
          <div className="text-[12px] text-muted">Edited by Oliver · 2 days ago</div>
          <div className="text-[12px] text-accent">
            The agent uses this brief as context in every chat
          </div>
          <div className="text-[13px]">Edit brief</div>
        </div>
        <div className="flex grow min-h-0">
          <div className="grow px-7 py-6 flex flex-col gap-6">
            <div className="flex gap-10">
              <div>
                <div className="text-[12px] text-muted">Objectives</div>
                <div className="font-[600] text-accent">1</div>
                <div>Track unaided and prompted awareness of the six main UK energy suppliers.</div>
              </div>
              <div>
                <div className="text-[12px] text-muted">Audience</div>
                <div>UK adults 18+ who are the bill payer. Weighted to ONS.</div>
                <div className="bg-well text-[12px]">Excl. N. Ireland</div>
              </div>
            </div>
            <div>Fieldwork · W5 · Prolific · 400 completes · 312 / 400</div>
            <div>Questionnaire outline · 22 questions · Linked to W4_final.sav</div>
          </div>
          <div className="w-70 border-l border-line p-4">
            <div className="text-[12px] text-muted">Waves</div>
            <div>W4 · Oct 2026 · n = 2,481</div>
            <div className="text-[12px] text-muted">Client and deliverables</div>
            <div>Northgate Energy · Client deck · Banner book · Topline</div>
            <div className="text-[12px] text-muted">Team</div>
            <div>Oliver D · Project lead</div>
          </div>
        </div>
      </div>
    </div>
  );
}
