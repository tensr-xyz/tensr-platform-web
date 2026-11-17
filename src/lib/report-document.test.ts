import {
  PAGE_ASPECT,
  PAGE_HEIGHT_IN,
  PAGE_WIDTH_IN,
  addPage,
  alignObjects,
  alignmentGuides,
  applyDefaultLabels,
  bringObjectForward,
  bringToFront,
  copyObjects,
  copyStyles,
  deleteObject,
  deletePage,
  distributeObjects,
  documentFromPins,
  duplicateObject,
  duplicatePage,
  frameForSlot,
  groupPagesIntoSection,
  inchesFrame,
  hideTableRow,
  insertDynamicText,
  insertImage,
  insertPageNumber,
  insertSampleSizeDescription,
  insertShape,
  insertTable,
  insertTextBox,
  mergeTableRowsIntoNet,
  refreshLiveText,
  moveObject,
  normalizeReportDocument,
  listPageLinks,
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
  setDefaultLabels,
  setObjectHidden,
  setObjectText,
  setObjectTextStyle,
  setPageHidden,
  setTableRules,
  setTableStyle,
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
    expect(board.some(page => page.title === 'Recommendations')).toBe(true);
    expect(board.every(page => page.title !== 'How to read this report')).toBe(true);
    expect(board.filter(page => page.title !== 'Recommendations')).toHaveLength(2);
  });

  it('parses board and short reshape prompts', () => {
    const board = parseReportReshapeRequest(
      'Make a 5 slide version for the board, one headline per slide, a chart on each, final slide with 3 recommendations'
    );
    expect(board?.kind).toBe('board');
    expect(board?.maxSlides).toBe(5);
    expect(board?.includeRecommendations).toBe(true);
    expect(board?.recommendationCount).toBe(3);

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
  });
});
