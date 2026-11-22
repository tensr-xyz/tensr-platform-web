import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DataChecksDialog } from './data-checks-dialog';

jest.mock('@/lib/flow-api', () => ({
  flowJson: jest.fn(),
}));

import { flowJson } from '@/lib/flow-api';

const mockedFlowJson = flowJson as jest.MockedFunction<typeof flowJson>;

describe('DataChecksDialog', () => {
  beforeEach(() => {
    mockedFlowJson.mockReset();
  });

  it('renders Paper 10h Check data cards from the report', async () => {
    mockedFlowJson.mockResolvedValue({
      respondents: 6,
      n_columns: 4,
      summary: { issues: 1, out_of_range: 1, construction_issues: 1 },
      construction: [
        {
          kind: 'out_of_range',
          kind_label: 'Value outside the labelled scale',
          column: 'age',
          label: 'Age',
          message: 'Age has 3 answer(s) outside the labelled scale 1–99.',
          codes: ['120'],
          count: 3,
        },
      ],
      straightlining: [],
      summary_tables: [],
      issue_labels: {
        missing_label: 'Missing variable label',
        unlabeled_code: 'Value in data with no label',
        unused_label: 'Label never used in the data',
        duplicate_label: 'Duplicate variable label',
        out_of_range: 'Value outside the labelled scale',
        empty_column: 'No answers in this column',
        straightlining: 'Same answer down a grid',
      },
    });

    const onShow = jest.fn();
    render(
      <DataChecksDialog datasetId="ds-1" open onOpenChange={() => undefined} onShow={onShow} />
    );

    expect(screen.getByText('Responses → Check data')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Data checks · 1 to look at')).toBeInTheDocument();
    });
    expect(screen.getByText(/Value outside the labelled scale: Age/)).toBeInTheDocument();
    expect(screen.getByText(/Age has 3 answer/)).toBeInTheDocument();
    expect(screen.getByText(/other checks passed/)).toBeInTheDocument();
    expect(screen.getByText(/after each upload/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show the 3' }));
    expect(onShow).toHaveBeenCalledWith(
      expect.objectContaining({ column: 'age', count: 3, showLabel: 'Show the 3' })
    );
  });
});
