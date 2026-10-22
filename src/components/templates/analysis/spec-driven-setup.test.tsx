import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { specFor, valuesFromSpec } from '@/lib/analysis-spec-setup';
import type { SchemaColumn } from '@/lib/analysis-report-types';

import { SpecDrivenSetup } from './spec-driven-setup';

const SCHEMA: SchemaColumn[] = [
  { name: 'score', type: 'numeric', missing_count: 0 },
  { name: 'group', type: 'categorical', missing_count: 0 },
];

describe('SpecDrivenSetup', () => {
  it('shows required pickers, a defaults chip, and collapsed advanced options', () => {
    const spec = specFor('linear_regression');
    expect(spec).toBeDefined();
    const values = valuesFromSpec(spec!, null, null, SCHEMA);
    render(
      <SpecDrivenSetup spec={spec!} values={values} onChange={() => undefined} schema={SCHEMA} />
    );
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByText('dependent')).toBeInTheDocument();
    expect(screen.getByText(/Defaults\./)).toBeInTheDocument();
    expect(screen.queryByText('APA-style tables')).not.toBeInTheDocument();
    expect(screen.queryByText('residual plots')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /advanced options/i }));
    expect(screen.getByText('residual plots')).toBeInTheDocument();
  });

  it('puts a changed dot on advanced options when a field leaves its default', () => {
    const spec = specFor('linear_regression')!;
    const values = { ...valuesFromSpec(spec, null, null, SCHEMA), collinearity_diagnostics: true };
    render(
      <SpecDrivenSetup spec={spec} values={values} onChange={() => undefined} schema={SCHEMA} />
    );
    expect(screen.getByLabelText('Changed')).toBeInTheDocument();
  });
});
