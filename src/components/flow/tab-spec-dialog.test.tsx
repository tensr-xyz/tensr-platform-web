import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TabSpecDialog } from './tab-spec-dialog';

jest.mock('@/lib/flow-api', () => ({
  flowJson: jest.fn(),
}));

import { flowJson } from '@/lib/flow-api';

const mockedFlowJson = flowJson as jest.MockedFunction<typeof flowJson>;

describe('TabSpecDialog', () => {
  beforeEach(() => {
    mockedFlowJson.mockReset();
  });

  it('renders Paper 10h Build from a spec after parse', async () => {
    mockedFlowJson.mockResolvedValueOnce({
      filename: 'W4 tab plan.xlsx',
      n_tables: 4,
      n_banners: 3,
      n_matched: 3,
      n_needs_you: 1,
      file_line: '4 tables · 3 banners',
      summary_line: '3 matched · 1 need you · stat tests, bases and nets taken from the spec',
      tables: [
        {
          index: 1,
          title: 'Awareness (prompted)',
          banner_label: 'Demographics',
          status: 'matched',
          status_label: 'Matched',
        },
        {
          index: 3,
          title: '"Q22 recode 1-3 = Low"',
          banner_label: 'Demographics',
          status: 'needs_question',
          status_label: 'Pick question',
        },
      ],
    });

    // FileReader is used to base64 the upload; stub a tiny payload.
    const readerProto = FileReader.prototype as FileReader & {
      result: string | ArrayBuffer | null;
    };
    const originalRead = readerProto.readAsDataURL;
    readerProto.readAsDataURL = function readAsDataURL() {
      Object.defineProperty(this, 'result', {
        configurable: true,
        value: 'data:application/octet-stream;base64,Zm9v',
      });
      this.onload?.({ target: this } as ProgressEvent<FileReader>);
    };

    render(<TabSpecDialog datasetId="ds-1" open onOpenChange={() => undefined} />);

    expect(screen.getByText('Tables → Build from a spec')).toBeInTheDocument();
    expect(screen.getByText('Build tables from your spec')).toBeInTheDocument();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['stub'], 'W4 tab plan.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('What Tensr read')).toBeInTheDocument();
    });
    expect(screen.getByText('Awareness (prompted)')).toBeInTheDocument();
    expect(screen.getByText('Matched')).toBeInTheDocument();
    expect(screen.getByText('Pick question')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Build 3 tables' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review 1' })).toBeInTheDocument();
    expect(mockedFlowJson).toHaveBeenCalledWith(
      '/datasets/ds-1/tab-spec/parse',
      expect.objectContaining({ method: 'POST' })
    );

    readerProto.readAsDataURL = originalRead;
  });
});
