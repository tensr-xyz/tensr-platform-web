/** Paper get_jsx for 2b · Chat empty. format tailwind, includeNodeIds false, node 1DY1-0. */
export const paperNodeId = '1DY1-0';

export function PaperChatEmpty() {
  return (
    <div className="flex flex-col pb-3 px-3 bg-[#F1F1EE] w-360 h-225">
      <div className="flex items-center justify-between h-9">
        <div className="text-[15px] font-[500] text-ink">Brand tracker W4</div>
        <div className="flex items-center gap-2">
          <div className="h-8 px-2.5 rounded-[8px] border border-line text-[13px] text-muted">
            Search analyses ⌘K
          </div>
          <div className="h-8 px-3 rounded-[8px] border border-line text-[13px]">
            Fielding on Prolific · 312 / 400
          </div>
          <div className="h-8 px-3 rounded-[8px] border border-line">Share</div>
          <div className="h-8 px-3.5 rounded-[8px] bg-ink text-canvas font-[500]">Export</div>
        </div>
      </div>
      <div className="flex gap-0.5">
        <div className="py-1.75 px-3.5 rounded-[8px] bg-canvas border border-line font-[500]">
          Chat
        </div>
        <div className="py-1.75 px-3.5 text-muted">Details</div>
        <div className="py-1.75 px-3.5 text-muted">Sources</div>
      </div>
      <div className="grow flex rounded-[14px] overflow-clip bg-canvas border border-line">
        <div className="w-55 flex flex-col py-3.5 px-2.5 border-r border-line">
          <div className="p-2 rounded-[8px] border border-line font-[500]">New chat</div>
          <div className="pt-3.5 pb-1.5 px-2 text-[12px] text-muted">Chats</div>
          <div className="flex flex-col py-3.5 px-3 rounded-[8px] gap-1 border border-dashed border-line">
            <div className="text-[13px]">No chats yet</div>
            <div className="text-[12px] text-muted">
              Your first question starts one. Every run is also kept in Outputs.
            </div>
          </div>
          <div className="pt-3.5 text-[12px] text-muted">Recipes</div>
          <div className="text-[13px]">Tracker tables · 6 steps</div>
          <div className="text-[13px]">Clean + weight · 4 steps</div>
          <div className="text-[12px] text-muted">Save any run as a recipe</div>
        </div>
        <div className="grow flex flex-col items-center justify-center px-10">
          <div className="max-w-205 flex flex-col items-center gap-9">
            <div className="text-[12px] font-[500] text-accent">Tensr agent</div>
            <div className="text-[34px] font-[600] text-center">What do you want to find out?</div>
            <div className="text-[15px] text-muted text-center">
              I've read Brand tracker W4: 2,481 respondents, 64 variables, weighted to UK nat rep.
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3.5 rounded-[12px] border border-line">
                <div className="font-[500]">Build the W4 banner book from last wave's spec</div>
                <div className="text-[12px] text-muted">Uses W3 banner · 18 tables</div>
              </div>
              <div className="p-3.5 rounded-[12px] border border-line">
                <div className="font-[500]">What moved since W3?</div>
                <div className="text-[12px] text-muted">Sig changes across key measures</div>
              </div>
              <div className="p-3.5 rounded-[12px] border border-line">
                <div className="font-[500]">Code Q22 open-ends</div>
                <div className="text-[12px] text-muted">1,104 answers · draft a codeframe</div>
              </div>
              <div className="p-3.5 rounded-[12px] border border-line">
                <div className="font-[500]">Check the weighting against ONS targets</div>
                <div className="text-[12px] text-muted">Region × gender × age · wt_natrep</div>
              </div>
              <div className="p-3.5 rounded-[12px] border border-line">
                <div className="font-[500]">Which drivers predict Q20 switching?</div>
                <div className="text-[12px] text-muted">Driver analysis · relative importance</div>
              </div>
              <div className="p-3.5 rounded-[12px] border border-line">
                <div className="font-[500]">Draft the topline summary</div>
                <div className="text-[12px] text-muted">One page · cites every number</div>
              </div>
            </div>
            <div className="w-full rounded-[14px] border border-line p-4 text-[15px] text-[#9A9A93]">
              Ask about W4, or describe what you need. Type @ to point at a variable, table or file
            </div>
            <div className="text-[12px] text-muted">
              Can also read · W3 project · The web · + Add source
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
