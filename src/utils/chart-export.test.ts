import { pngDpi, stampPngDpi } from './chart-export';

const ONE_PIXEL_PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  )
);

describe('chart png dpi', () => {
  it('stamps 300 dpi into the pHYs chunk', () => {
    const stamped = stampPngDpi(ONE_PIXEL_PNG, 300);
    expect(pngDpi(stamped)).toBe(300);
    expect(String.fromCharCode(...stamped.subarray(0, 8))).toContain('PNG');
  });
});
