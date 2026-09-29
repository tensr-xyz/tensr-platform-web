import { render, screen } from '@testing-library/react';

import { ANALYSIS_WIZARD_TOOLTIPS } from '@/lib/analysis-wizard-tooltips';

import { AnalysisDialogShell } from './analysis-dialog-shell';

describe('analysis dialog preview label', () => {
  it('does not tell the researcher the analysis uses a 250-row preview', () => {
    render(
      <AnalysisDialogShell
        open
        onOpenChange={() => undefined}
        title="Descriptives"
        meta={{ summary: 'Summarize columns.' }}
        tooltip={ANALYSIS_WIZARD_TOOLTIPS.descriptives}
        onBack={() => undefined}
        busy={false}
        canRun
        serverError={null}
        onRun={() => undefined}
      >
        <p>Variables</p>
      </AnalysisDialogShell>
    );

    expect(screen.queryByText(/250-row preview/i)).not.toBeInTheDocument();
    const assumptions = [
      ...(ANALYSIS_WIZARD_TOOLTIPS.descriptives?.assumptions ?? []),
      ...(ANALYSIS_WIZARD_TOOLTIPS.chi_square?.assumptions ?? []),
    ].join(' ');
    expect(assumptions).not.toMatch(/250-row preview/i);
  });
});
