import {
  PAGE_ASPECT,
  PAGE_HEIGHT_IN,
  PAGE_WIDTH_IN,
  addPage,
  alignObjects,
  alignmentGuides,
  applyDefaultLabels,
  applyPageTemplate,
  bringObjectForward,
  bringToFront,
  copyObjects,
  copyStyles,
  deleteObject,
  deletePage,
  distributeObjects,
  cssFontStack,
  documentFromPins,
  duplicateObject,
  duplicatePage,
  upsertPinPage,
  fitDocumentTextFrames,
  fitPageTextFrames,
  looksLikeDeckRequestBrief,
  stripTrailingBaseFootnote,
  frameForSlot,
  groupPagesIntoSection,
  inchesFrame,
  kindForLayoutSlot,
  placeholderObjectsForLayout,
  hideTableRow,
  insertDynamicText,
  insertImage,
  insertPageNumber,
  insertSampleSizeDescription,
  insertShape,
  insertTable,
  insertTextBox,
  liveValueFromLabel,
  liveValueShowsLabel,
  mergeTableRowsIntoNet,
  refreshLiveText,
  setObjectBinding,
  moveObject,
  normalizeReportDocument,
  listPageLinks,
  objectAsStyleTemplate,
  pageAsTemplate,
  pageHref,
  pagesForExport,
  parseReportReshapeRequest,
  pasteObjects,
  placeObjectInSlot,
  presentTableObject,
  renameTableRow,
  reorderPages,
  reorderTableRows,
  reportDocumentForApi,
  reshapeReportDocument,
  resizeObject,
  resolveTextHref,
  searchPages,
  savePageAsTemplate,
  setDefaultLabels,
  setDocumentTheme,
  setObjectHidden,
  setObjectText,
  setObjectTextStyle,
  setPageHidden,
  setPageLayout,
  setTableRules,
  setTableStyle,
  snapFrameToGrid,
  sortPages,
  tablePreviewFootnote,
  tablePreviewTitle,
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

  it('seeds headline and chart placeholders when adding a layout page', () => {
    expect(kindForLayoutSlot('title_and_content', 'content')).toBe('chart');
    expect(kindForLayoutSlot('title_only', 'content')).toBe('table');
    const seeded = placeholderObjectsForLayout('title_and_content', { title: 'Finding A' });
    expect(seeded.map(obj => [obj.slotId, obj.kind])).toEqual([
      ['title', 'text'],
      ['content', 'chart'],
    ]);
    expect(seeded[0]?.text).toBe('Finding A');
    expect(seeded[0]?.frame).toEqual(frameForSlot('title_and_content', 'title'));
    expect(seeded[1]?.frame).toEqual(frameForSlot('title_and_content', 'content'));

    const doc = addPage(normalizeReportDocument({ pages: [] }), {
      title: 'Finding A',
      layoutId: 'title_and_content',
    });
    expect(doc.pages[0]?.objects.map(obj => obj.kind)).toEqual(['text', 'chart']);
    expect(doc.pages[0]?.objects.map(obj => obj.slotId)).toEqual(['title', 'content']);

    const blank = addPage(doc, { title: 'Empty', layoutId: 'blank' });
    expect(blank.pages.at(-1)?.objects).toEqual([]);

    const switched = setPageLayout(doc, doc.pages[0]!.id, 'two_content');
    expect(switched.pages[0]?.layoutId).toBe('two_content');
    expect(switched.pages[0]?.objects.filter(obj => obj.slotId === 'title')).toHaveLength(0);
    expect(
      switched.pages[0]?.objects
        .filter(obj => obj.slotId === 'content_left' || obj.slotId === 'content_right')
        .map(obj => obj.kind)
    ).toEqual(['chart', 'chart']);
  });

  it('builds live pages from pins and hides deck:false from export', () => {
    const doc = documentFromPins(pins);
    expect(doc.pages).toHaveLength(3);
    expect(doc.pages[0]?.layoutId).toBe('title_and_content');
    expect(doc.pages[0]?.objects.map(obj => obj.kind)).toEqual(['text', 'chart']);
    expect(doc.pages[0]?.objects[1]?.pinId).toBe('pin-alpha');
    expect(doc.pages[0]?.objects[1]?.runId).toBe('run-1');
    expect(pagesForExport(doc).map(page => page.title)).toEqual(['Alpha finding', 'Gamma finding']);
    // No share bars → Headline + table bound to the run (not another finding's prose).
    expect(doc.pages[1]?.layoutId).toBe('title_only');
    expect(doc.pages[1]?.objects.map(obj => obj.kind)).toEqual(['text', 'table']);
    expect(doc.pages[1]?.objects[0]?.text).toBe('Beta finding');
  });

  it('upserts a pin slide onto an existing deck without dropping cover pages', () => {
    const deck = addPage(normalizeReportDocument({}), {
      title: 'Cover',
      layoutId: 'title_page',
    });
    const { document: withPin, pageId } = upsertPinPage(deck, {
      id: 'pin-spearman',
      runId: 'run-spearman',
      headline: 'Spearman correlation',
      support: 'No real link between the pair.',
      bars: [],
      deck: true,
    });
    expect(withPin.pages).toHaveLength(2);
    const page = withPin.pages.find(item => item.id === pageId);
    expect(page?.title).toBe('Spearman correlation');
    expect(page?.layoutId).toBe('title_only');
    expect(page?.objects.map(obj => obj.kind)).toEqual(['text', 'table']);
    expect(page?.objects[0]?.text).toBe('Spearman correlation');
    expect(page?.objects[1]?.text).toBe('');
    const { document: refreshed, pageId: sameId } = upsertPinPage(withPin, {
      id: 'pin-spearman',
      runId: 'run-spearman',
      headline: 'Spearman correlation',
      support: 'Updated finding for this run only.',
      bars: [{ label: 'ρ', percent: 12 }],
      deck: true,
    });
    expect(sameId).toBe(pageId);
    expect(refreshed.pages).toHaveLength(2);
    expect(refreshed.pages[0]?.title).toBe('Cover');
    const again = refreshed.pages.find(item => item.id === pageId);
    expect(again?.layoutId).toBe('title_and_content');
    expect(again?.objects.map(obj => obj.kind)).toEqual(['text', 'chart']);
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

  it('switches page layouts, remounts slots, and round-trips page templates', () => {
    const doc = documentFromPins(pins.slice(0, 1));
    const page = doc.pages[0]!;
    const chart = page.objects.find(obj => obj.kind === 'chart')!;
    const slotted = placeObjectInSlot(doc, page.id, chart.id, 'content');
    const switched = setPageLayout(slotted, page.id, 'two_content');
    expect(switched.pages[0]?.layoutId).toBe('two_content');
    expect(switched.pages[0]?.objects.find(obj => obj.id === chart.id)?.slotId).toBeNull();
    const remounted = placeObjectInSlot(switched, page.id, chart.id, 'content_left');
    expect(remounted.pages[0]?.objects.find(obj => obj.id === chart.id)?.frame).toEqual(
      frameForSlot('two_content', 'content_left')
    );
    expect(() => setPageLayout(doc, page.id, 'not-a-master')).toThrow(/Unknown page layout/);

    const template = pageAsTemplate(remounted.pages[0]!);
    expect(template.kind).toBe('page');
    expect(template.layoutId).toBe('two_content');
    expect(template.objects.every(obj => !obj.runId && !obj.pinId)).toBe(true);
    const applied = applyPageTemplate(doc, template, { title: 'From template' });
    expect(applied.pages.at(-1)?.title).toBe('From template');
    expect(applied.pages.at(-1)?.layoutId).toBe('two_content');
    expect(applied.pages.at(-1)?.objects).toHaveLength(template.objects.length);
    expect(applied.pages.at(-1)?.id).not.toBe(remounted.pages[0]?.id);

    const saved = savePageAsTemplate(remounted, remounted.pages[0]!.id, 'Audience profile page');
    expect(saved.pageTemplates).toHaveLength(1);
    expect(saved.pageTemplates[0]?.name).toBe('Audience profile page');
    expect(saved.theme.name).toBeTruthy();
    const themed = setDocumentTheme(saved, {
      name: 'Team theme · Test',
      fontFamily: 'Georgia',
      headingFontFamily: 'Inter',
      primaryColour: '#112233',
      chartPalette: ['#112233', '#445566'],
    });
    expect(themed.theme.fontFamily).toBe('Georgia');
    expect(themed.theme.headingFontFamily).toBe('Inter');
    const api = reportDocumentForApi(themed);
    expect((api.theme as { font_family: string }).font_family).toBe('Georgia');
    expect((api.page_templates as { name: string }[])[0]?.name).toBe('Audience profile page');

    const style = objectAsStyleTemplate(
      remounted.pages[0]!.objects.find(obj => obj.id === chart.id)!
    );
    expect(style.kind).toBe('chart');
    expect(() => objectAsStyleTemplate({ kind: 'text', text: 'Nope' })).toThrow(/chart or table/);
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

  it('formats text boxes, paints styles, and renames default labels', () => {
    const doc = documentFromPins(pins.slice(0, 1));
    const pageId = doc.pages[0]!.id;
    expect(doc.defaultLabels).toEqual({ net: 'NET', total: 'Total' });

    const withBox = insertTextBox(doc, pageId, {
      text: 'Headline',
      frame: { x: 0.15, y: 0.15, w: 0.5, h: 0.2 },
      textStyle: {
        fontFamily: 'Georgia',
        fontSizePt: 24,
        bold: true,
        align: 'center',
        verticalAlign: 'middle',
        lineSpacing: 1.5,
        listStyle: 'bullet',
        listIndent: 1,
        color: '#1e6b58',
      },
    });
    const box = withBox.pages[0]!.objects.find(obj => obj.text === 'Headline')!;
    expect(box.kind).toBe('text');
    expect(box.textStyle.fontFamily).toBe('Georgia');
    expect(box.textStyle.fontSizePt).toBe(24);
    expect(box.textStyle.bold).toBe(true);
    expect(box.textStyle.align).toBe('center');
    expect(box.textStyle.verticalAlign).toBe('middle');
    expect(box.textStyle.listStyle).toBe('bullet');
    expect(box.textStyle.listIndent).toBe(1);
    expect(box.textStyle.color).toBe('#1E6B58');

    const linked = setObjectText(withBox, pageId, box.id, {
      runs: [
        { text: 'See ', bold: false },
        { text: 'methods', underline: true, href: pageHref(pageId), color: '#0000EE' },
        { text: ' page', italic: true },
      ],
    });
    const linkedBox = linked.pages[0]!.objects.find(obj => obj.id === box.id)!;
    expect(linkedBox.text).toBe('See methods page');
    expect(linkedBox.runs).toHaveLength(3);
    expect(resolveTextHref(linkedBox.runs[1]!.href)).toEqual({ kind: 'page', pageId });
    expect(resolveTextHref('https://example.com')).toEqual({
      kind: 'url',
      url: 'https://example.com',
    });
    expect(listPageLinks(linked)).toEqual([
      {
        fromPageId: pageId,
        objectId: box.id,
        pageId,
        href: pageHref(pageId),
      },
    ]);

    const styled = setObjectTextStyle(linked, pageId, box.id, {
      underline: true,
      strikethrough: true,
      listStyle: 'number',
    });
    const styledBox = styled.pages[0]!.objects.find(obj => obj.id === box.id)!;
    expect(styledBox.textStyle.underline).toBe(true);
    expect(styledBox.textStyle.strikethrough).toBe(true);
    expect(styledBox.textStyle.listStyle).toBe('number');
    expect(styledBox.textStyle.fontFamily).toBe('Georgia');

    const other = insertTextBox(styled, pageId, {
      text: 'Body copy',
      frame: { x: 0.2, y: 0.5, w: 0.4, h: 0.2 },
    });
    const otherId = other.pages[0]!.objects.find(obj => obj.text === 'Body copy')!.id;
    const painted = copyStyles(other, pageId, box.id, [otherId]);
    const paintedBox = painted.pages[0]!.objects.find(obj => obj.id === otherId)!;
    expect(paintedBox.textStyle.fontFamily).toBe('Georgia');
    expect(paintedBox.textStyle.bold).toBe(true);
    expect(paintedBox.textStyle.listStyle).toBe('number');
    expect(paintedBox.text).toBe('Body copy');

    const renamed = setDefaultLabels(painted, { net: 'Combined', total: 'All respondents' });
    expect(renamed.defaultLabels).toEqual({ net: 'Combined', total: 'All respondents' });
    expect(applyDefaultLabels('NET', renamed.defaultLabels)).toBe('Combined');
    expect(applyDefaultLabels('Total', renamed.defaultLabels)).toBe('All respondents');
    expect(applyDefaultLabels('NET Agree', renamed.defaultLabels)).toBe('Combined Agree');
    expect(applyDefaultLabels('Brand A', renamed.defaultLabels)).toBe('Brand A');

    const payload = reportDocumentForApi(renamed);
    expect(payload.default_labels).toEqual({ net: 'Combined', total: 'All respondents' });
    const apiBox = (
      (payload.pages as Record<string, unknown>[])[0]!.objects as Record<string, unknown>[]
    ).find(obj => obj.id === box.id)!;
    expect((apiBox.text_style as Record<string, unknown>).font_family).toBe('Georgia');
    expect(Array.isArray(apiBox.runs)).toBe(true);
  });

  it('stores table style, rules and edits and re-applies them to a live book', () => {
    const doc = documentFromPins(pins.slice(0, 1));
    const pageId = doc.pages[0]!.id;
    const withTable = insertTable(doc, pageId, {
      tableSpecId: 'spec-1',
      tableStyle: { preset: 'compact' },
      tableRules: [{ type: 'hide_empty', axis: 'rows' }],
    });
    const table = withTable.pages[0]!.objects.find(obj => obj.kind === 'table')!;
    expect(table.tableSpecId).toBe('spec-1');
    expect(table.tableStyle.preset).toBe('compact');
    expect(table.tableStyle.fontSizePt).toBe(8);

    const styled = setTableStyle(withTable, pageId, table.id, {
      preset: 'client',
      freezeHeader: false,
    });
    const ruled = setTableRules(styled, pageId, table.id, [{ type: 'hide_empty' }]);
    const renamed = renameTableRow(ruled, pageId, table.id, 'r1', 'Brand One');
    const hidden = hideTableRow(renamed, pageId, table.id, 'r3');
    const ordered = reorderTableRows(hidden, pageId, table.id, ['r2', 'r1']);
    const merged = mergeTableRowsIntoNet(ordered, pageId, table.id, ['r1', 'r2'], 'NET Brands');
    const obj = merged.pages[0]!.objects.find(item => item.id === table.id)!;
    expect(obj.tableEdits.renames.r1).toBe('Brand One');
    expect(obj.tableEdits.hiddenRowIds).toContain('r3');
    expect(obj.tableEdits.merges[0]?.label).toBe('NET Brands');

    const presented = presentTableObject(merged, pageId, table.id, {
      banner_columns: [{ id: 'total', label: 'Total' }],
      rows: [
        {
          id: 'r1',
          label: 'One',
          kind: 'category',
          cells: [{ stub_row_id: 'r1', banner_id: 'total', percent: 40, unweighted_n: 40 }],
        },
        {
          id: 'r2',
          label: 'Two',
          kind: 'category',
          cells: [{ stub_row_id: 'r2', banner_id: 'total', percent: 30, unweighted_n: 30 }],
        },
        {
          id: 'r3',
          label: 'Three',
          kind: 'category',
          cells: [{ stub_row_id: 'r3', banner_id: 'total', percent: 20, unweighted_n: 20 }],
        },
        {
          id: 'empty',
          label: 'Empty',
          kind: 'category',
          cells: [{ stub_row_id: 'empty', banner_id: 'total', percent: 0, unweighted_n: 0 }],
        },
      ],
    });
    const labels = presented.rows.map(row => String(row.label || ''));
    expect(labels).toContain('NET Brands');
    expect(labels).not.toContain('Three');
    expect(labels).not.toContain('Empty');

    const payload = reportDocumentForApi(merged);
    const apiTable = (
      (payload.pages as Record<string, unknown>[])[0]!.objects as Record<string, unknown>[]
    ).find(item => item.id === table.id)!;
    expect((apiTable.table_style as Record<string, unknown>).preset).toBe('client');
    expect(Array.isArray(apiTable.table_rules)).toBe(true);
    expect((apiTable.table_edits as Record<string, unknown>).renames).toEqual({
      r1: 'Brand One',
    });
  });
});

describe('reshapeReportDocument', () => {
  it('prepends a board variant and keeps the full report', () => {
    const source = addPage(documentFromPins(pins), {
      title: 'How to read this report',
      layoutId: 'title_and_content',
      section: 'Methods',
    });
    const originalIds = source.pages.map(page => page.id);
    const result = reshapeReportDocument(source, {
      kind: 'board',
      maxSlides: 5,
      includeRecommendations: true,
      recommendationCount: 3,
      recommendationBullets: ['Prioritise awareness', 'Watch value', 'Revisit the gap'],
    });
    expect(result.keptFull).toBe(true);
    expect(result.variantSection).toBe('Board');
    expect(originalIds.every(id => result.document.pages.some(page => page.id === id))).toBe(true);
    const board = result.document.pages.filter(page => page.section === 'Board');
    expect(board[0]?.id).toBe(result.document.pages[0]?.id);
    expect(board[0]?.layoutId).toBe('title_page');
    expect(board.some(page => page.title === 'Implications')).toBe(true);
    expect(board.every(page => page.title !== 'How to read this report')).toBe(true);
    expect(
      board.filter(page => page.title !== 'Implications' && page.layoutId !== 'title_page')
    ).toHaveLength(2);
  });

  it('picks strongest insights and skips title/exec for a board version', () => {
    let doc = addPage(normalizeReportDocument({ pages: [] }), {
      title: 'Audience Check',
      layoutId: 'title_page',
      section: 'Title',
    });
    doc = addPage(doc, {
      title: 'Executive summary',
      layoutId: 'title_and_content',
      section: 'Executive summary',
    });
    doc = addPage(doc, {
      title: 'United States share higher among female than male respondents (62.8% vs 60.8%)',
      layoutId: 'title_and_content',
      section: 'Insights',
    });
    doc = addPage(doc, {
      title: 'UK reads Global Ledger more (35% vs 28%)',
      layoutId: 'title_and_content',
      section: 'Insights',
    });
    doc = addPage(doc, {
      title: 'The Exchange over-indexes in Germany (22% vs 14%)',
      layoutId: 'title_and_content',
      section: 'Insights',
    });
    const chartPageIds = doc.pages
      .filter(page => page.section === 'Insights' && !page.title.includes('62.8%'))
      .map(page => page.id);
    for (const pageId of chartPageIds) {
      doc = insertTable(doc, pageId, { runId: `run-${pageId}`, tableSpecId: `spec-${pageId}` });
    }

    const result = reshapeReportDocument(doc, {
      kind: 'board',
      maxSlides: 5,
      includeRecommendations: true,
    });
    const board = result.document.pages.filter(page => page.section === 'Board');
    // Title + 2 strong findings + Implications (weak gap dropped, not used as padding).
    expect(board).toHaveLength(4);
    expect(board[0]?.layoutId).toBe('title_page');
    expect(board[0]?.title).toBe('Audience Check');
    expect(board[board.length - 1]?.title).toBe('Implications');
    const findingTitles = board.slice(1, -1).map(page => page.title);
    expect(findingTitles).toContain('UK reads Global Ledger more (35% vs 28%)');
    expect(findingTitles).toContain('The Exchange over-indexes in Germany (22% vs 14%)');
    expect(findingTitles.every(title => !title.includes('62.8%'))).toBe(true);
    const implBody =
      board[board.length - 1]?.objects.find(obj => obj.slotId === 'content')?.text || '';
    expect(implBody).not.toContain('Focus on:');
    expect(implBody).not.toContain('• •');
    expect(implBody.trimStart().startsWith('• ')).toBe(false);
  });

  it('parses board and short reshape prompts', () => {
    const board = parseReportReshapeRequest(
      'Make a 5 slide version for the board, one headline per slide, a chart on each, final slide with 3 recommendations'
    );
    expect(board?.kind).toBe('board');
    expect(board?.maxSlides).toBe(5);
    expect(board?.includeRecommendations).toBe(true);
    expect(board?.recommendationCount).toBe(3);

    const qa = parseReportReshapeRequest(
      'Make a 5 slide version of the findings for the board, one headline per slide, a chart on each, and the final slide with 3 recommendations. Keep the full report as it is.'
    );
    expect(qa?.kind).toBe('board');
    expect(qa?.maxSlides).toBe(5);
    expect(qa?.includeRecommendations).toBe(true);
    expect(qa?.recommendationCount).toBe(3);

    const short = parseReportReshapeRequest('Build a short version of the report');
    expect(short?.kind).toBe('short');
    expect(short?.includeRecommendations).toBe(false);

    expect(parseReportReshapeRequest('What does region mean?')).toBeNull();
  });

  it('refreshes sample-size, page-number and cell-bound live text', () => {
    const doc = documentFromPins(pins.slice(0, 1));
    const pageId = doc.pages[0]!.id;
    const withTable = insertTable(doc, pageId, { runId: 'run-1', tableSpecId: 'spec-live' });
    const table = withTable.pages[0]!.objects.find(obj => obj.kind === 'table')!;
    const bookV1 = {
      base_label: 'Unweighted, n = 100',
      cells: [{ stub_label: 'Aware', banner_label: 'Total', percent: 42, count: 42 }],
    };
    const withBase = insertSampleSizeDescription(withTable, pageId, {
      sourceObjectId: table.id,
      runId: 'run-1',
      source: bookV1,
    });
    const withCell = insertDynamicText(withBase, pageId, {
      rowKey: 'Aware',
      colKey: 'Total',
      sourceObjectId: table.id,
      runId: 'run-1',
      source: bookV1,
      prefix: 'Awareness is ',
    });
    const withPage = insertPageNumber(withCell, pageId, { template: 'Page {n} of {total}' });

    const base = withPage.pages[0]!.objects.find(obj => obj.binding?.kind === 'sample_size')!;
    const cell = withPage.pages[0]!.objects.find(obj => obj.binding?.kind === 'cell')!;
    const pageNo = withPage.pages[0]!.objects.find(obj => obj.binding?.kind === 'page_number')!;
    expect(base.text).toBe('Unweighted, n = 100');
    expect(cell.text).toBe('Awareness is 42%');
    expect(pageNo.text).toBe('Page 1 of 1');

    const bookV2 = {
      base_label: 'base 180 weighted (unweighted 150)',
      weight: {
        weight_aware: true,
        weighted_n: 180,
        unweighted_n: 150,
        kish_effective_base: 140,
      },
      cells: [{ stub_label: 'Aware', banner_label: 'Total', percent: 55.5, count: 83 }],
    };
    const refreshed = refreshLiveText(withPage, { 'run-1': bookV2 });
    const base2 = refreshed.pages[0]!.objects.find(obj => obj.binding?.kind === 'sample_size')!;
    const cell2 = refreshed.pages[0]!.objects.find(obj => obj.binding?.kind === 'cell')!;
    expect(base2.text).toBe('Base: 180 weighted (unweighted 150)');
    expect(cell2.text).toBe('Awareness is 55.5%');
    expect(base2.binding?.stale).toBe(false);
    expect(cell2.binding?.fingerprint).toBeTruthy();

    const payload = reportDocumentForApi(refreshed);
    const apiBase = (
      (payload.pages as Record<string, unknown>[])[0]!.objects as Record<string, unknown>[]
    ).find(obj => (obj.binding as Record<string, unknown> | null)?.kind === 'sample_size')!;
    expect((apiBase.binding as Record<string, unknown>).kind).toBe('sample_size');

    const rebound = setObjectBinding(refreshed, pageId, cell2.id, {
      kind: 'page_number',
      template: '{n} / {total}',
    });
    const pageLive = rebound.pages[0]!.objects.find(obj => obj.id === cell2.id)!;
    expect(pageLive.binding?.kind).toBe('page_number');
    expect(pageLive.text).toBe('1 / 1');
    expect(liveValueShowsLabel(pageLive.binding)).toBe('Page number');
    expect(liveValueFromLabel(pageLive.binding)).toBe('This report');
    expect(liveValueShowsLabel(base2.binding)).toBe('Sample size');
    expect(
      liveValueFromLabel(cell2.binding, refreshed.pages[0]!.objects, { pageTitle: 'Awareness' })
    ).toMatch(/T\d+ · Awareness/);
  });

  it('expands clipped commentary and keeps Inter from falling back to serif', () => {
    const long =
      'Culture shapes food and nutrition advice for 77.1% of respondents, while 22.9% say it does not (n = 380). This makes cultural context a routine part of recommendations rather than an exception across markets and care settings.';
    const doc = normalizeReportDocument({
      pages: [
        {
          id: 'page-clip',
          title: 'Finding',
          layout_id: 'title_and_content',
          objects: [
            {
              id: 'comment',
              kind: 'text',
              frame: { x: 0.06, y: 0.2, w: 0.88, h: 0.12 },
              text: long,
              // Legacy decks used the 18pt default and clipped under a 0.12 frame.
              text_style: { font_family: 'Inter', font_size_pt: 18 },
              z_index: 1,
            },
            {
              id: 'table',
              kind: 'table',
              table_spec_id: 'spec-1',
              frame: { x: 0.06, y: 0.34, w: 0.88, h: 0.56 },
              z_index: 2,
            },
          ],
        },
      ],
    });
    const fitted = fitDocumentTextFrames(doc);
    const comment = fitted.pages[0]!.objects.find(obj => obj.id === 'comment')!;
    const table = fitted.pages[0]!.objects.find(obj => obj.id === 'table')!;
    expect(comment.frame.h).toBeGreaterThan(0.12);
    expect(table.frame.y).toBeGreaterThanOrEqual(comment.frame.y + comment.frame.h + 0.03);
    expect(cssFontStack('Inter')).toMatch(/^Inter, system-ui, sans-serif$/);
    expect(cssFontStack('Inter')).not.toMatch(/(^|,\s*)serif\b/);
  });

  it('promotes insight tables on Headline + chart to charts and remounts other tables', () => {
    const insight = normalizeReportDocument({
      pages: [
        {
          id: 'page-chart',
          title: 'Referral to Registered Dietitians',
          section: 'Insights',
          layout_id: 'title_and_content',
          objects: [
            {
              id: 'title',
              kind: 'text',
              frame: { x: 0.06, y: 0.06, w: 0.88, h: 0.12 },
              text: 'Referral to Registered Dietitians for specialist support.',
              text_style: { font_family: 'Inter', font_size_pt: 22, bold: true },
            },
            {
              id: 'comment',
              kind: 'text',
              frame: { x: 0.06, y: 0.2, w: 0.88, h: 0.08 },
              text: 'Most respondents want specialist support.',
              text_style: { font_family: 'Inter', font_size_pt: 14 },
            },
            {
              id: 'grid',
              kind: 'table',
              table_spec_id: 'spec-referral',
              frame: { x: 0.06, y: 0.3, w: 0.88, h: 0.5 },
            },
          ],
        },
      ],
    });
    const fittedInsight = fitDocumentTextFrames(insight);
    const title = fittedInsight.pages[0]!.objects.find(obj => obj.id === 'title')!;
    const comment = fittedInsight.pages[0]!.objects.find(obj => obj.id === 'comment')!;
    const grid = fittedInsight.pages[0]!.objects.find(obj => obj.id === 'grid')!;
    expect(fittedInsight.pages[0]!.layoutId).toBe('title_and_content');
    expect(grid.kind).toBe('chart');
    expect(comment.frame.y).toBeGreaterThanOrEqual(title.frame.y + title.frame.h + 0.03);
    expect(grid.frame.y).toBeGreaterThanOrEqual(comment.frame.y + comment.frame.h + 0.03);

    const evidence = normalizeReportDocument({
      pages: [
        {
          id: 'page-table',
          title: 'Evidence',
          section: 'Evidence',
          layout_id: 'title_and_content',
          objects: [
            {
              id: 'grid',
              kind: 'table',
              table_spec_id: 'spec-ev',
              frame: { x: 0.06, y: 0.3, w: 0.88, h: 0.5 },
            },
          ],
        },
      ],
    });
    const fittedEvidence = fitDocumentTextFrames(evidence);
    expect(fittedEvidence.pages[0]!.layoutId).toBe('title_only');
    expect(fittedEvidence.pages[0]!.objects.find(obj => obj.id === 'grid')!.kind).toBe('table');
  });

  it('hides Study pages that stored the chat request as the brief', () => {
    expect(
      looksLikeDeckRequestBrief(
        'Executive summary, 10 to 15 insight slides with a clear narrative.'
      )
    ).toBe(true);
    const doc = normalizeReportDocument({
      pages: [
        {
          id: 'study',
          title: 'Study',
          section: 'Title',
          objects: [
            {
              id: 'title',
              kind: 'text',
              text: 'Study',
              text_style: { font_family: 'Inter', font_size_pt: 22, bold: true },
            },
            {
              id: 'body',
              kind: 'text',
              text: 'Executive summary, 10 to 15 insight slides with a clear narrative.',
              text_style: { font_family: 'Inter', font_size_pt: 14 },
            },
          ],
        },
        {
          id: 'exec',
          title: 'Executive summary',
          section: 'Executive summary',
          objects: [
            {
              id: 'exec-body',
              kind: 'text',
              text: '• Blue leads at 62%.',
              text_style: { font_family: 'Inter', font_size_pt: 14 },
            },
          ],
        },
      ],
    });
    const fitted = fitDocumentTextFrames(doc);
    // Empty opening brief (chat ask only) is removed; exec summary stays.
    expect(fitted.pages.map(page => page.id)).toEqual(['exec']);
  });

  it('remints duplicate page ids so React keys stay unique', () => {
    const doc = normalizeReportDocument({
      pages: [
        {
          id: '8faf62c889f071704fa1893ab2b84cc9-NPR',
          title: 'Insight A',
          objects: [
            { id: 'obj-dup', kind: 'text', text: 'A1' },
            { id: 'obj-dup', kind: 'text', text: 'A2' },
          ],
        },
        {
          id: '8faf62c889f071704fa1893ab2b84cc9-NPR',
          title: 'Insight B',
          objects: [{ id: 'obj-b', kind: 'text', text: 'B' }],
        },
      ],
    });
    expect(doc.pages).toHaveLength(2);
    expect(doc.pages[0]!.id).not.toBe(doc.pages[1]!.id);
    expect(doc.pages[0]!.objects[0]!.id).not.toBe(doc.pages[0]!.objects[1]!.id);
  });

  it('clears a Title-section body that stored the deck chat request', () => {
    const doc = normalizeReportDocument({
      pages: [
        {
          id: 'title-page',
          title: 'Ready meals study',
          section: 'Title',
          objects: [
            {
              id: 'title',
              kind: 'text',
              text: 'Ready meals study',
              text_style: { font_family: 'Inter', font_size_pt: 22, bold: true },
            },
            {
              id: 'body',
              kind: 'text',
              text: 'Executive summary, 10 to 15 insight slides with a clear narrative.',
              text_style: { font_family: 'Inter', font_size_pt: 14 },
            },
          ],
        },
      ],
    });
    const fitted = fitDocumentTextFrames(doc);
    const body = fitted.pages[0]!.objects.find(obj => obj.id === 'body')!;
    expect(body.hidden).toBe(true);
    expect(body.text).toBe('');
    const title = fitted.pages[0]!.objects.find(obj => obj.id === 'title')!;
    expect(title.hidden).toBe(false);
    expect(title.text).toBe('Ready meals study');
  });

  it('pushes commentary under a tall title and strips Base footers above tables', () => {
    expect(stripTrailingBaseFootnote('Lead at 54.2%. Base: Unweighted, n = 380')).toBe(
      'Lead at 54.2%.'
    );
    const doc = normalizeReportDocument({
      pages: [
        {
          id: 'page-overlap',
          objects: [
            {
              id: 'title',
              kind: 'text',
              frame: { x: 0.06, y: 0.06, w: 0.88, h: 0.12 },
              text: 'No leads at 54.2% among people who prefer print materials over digital channels for patient education yours?',
              text_style: { font_family: 'Inter', font_size_pt: 22, bold: true },
              z_index: 1,
            },
            {
              id: 'comment',
              kind: 'text',
              frame: { x: 0.06, y: 0.2, w: 0.88, h: 0.1 },
              text: 'No leads at 54.2% for print. Base: Unweighted, n = 380',
              text_style: { font_family: 'Inter', font_size_pt: 14 },
              z_index: 2,
            },
            {
              id: 'table',
              kind: 'table',
              table_spec_id: 'spec-1',
              frame: { x: 0.06, y: 0.34, w: 0.88, h: 0.5 },
              z_index: 3,
            },
          ],
        },
      ],
    });
    const fitted = fitDocumentTextFrames(doc);
    const title = fitted.pages[0]!.objects.find(obj => obj.id === 'title')!;
    const comment = fitted.pages[0]!.objects.find(obj => obj.id === 'comment')!;
    const table = fitted.pages[0]!.objects.find(obj => obj.id === 'table')!;
    expect(title.frame.h).toBeGreaterThan(0.12);
    expect(comment.frame.y).toBeGreaterThanOrEqual(title.frame.y + title.frame.h + 0.03);
    expect(comment.text).toBe('No leads at 54.2% for print.');
    expect(table.frame.y).toBeGreaterThanOrEqual(comment.frame.y + comment.frame.h + 0.03);
  });

  it('migrates browser serif defaults to Inter and keeps Times New Roman', () => {
    const doc = normalizeReportDocument({
      pages: [
        {
          id: 'p1',
          objects: [
            {
              id: 'a',
              kind: 'text',
              text: 'House',
              text_style: { font_family: 'serif' },
            },
            {
              id: 'b',
              kind: 'text',
              text: 'Chosen',
              text_style: { font_family: 'Times New Roman' },
            },
          ],
        },
      ],
    });
    expect(doc.pages[0]!.objects[0]!.textStyle.fontFamily).toBe('Inter');
    expect(doc.pages[0]!.objects[1]!.textStyle.fontFamily).toBe('Times New Roman');
    expect(cssFontStack('serif')).toMatch(/^Inter, system-ui, sans-serif$/);
  });

  it('fits only the named page so first paint stays cheap on large decks', () => {
    const long =
      'Culture shapes food and nutrition advice for 77.1% of respondents, while 22.9% say it does not.';
    const doc = normalizeReportDocument({
      pages: [
        {
          id: 'page-a',
          objects: [
            {
              id: 'a',
              kind: 'text',
              frame: { x: 0.06, y: 0.2, w: 0.88, h: 0.08 },
              text: long,
              text_style: { font_family: 'Inter', font_size_pt: 18 },
            },
          ],
        },
        {
          id: 'page-b',
          objects: [
            {
              id: 'b',
              kind: 'text',
              frame: { x: 0.06, y: 0.2, w: 0.88, h: 0.08 },
              text: long,
              text_style: { font_family: 'Inter', font_size_pt: 18 },
            },
          ],
        },
      ],
    });
    const firstOnly = fitPageTextFrames(doc, 'page-a');
    expect(firstOnly.pages[0]!.objects[0]!.frame.h).toBeGreaterThan(0.08);
    expect(firstOnly.pages[1]!.objects[0]!.frame.h).toBe(0.08);
  });

  it('builds table preview title and footnote from the book, not house style', () => {
    expect(tablePreviewTitle({ title: 'Frequency Table: Patient culture' })).toBe(
      'Patient culture'
    );
    expect(
      tablePreviewFootnote({
        base_label: 'Base: all respondents (380)',
        weight: { weight_aware: true, weighted_n: 380, unweighted_n: 380 },
        significance_display: 'column_letters',
        significance_alpha: 0.05,
        letters: [{ row: 'Yes', col: 'Total', letters: 'a' }],
      })
    ).toBe('Base: all respondents (380) · Weighted · Letters: 95% vs column');
  });
});
