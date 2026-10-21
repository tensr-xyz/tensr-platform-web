import { fireEvent, render, screen } from '@testing-library/react';

import { ChoiceModellingDialog } from './index';

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    datasets: { analyze: { run: jest.fn() } },
  },
}));

jest.mock('@/lib/open-analysis-result-tab', () => ({
  openAnalysisResultTab: jest.fn(),
}));

describe('choice modelling dialog', () => {
  it('explains MaxDiff from the best, worst, and set columns', () => {
    render(
      <ChoiceModellingDialog mode="maxdiff">
        <button type="button">Open MaxDiff</button>
      </ChoiceModellingDialog>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open MaxDiff' }));
    expect(screen.getByText(/Item codes are read from those columns/)).toBeInTheDocument();
    expect(screen.queryByText(/Long choice data/)).not.toBeInTheDocument();
  });
});
