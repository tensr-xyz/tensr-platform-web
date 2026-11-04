/** Paper get_jsx for 3c · Interviews. format tailwind, includeNodeIds false, node 17DV-0. */
export const paperNodeId = '17DV-0';

/** Sample speakers, durations, the 24% survey figure, and the agent summary stay in Paper. */
export function PaperInterviews() {
  return (
    <div className="flex grow bg-canvas">
      <div className="w-61 bg-well">
        <div className="text-muted">Search 12 interviews</div>
        <div>05 · Tom, 44 · 38m · Price</div>
        <div className="font-[500]">07 · Priya, 27 · 51m · Bill trust</div>
        <div className="font-[500]">+ Add transcripts</div>
        <div className="text-muted">.docx .txt .vtt or audio</div>
      </div>
      <div className="grow">
        <div>← Sources</div>
        <div className="text-accent">Codes shown · Q22 frame</div>
        <div>Only Priya</div>
        <div>12:41 / 51:08</div>
        <div className="text-[24px] font-[600]">Priya, 27 · renting in Hackney, on E.ON</div>
        <div>12:24 Priya · Bill clarity / trust</div>
        <div className="text-warn">Moving house? Accept Skip</div>
        <div>Price is the trigger, but trust is the reason.</div>
      </div>
      <div className="w-80">
        <div className="font-[500]">Evidence</div>
        <div className="text-[30px] font-[600]">24%</div>
        <div>of the survey say this</div>
        <div>Play clip</div>
        <div className="bg-ink text-canvas">Cite in report</div>
      </div>
    </div>
  );
}
