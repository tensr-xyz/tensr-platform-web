import {
  addBannerQuestion,
  addStubQuestion,
  bannerColumnProduct,
  buildTableRequest,
  defaultCanvas,
  moveCategory,
  nestUnderBanner,
  uniqueColumnValues,
  type CustomTableCanvas,
} from './spec';

const ROWS = [
  { gender: 'Male', age_band: '18-34', nps: 9 },
  { gender: 'Female', age_band: '18-34', nps: 8 },
  { gender: 'Male', age_band: '35-54', nps: 6 },
];

describe('custom table spec builder', () => {
  it('defaults letters, column %, nested banners, and no row %', () => {
    const canvas = defaultCanvas();
    expect(canvas.significanceDisplay).toBe('column_letters');
    expect(canvas.columnPercent).toBe(true);
    expect(canvas.rowPercent).toBe(false);
    expect(canvas.nestBanners).toBe(true);
    const body = buildTableRequest(canvas);
    expect(body.significance_display).toBe('column_letters');
    expect(body.statistics).toEqual(['column_proportion']);
    expect(body.nest_banners).toBe(true);
  });

  it('pins unique values when a question is dropped without an order', () => {
    let canvas = defaultCanvas();
    canvas = addStubQuestion(canvas, 'gender', ROWS);
    expect(canvas.stubs[0].values).toEqual(['Male', 'Female']);
    canvas = addBannerQuestion(canvas, 'age_band', ROWS);
    expect(canvas.banners[0].values).toEqual(['18-34', '35-54']);
  });

  it('reorder writes values onto the request', () => {
    let canvas = defaultCanvas();
    canvas = addStubQuestion(canvas, 'gender', ROWS);
    canvas = moveCategory(canvas, 'stub', 0, 1, 0);
    expect(canvas.stubs[0].values).toEqual(['Female', 'Male']);
    expect(buildTableRequest(canvas).stubs[0].values).toEqual(['Female', 'Male']);
  });

  it('includes row_proportion when row % is on', () => {
    const canvas: CustomTableCanvas = {
      ...defaultCanvas(),
      rowPercent: true,
      stubs: [{ column: 'gender', values: ['Male', 'Female'], nets: [] }],
      banners: [{ column: 'age_band', values: ['18-34'], nested: [] }],
    };
    expect(buildTableRequest(canvas).statistics).toEqual(['column_proportion', 'row_proportion']);
  });

  it('side-by-side sets nest_banners false', () => {
    const canvas: CustomTableCanvas = {
      ...defaultCanvas(),
      nestBanners: false,
      stubs: [{ column: 'gender', values: ['Male'], nets: [] }],
      banners: [
        { column: 'age_band', values: ['18-34'], nested: [] },
        { column: 'gender', values: ['Male'], nested: [] },
      ],
    };
    expect(buildTableRequest(canvas).nest_banners).toBe(false);
  });

  it('nest under a span writes nested on the parent banner', () => {
    let canvas = defaultCanvas();
    canvas = addBannerQuestion(canvas, 'age_band', ROWS);
    canvas = nestUnderBanner(canvas, 0, 'gender', ROWS);
    const banner = buildTableRequest(canvas).banner[0] as {
      nested?: Array<{ column: string }>;
    };
    expect(banner.nested?.[0].column).toBe('gender');
  });

  it('warns when nested product exceeds 16 banner columns', () => {
    const banners = [
      { column: 'a', values: ['1', '2', '3', '4', '5'], nested: [] },
      { column: 'b', values: ['x', 'y', 'z', 'w'], nested: [] },
    ];
    expect(bannerColumnProduct(banners, true)).toBe(20);
    expect(bannerColumnProduct(banners, false)).toBe(9);
  });

  it('uniqueColumnValues skips blanks and keeps first-seen order', () => {
    expect(
      uniqueColumnValues(
        [{ colour: 'red' }, { colour: '' }, { colour: 'blue' }, { colour: 'red' }],
        'colour'
      )
    ).toEqual(['red', 'blue']);
  });
});
