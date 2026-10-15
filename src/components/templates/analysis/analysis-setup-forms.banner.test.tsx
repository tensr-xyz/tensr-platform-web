import React from 'react';
import { render, screen } from '@testing-library/react';
import { BannerTableForm } from './analysis-setup-forms';
import { formStateFromBody } from '@/lib/analysis-definitions';
import type { SchemaColumn } from '@/lib/analysis-report-types';

const SCHEMA: SchemaColumn[] = [
  { name: 'Q1_Satisfaction', type: 'numeric', missing_count: 42 },
  { name: 'Group', type: 'categorical', missing_count: 0 },
];

describe('Banner table re-run form', () => {
  it('keeps a numeric scale stub and shows nets as label and codes', () => {
    const form = formStateFromBody(
      'banner_table',
      {
        stub_column: 'Q1_Satisfaction',
        banner_column: 'Group',
        nets: [{ label: 'Top 2 Box', values: [4, 5] }],
        apa_format: true,
        include_charts: true,
      },
      SCHEMA
    );
    render(
      <BannerTableForm
        form={form}
        setForm={() => undefined}
        schema={SCHEMA}
        allNames={SCHEMA.map(column => column.name)}
        notices={{}}
        errors={{}}
      />
    );
    expect(screen.queryByText(/expects a categorical column/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Net label')).toHaveValue('Top 2 Box');
    expect(screen.getByLabelText('Net codes')).toHaveValue('4, 5');
    expect(screen.queryByDisplayValue(/"label"/)).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'APA format' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Include charts' })).toBeChecked();
  });
});
