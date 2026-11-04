/** Paper get_jsx for 3 · Sources. format tailwind, includeNodeIds false, node 288-0. */
export const paperNodeId = '288-0';

/** Sample completes, quotas, Qualtrics sync, and named waves stay in Paper. */
export function PaperSources() {
  return (
    <div className="w-240 flex flex-col py-9 gap-7 bg-canvas">
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="text-[26px] tracking-[-0.02em] font-[500] leading-8 text-ink">
            Sources
          </div>
          <div className="text-[14px] leading-4.5 text-muted">
            Where this project's data comes from. Tensr reads from your survey and panel tools, it
            doesn't replace them.
          </div>
        </div>
        <div className="h-9 px-3.5 rounded-[8px] bg-ink text-canvas font-[500]">
          + Connect source
        </div>
      </div>
      <div className="flex rounded-[14px] overflow-clip border border-line">
        <div className="grow flex flex-col py-5.5 px-6 gap-5">
          <div className="font-[500]">Prolific · W5 sample</div>
          <div className="text-[12px] font-[500] text-accent">Fielding</div>
          <div className="text-[34px] font-[500]">312</div>
          <div className="text-muted">of 400 completes · about 3 hours left</div>
          <div>Median time 11m 40s · Screened out 48 · 9 speeders · £374</div>
        </div>
        <div className="w-80 bg-well">
          London 58 / 60 · North 71 / 90 · Midlands 62 / 70 · South 94 / 120 · Scotland 27 / 60
        </div>
      </div>
      <div className="font-[500]">Connected</div>
      <div>Qualtrics · W5 survey · Survey and labels synced · 4 min ago</div>
      <div>W4_final.sav · Uploaded · 2,406 rows · last wave</div>
      <div className="font-[500]">Connect a source</div>
      <div>Prolific · Qualtrics · Decipher / Alchemer · Upload file · More connectors</div>
      <div className="font-[500]">Datasets</div>
      <div className="text-muted">
        Join or stack two files, fuse three or more. Export any as .sav with an .sps weight file.
      </div>
      <div className="bg-accent-soft">W4 + W5 weighted · 4,812 rows · In use</div>
      <div>W4 + W5 stacked · Review mapping</div>
      <div>W5 · Qualtrics · Open</div>
      <div>W4_final.sav · Raw upload · Open</div>
      <div className="font-[500]">Context</div>
      <div className="text-[10px] font-[600]">PDF</div>
      <div>W5 questionnaire · Client brief · W3 client report · + Add</div>
    </div>
  );
}
