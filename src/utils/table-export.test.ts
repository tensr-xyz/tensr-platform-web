import html2canvas from 'html2canvas';
import { exportTable } from './table-export';

jest.mock('html2canvas', () => ({ __esModule: true, default: jest.fn() }));

const html2canvasMock = html2canvas as unknown as jest.Mock;

function canvasYielding(blob: Blob | null) {
  return { toBlob: (cb: (b: Blob | null) => void) => setTimeout(() => cb(blob), 0) };
}

describe('exportTable png', () => {
  let clickSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    URL.createObjectURL = jest.fn(() => 'blob:table');
    URL.revokeObjectURL = jest.fn();
  });

  it('rejects when the canvas produces no image', async () => {
    html2canvasMock.mockResolvedValue(canvasYielding(null));

    await expect(
      exportTable(document.createElement('table'), { filename: 't', format: 'png' })
    ).rejects.toThrow('Could not render the table as a PNG image.');
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('resolves only after the download has been triggered', async () => {
    html2canvasMock.mockResolvedValue(canvasYielding(new Blob(['png'])));

    await exportTable(document.createElement('table'), { filename: 't', format: 'png' });
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
