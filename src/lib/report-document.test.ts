import {
  PAGE_ASPECT,
  PAGE_HEIGHT_IN,
  PAGE_WIDTH_IN,
  bringObjectForward,
  documentFromPins,
  duplicatePage,
  frameForSlot,
  groupPagesIntoSection,
  inchesFrame,
  moveObject,
  normalizeReportDocument,
  pagesForExport,
  placeObjectInSlot,
  reorderPages,
  reportDocumentForApi,
  setPageHidden,
  sortPages,
} from './report-document';

const pins = [
  {
    id: 'pin-alpha',
    runId: 'run-1',
    headline: 'Alpha finding',
    support: 'Alpha rose.',
    bars: [{ label: 'Alpha', percent: 42 }],
    deck: true,
    keepLive: true,
  },
  {
    id: 'pin-beta',
    runId: 'run-2',
    headline: 'Beta finding',
    support: 'Beta held steady.',
    bars: [],
    deck: false,
  },
  {
    id: 'pin-gamma',
    runId: 'run-3',
    headline: 'Gamma finding',
    support: 'Gamma dropped.',
    bars: [{ label: 'Gamma', percent: 11 }],
    deck: true,
  },
];

describe('report document page model', () => {
  it('uses widescreen 16:9 and layout slot frames', () => {
    expect(PAGE_ASPECT).toBe('16:9');
    expect(Math.abs(PAGE_WIDTH_IN / PAGE_HEIGHT_IN - 16 / 9)).toBeLessThan(0.01);
    const title = frameForSlot('title_and_content', 'title');
    const content = frameForSlot('title_and_content', 'content');
    expect(title && content && title.y < content.y).toBe(true);
    expect(frameForSlot('blank', 'title')).toBeNull();
    expect(inchesFrame(title!).w).toBeGreaterThan(1);
  });

  it('builds live pages from pins and hides deck:false from export', () => {
    const doc = documentFromPins(pins);
    expect(doc.pages).toHaveLength(3);
    expect(doc.pages[0]?.layoutId).toBe('title_and_content');
    expect(doc.pages[0]?.objects.map(obj => obj.kind)).toEqual(['text', 'chart']);
    expect(doc.pages[0]?.objects[1]?.pinId).toBe('pin-alpha');
    expect(doc.pages[0]?.objects[1]?.runId).toBe('run-1');
    expect(pagesForExport(doc).map(page => page.title)).toEqual(['Alpha finding', 'Gamma finding']);
    expect(doc.pages[1]?.objects.map(obj => obj.kind)).toEqual(['text', 'text']);
  });

  it('reorders, duplicates, groups, sorts, and moves objects', () => {
    const doc = documentFromPins(pins);
    const ids = doc.pages.map(page => page.id);
    const reordered = reorderPages(doc, [ids[2]!, ids[0]!, ids[1]!]);
    expect(reordered.pages.map(page => page.title)).toEqual([
      'Gamma finding',
      'Alpha finding',
      'Beta finding',
    ]);
    const duped = duplicatePage(reordered, ids[2]!);
    expect(duped.pages).toHaveLength(4);
    expect(duped.pages[1]?.title).toBe('Gamma finding (copy)');
    const grouped = groupPagesIntoSection(duped, [ids[0]!, ids[1]!], 'Insights');
    expect(grouped.pages[2]?.section).toBe('Insights');
    expect(sortPages(doc).pages[0]?.title).toBe('Alpha finding');

    const page = doc.pages[0]!;
    const chart = page.objects.find(obj => obj.kind === 'chart')!;
    const moved = moveObject(doc, page.id, chart.id, { x: 0.1, y: 0.2, w: 0.5, h: 0.4 });
    expect(moved.pages[0]?.objects.find(obj => obj.id === chart.id)?.slotId).toBeNull();
    const slotted = placeObjectInSlot(moved, page.id, chart.id, 'content');
    expect(slotted.pages[0]?.objects.find(obj => obj.id === chart.id)?.frame).toEqual(
      frameForSlot('title_and_content', 'content')
    );
    const raised = bringObjectForward(slotted, page.id, chart.id);
    expect(
      raised.pages[0]?.objects.find(obj => obj.id === chart.id)?.zIndex
    ).toBeGreaterThanOrEqual(3);
  });

  it('serialises snake_case for the deck export API', () => {
    const fresh = documentFromPins(pins);
    const hidden = setPageHidden(fresh, fresh.pages[0]!.id, { hideFromPublish: true });
    const payload = reportDocumentForApi(hidden);
    expect(payload.aspect).toBe('16:9');
    expect(Array.isArray(payload.pages)).toBe(true);
    const first = (payload.pages as Record<string, unknown>[])[0];
    expect(first?.hide_from_publish).toBe(true);
    expect(first?.layout_id).toBe('title_and_content');
    expect(
      normalizeReportDocument({
        pages: [
          {
            layoutId: 'two_content',
            objects: [{ kind: 'table', slotId: 'content_left' }],
          },
        ],
      }).pages[0]?.objects[0]?.frame
    ).toEqual(frameForSlot('two_content', 'content_left'));
  });
});
