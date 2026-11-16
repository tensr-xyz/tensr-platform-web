import {
  PAGE_ASPECT,
  PAGE_HEIGHT_IN,
  PAGE_WIDTH_IN,
  addPage,
  alignObjects,
  alignmentGuides,
  bringObjectForward,
  bringToFront,
  copyObjects,
  deleteObject,
  deletePage,
  distributeObjects,
  documentFromPins,
  duplicateObject,
  duplicatePage,
  frameForSlot,
  groupPagesIntoSection,
  inchesFrame,
  insertImage,
  insertShape,
  moveObject,
  normalizeReportDocument,
  pagesForExport,
  pasteObjects,
  placeObjectInSlot,
  reorderPages,
  reportDocumentForApi,
  resizeObject,
  searchPages,
  setObjectHidden,
  setPageHidden,
  snapFrameToGrid,
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

  it('snaps, aligns, distributes, and edits objects', () => {
    expect(snapFrameToGrid({ x: 0.113, y: 0.247, w: 0.33, h: 0.19 }, { step: 0.05 })).toEqual({
      x: 0.1,
      y: 0.25,
      w: 0.35,
      h: 0.2,
    });

    const doc = documentFromPins(pins.slice(0, 1));
    const pageId = doc.pages[0]!.id;
    const withShapes = insertShape(
      insertShape(doc, pageId, {
        shapeType: 'arrow',
        frame: { x: 0.1, y: 0.2, w: 0.2, h: 0.1 },
      }),
      pageId,
      { shapeType: 'callout', frame: { x: 0.4, y: 0.5, w: 0.2, h: 0.1 } }
    );
    const withImage = insertImage(withShapes, pageId, {
      imageUrl: 'https://example.com/chart.png',
      frame: { x: 0.7, y: 0.2, w: 0.2, h: 0.2 },
    });
    const objects = withImage.pages[0]!.objects.filter(
      obj => obj.kind === 'shape' || obj.kind === 'image'
    );
    expect(objects).toHaveLength(3);
    expect(objects[0]?.shapeType).toBe('arrow');
    expect(objects[2]?.imageUrl).toBe('https://example.com/chart.png');

    const ids = objects.map(obj => obj.id);
    const aligned = alignObjects(withImage, pageId, ids, 'left');
    const xs = aligned.pages[0]!.objects.filter(obj => ids.includes(obj.id)).map(
      obj => obj.frame.x
    );
    expect(new Set(xs.map(value => Number(value.toFixed(6)))).size).toBe(1);

    const distributed = distributeObjects(aligned, pageId, ids, 'vertical');
    const ys = distributed.pages[0]!.objects.filter(obj => ids.includes(obj.id))
      .map(obj => obj.frame.y)
      .sort((a, b) => a - b);
    expect(ys[0]!).toBeLessThan(ys[1]!);
    expect(ys[1]!).toBeLessThan(ys[2]!);

    const moved = moveObject(
      distributed,
      pageId,
      ids[0]!,
      { x: 0.113, y: 0.2, w: 0.2, h: 0.1 },
      { snap: true, gridStep: 0.05 }
    );
    expect(moved.pages[0]!.objects.find(obj => obj.id === ids[0])?.frame.x).toBe(0.1);

    const resized = resizeObject(moved, pageId, ids[0]!, { width: 0.4, height: 0.25 });
    expect(resized.pages[0]!.objects.find(obj => obj.id === ids[0])?.frame).toMatchObject({
      w: 0.4,
      h: 0.25,
    });

    const duped = duplicateObject(resized, pageId, ids[0]!);
    expect(duped.pages[0]!.objects.length).toBe(resized.pages[0]!.objects.length + 1);
    const hidden = setObjectHidden(duped, pageId, ids[1]!, true);
    expect(hidden.pages[0]!.objects.find(obj => obj.id === ids[1])?.hidden).toBe(true);
    const clipped = copyObjects(hidden, pageId, [ids[0]!]);
    const beforeIds = new Set(hidden.pages[0]!.objects.map(obj => obj.id));
    const pasted = pasteObjects(hidden, pageId, clipped);
    expect(pasted.pages[0]!.objects.length).toBe(hidden.pages[0]!.objects.length + 1);
    expect(pasted.pages[0]!.objects.some(obj => !beforeIds.has(obj.id))).toBe(true);
    const front = bringToFront(pasted, pageId, ids[0]!);
    const frontZ = front.pages[0]!.objects.find(obj => obj.id === ids[0])!.zIndex;
    expect(frontZ).toBe(Math.max(...front.pages[0]!.objects.map(obj => obj.zIndex)));
    const deleted = deleteObject(front, pageId, ids[2]!);
    expect(deleted.pages[0]!.objects.some(obj => obj.id === ids[2])).toBe(false);
    const title = deleted.pages[0]!.objects.find(obj => obj.slotId === 'title')!;
    expect(
      alignmentGuides(
        deleted,
        pageId,
        { x: title.frame.x + 0.01, y: title.frame.y, w: 0.2, h: 0.1 },
        { excludeObjectIds: [ids[0]!] }
      ).some(guide => guide.axis === 'x' && guide.sourceObjectId === title.id)
    ).toBe(true);
  });

  it('searches the page tree, adds and deletes pages, and sorts by significance', () => {
    const doc = documentFromPins(pins);
    const grouped = groupPagesIntoSection(doc, [doc.pages[0]!.id], 'Insights');
    expect(searchPages(grouped, 'beta').map(page => page.title)).toEqual(['Beta finding']);
    expect(searchPages(grouped, 'insight').map(page => page.title)).toEqual(['Alpha finding']);

    const withPage = addPage(grouped, {
      title: 'Methods',
      layoutId: 'blank',
      afterPageId: doc.pages[0]!.id,
    });
    expect(withPage.pages[1]?.title).toBe('Methods');
    expect(withPage.pages[1]?.layoutId).toBe('blank');
    const trimmed = deletePage(withPage, withPage.pages[1]!.id);
    expect(trimmed.pages.every(page => page.title !== 'Methods')).toBe(true);

    const scored = sortPages(doc, 'significance', {
      [doc.pages[2]!.id]: 9,
      [doc.pages[0]!.id]: 3,
    });
    expect(scored.pages.map(page => page.title)).toEqual([
      'Gamma finding',
      'Alpha finding',
      'Beta finding',
    ]);
  });
});
