import { fireEvent, render, screen } from '@testing-library/react';
import { NumberTracePopover } from './number-trace-popover';

const trace = {
  value: '71%',
  context: 'Aware · 18–34',
  respondentCount: 286,
  showRespondentsLabel: 'Show the 286 respondents',
  rows: [
    { label: 'Respondents', value: '286 of 402 · 18–34' },
    { label: 'Weighted', value: '291.4 of 410.2 · Design weight' },
    { label: 'Filter', value: 'None' },
    { label: 'Significance', value: 'Higher than 55+ (p < 0.01)' },
    { label: 'R check', value: 'Matches · 0.00 difference', accent: true },
  ],
};

describe('NumberTracePopover', () => {
  it('renders Paper 9f rows and show-respondents', () => {
    const onShow = jest.fn();
    render(<NumberTracePopover trace={trace} onShowRespondents={onShow} />);
    expect(screen.getByText('71%')).toBeInTheDocument();
    expect(screen.getByText('Aware · 18–34')).toBeInTheDocument();
    expect(screen.getByText('Respondents')).toBeInTheDocument();
    expect(screen.getByText('286 of 402 · 18–34')).toBeInTheDocument();
    expect(screen.getByText('291.4 of 410.2 · Design weight')).toBeInTheDocument();
    expect(screen.getByText('Higher than 55+ (p < 0.01)')).toBeInTheDocument();
    expect(screen.getByText('Matches · 0.00 difference')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show the 286 respondents' }));
    expect(onShow).toHaveBeenCalled();
  });

  it('omits Comment when no handler is passed', () => {
    render(<NumberTracePopover trace={trace} onShowRespondents={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'Comment' })).not.toBeInTheDocument();
  });
});
