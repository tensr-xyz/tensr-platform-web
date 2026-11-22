import { fireEvent, render, screen } from '@testing-library/react';
import { ReportPaneSwitch } from '@/components/flow/report-outputs';

describe('ReportPaneSwitch', () => {
  it('shows Slides, Overview, and Outputs and reports the chosen view', () => {
    const onChange = jest.fn();
    render(<ReportPaneSwitch pane="overview" onChange={onChange} />);

    expect(screen.getByRole('button', { name: 'Slides' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Overview' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Outputs' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Slides' }));
    expect(onChange).toHaveBeenCalledWith('slides');
  });
});
