import JSZip from 'jszip';
import {
  assertLayoutMutable,
  getPageLayout,
  inspectPptxTemplate,
  listPageLayouts,
  mergeThemeIntoOrgSettings,
  normalizeReportTheme,
  normalizeVisualizationDefaults,
  reportThemeFromInspection,
  setVisualizationDefault,
  textDefaultsFromTheme,
  themeFromOrgSettings,
} from './report-theme';
import { resolveSeriesColors } from './chart-theme';

async function syntheticPptx(options?: {
  layouts?: string[];
  accents?: string[];
}): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const layouts = options?.layouts ?? ['Title Slide', 'Title and Content', 'Blank'];
  const accents = options?.accents ?? ['4F81BD', 'C0504D', '9BBB59'];
  layouts.forEach((name, index) => {
    zip.file(
      `ppt/slideLayouts/slideLayout${index + 1}.xml`,
      `<?xml version="1.0"?><p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld name="${name}"/></p:sldLayout>`
    );
  });
  const accentXml = accents
    .map((hex, i) => `<a:accent${i + 1}><a:srgbClr val="${hex}"/></a:accent${i + 1}>`)
    .join('');
  zip.file(
    'ppt/theme/theme1.xml',
    `<?xml version="1.0"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:themeElements><a:clrScheme name="Test">${accentXml}</a:clrScheme></a:themeElements></a:theme>`
  );
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'
  );
  return zip.generateAsync({ type: 'arraybuffer' });
}

describe('report page layouts and theme', () => {
  it('lists protected page masters with slots', () => {
    const layouts = listPageLayouts();
    expect(layouts.map(item => item.id)).toEqual(
      expect.arrayContaining([
        'blank',
        'title_only',
        'title_page',
        'title_and_content',
        'content_and_text',
        'two_content',
      ])
    );
    expect(layouts.every(item => item.protected)).toBe(true);
    expect(getPageLayout('two_content')?.slots.map(slot => slot.label)).toEqual([
      'Left content',
      'Right content',
    ]);
    expect(() => assertLayoutMutable('blank')).toThrow(/default/);
  });

  it('normalises organisation reportTheme settings', () => {
    const theme = normalizeReportTheme({
      fontFamily: 'Georgia',
      primaryColour: '#aabbcc',
      chartPalette: ['#112233', 'bad', '#445566'],
    });
    expect(theme.fontFamily).toBe('Georgia');
    expect(theme.primaryColour).toBe('#AABBCC');
    expect(theme.chartPalette).toEqual(['#112233', '#445566']);
    expect(themeFromOrgSettings({ reportTheme: { primary_colour: '#010203' } }).primaryColour).toBe(
      '#010203'
    );
  });

  it('inspects a PowerPoint template for layouts and theme colours', async () => {
    const data = await syntheticPptx({
      layouts: ['Title', 'Blank', 'Two Content'],
      accents: ['112233', '445566'],
    });
    const inspected = await inspectPptxTemplate(data);
    expect(inspected.layoutCount).toBe(3);
    expect(inspected.layouts.map(item => item.name)).toEqual(['Title', 'Blank', 'Two Content']);
    expect(inspected.themeColours).toEqual(['#112233', '#445566']);
    expect(inspected.summary).toBe('3 layouts · theme colours found');
    const theme = reportThemeFromInspection(inspected);
    expect(theme.chartPalette).toEqual(['#112233', '#445566']);
    expect(theme.primaryColour).toBe('#112233');
  });

  it('rejects a non-PowerPoint buffer', async () => {
    const bad = new Uint8Array([1, 2, 3, 4]).buffer;
    await expect(inspectPptxTemplate(bad)).rejects.toThrow(/PowerPoint/);
  });

  it('resolves chart series colours from the team theme', () => {
    expect(resolveSeriesColors('apa')[0]).toBe('#222222');
    expect(resolveSeriesColors('default', { chartPalette: ['#ABCDEF'] })).toEqual(['#ABCDEF']);
    expect(resolveSeriesColors('default', null, ['#111111'])).toEqual(['#111111']);
  });

  it('builds text defaults and visualisation stores from the team theme', () => {
    const defaults = textDefaultsFromTheme({
      fontFamily: 'Georgia',
      primaryColour: '#112233',
      secondaryColour: '#445566',
    });
    expect(defaults).toEqual({
      fontFamily: 'Georgia',
      color: '#445566',
      accentColor: '#112233',
    });
    const viz = normalizeVisualizationDefaults({
      table: { tableStyle: { preset: 'banded' } },
      chart: { textStyle: { bold: true } },
    });
    expect(viz.table?.tableStyle).toEqual({ preset: 'banded' });
    expect(viz.chart?.textStyle).toEqual({ bold: true });
    const updated = setVisualizationDefault(viz, { kind: 'chart', textStyle: { bold: false } });
    expect(updated.chart?.textStyle).toEqual({ bold: false });
    expect(() => setVisualizationDefault(viz, { kind: 'text' })).toThrow(/chart or table/);
    const settings = mergeThemeIntoOrgSettings(
      { name: 'Acme' },
      { theme: { primaryColour: '#ABCDEF' }, visualizations: updated }
    );
    expect((settings.reportTheme as { primaryColour: string }).primaryColour).toBe('#ABCDEF');
    expect((settings.visualizationDefaults as { chart: { kind: string } }).chart.kind).toBe(
      'chart'
    );
  });
});
